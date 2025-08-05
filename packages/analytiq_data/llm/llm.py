import asyncio
import analytiq_data as ad
import litellm
from litellm.utils import supports_pdf_input  # Add this import
import json
from datetime import datetime, UTC
from pydantic import BaseModel, create_model
from typing import Optional, Dict, Any
from collections import OrderedDict
import logging
from bson import ObjectId
import base64

logger = logging.getLogger(__name__)

async def run_llm(analytiq_client, 
                  document_id: str,
                  prompt_rev_id: str = "default",
                  llm_model: str = None,
                  force: bool = False) -> dict:
    """
    Run the LLM for the given document and prompt.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_rev_id: The prompt revision ID
        llm_model: The model to use (e.g. "gpt-4", "claude-3-sonnet", "mixtral-8x7b-32768")
               If not provided, the model will be retrieved from the prompt.
        force: If True, run the LLM even if the result is already cached
    
    Returns:
        dict: The LLM result
    """
    # Check for existing result unless force is True
    if not force:
        existing_result = await get_llm_result(analytiq_client, document_id, prompt_rev_id)
        if existing_result:
            logger.info(f"Using cached LLM result for document_id: {document_id}, prompt_rev_id: {prompt_rev_id}")
            return existing_result["llm_result"]
    else:
        # Delete the existing result
        await delete_llm_result(analytiq_client, document_id, prompt_rev_id)

    logger.info(f"Running new LLM analysis for document_id: {document_id}, prompt_rev_id: {prompt_rev_id}")

    # 1. Get the document and organization_id
    doc = await ad.common.doc.get_doc(analytiq_client, document_id)
    org_id = doc.get("organization_id")
    if not org_id:
        raise Exception("Document missing organization_id")

    # 2. Determine LLM model
    if llm_model is None:
        llm_model = await ad.llm.get_llm_model(analytiq_client, prompt_rev_id)

    # 3. Determine SPU cost for this LLM
    spu_cost = await ad.payments.get_spu_cost(llm_model)

    # 4. Determine number of pages (example: from doc['num_pages'] or OCR)
    num_pages = doc.get("num_pages", 1)  # You may need to adjust this

    total_spu_needed = spu_cost * num_pages

    # 5. Check if org has enough credits    
    spus_available = await ad.payments.check_spu_limits(org_id, total_spu_needed)
    if not spus_available:
        raise Exception("Not enough SPU credits to run LLM")

    if not ad.llm.is_chat_model(llm_model) and not ad.llm.is_supported_model(llm_model):
        logger.info(f"LLM model {llm_model} is not a chat model, falling back to default llm_model")
        llm_model = "gpt-4o-mini"

    # Get the provider for the given LLM model
    llm_provider = ad.llm.get_llm_model_provider(llm_model)
    if llm_provider is None:
        logger.info(f"LLM model {llm_model} not supported, falling back to default llm_model")
        llm_model = "gpt-4o-mini"
        llm_provider = "openai"
        
    api_key = await ad.llm.get_llm_key(analytiq_client, llm_provider)
    logger.info(f"LLM model: {llm_model}, provider: {llm_provider}, api_key: {api_key[:16]}********")

    ocr_text = ad.common.get_ocr_text(analytiq_client, document_id)
    prompt1 = await ad.common.get_prompt_content(analytiq_client, prompt_rev_id)
    
    # Define system_prompt before using it
    system_prompt = (
        "You are a helpful assistant that extracts document information into JSON format. "
        "Always respond with valid JSON only, no other text. "
        "Format your entire response as a JSON object."
    )
    
    # Check if this model supports vision and we have a PDF
    use_vision = supports_pdf_input(llm_model, None) and doc.get("pdf_file_name")
    
    if use_vision:
        # Get the PDF file
        pdf_file = ad.common.get_file(analytiq_client, doc["pdf_file_name"])
        if pdf_file and pdf_file["blob"]:
            # For vision models, we can pass both the PDF and OCR text
            # The PDF provides visual context, OCR text provides structured text
            prompt = f"""{prompt1}

            Please analyze this document. You have access to both the visual PDF and the extracted text.
            
            Extracted text from the document:
            {ocr_text}
            
            Please provide your analysis based on both the visual content and the text."""
            
            # Different approaches for different providers
            if llm_provider == "openai":
                # For OpenAI, we need to upload the file first
                try:
                    # Upload file to OpenAI
                    file_response = await litellm.afile_upload(
                        model=llm_model,
                        file=pdf_file['blob'],
                        file_name=doc["pdf_file_name"],
                        api_key=api_key
                    )
                    file_id = file_response.id
                    
                    # Create messages with file reference
                    file_content = [
                        {"type": "text", "text": prompt},
                        {
                            "type": "file",
                            "file": {
                                "file_id": file_id,
                            }
                        },
                    ]
                    
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": file_content}
                    ]
                    logger.info(f"Attaching OCR and PDF to prompt {prompt_rev_id} using OpenAI file_id: {file_id}")
                    
                except Exception as e:
                    logger.warning(f"Failed to upload file to OpenAI: {e}, falling back to OCR-only")
                    use_vision = False
                    
            else:
                # For other providers (Anthropic, Gemini), use base64 approach
                encoded_file = base64.b64encode(pdf_file['blob']).decode("utf-8")
                base64_url = f"data:application/pdf;base64,{encoded_file}"
                
                file_content = [
                    {"type": "text", "text": prompt},
                    {
                        "type": "file",
                        "file": {
                            "file_data": base64_url,
                        }
                    },
                ]
                
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": file_content}
                ]
                logger.info(f"Attaching OCR and PDF to prompt {prompt_rev_id} using base64 for {llm_provider}")
        else:
            # Fallback to OCR-only if PDF not available
            use_vision = False
    
    if not use_vision:
        # Original OCR-only approach
        prompt = f"""{prompt1}

        Now extract from this text: 
        
        {ocr_text}"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        logger.info(f"Attaching OCR-only to prompt {prompt_rev_id}")

    response_format = None
    
    # Most but not all models support response_format
    # See https://platform.openai.com/docs/guides/structured-outputs?format=without-parse
    if prompt_rev_id == "default":
        # Use a default response format
        response_format = {"type": "json_object"}
    elif litellm.supports_response_schema(model=llm_model):
        # Get the prompt response format, if any
        response_format = await ad.common.get_prompt_response_format(analytiq_client, prompt_rev_id)
        logger.info(f"Response format: {response_format}")
    
    if response_format is None:
        logger.info(f"No response format found for prompt {prompt_rev_id}")

    # Bedrock models require aws_access_key_id, aws_secret_access_key, aws_region_name
    if llm_provider == "bedrock":
        aws_keys = ad.aws.get_aws_keys(analytiq_client)
        aws_access_key_id = aws_keys["aws_access_key_id"]
        aws_secret_access_key = aws_keys["aws_secret_access_key"]
        aws_region_name = "us-east-1"
    else:
        aws_access_key_id = None
        aws_secret_access_key = None
        aws_region_name = None

    # 6. Call the LLM
    response = await litellm.acompletion(
        model=llm_model,
        messages=messages,  # Use the vision-aware messages
        api_key=api_key,
        temperature=0.1,
        response_format=response_format,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_region_name=aws_region_name
    )

    # 7. Deduct credits
    await ad.payments.record_spu_usage(org_id, total_spu_needed)

    # 8. Return the response
    resp_dict = json.loads(response.choices[0].message.content)

    # If this is not the default prompt, reorder the response to match schema
    if prompt_rev_id != "default":
        # Get the prompt response format
        response_format = await ad.common.get_prompt_response_format(analytiq_client, prompt_rev_id)
        if response_format and response_format.get("type") == "json_schema":
            schema = response_format["json_schema"]["schema"]
            # Get ordered properties from schema
            ordered_properties = list(schema.get("properties", {}).keys())
            
            #logger.info(f"Ordered properties: {ordered_properties}")

            # Create new ordered dictionary based on schema property order
            ordered_resp = OrderedDict()
            for key in ordered_properties:
                if key in resp_dict:
                    ordered_resp[key] = resp_dict[key]

            #logger.info(f"Ordered response: {ordered_resp}")
            
            # Add any remaining keys that might not be in schema
            for key in resp_dict:
                if key not in ordered_resp:
                    ordered_resp[key] = resp_dict[key]
                    
            resp_dict = dict(ordered_resp)  # Convert back to regular dict

            #logger.info(f"Reordered response: {resp_dict}")

    # 9. Save the new result
    await save_llm_result(analytiq_client, document_id, prompt_rev_id, resp_dict)
    
    return resp_dict

async def get_llm_result(analytiq_client,
                         document_id: str,
                         prompt_rev_id: str,
                         fallback: bool = False) -> dict | None:
    """
    Retrieve the latest LLM result from MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_rev_id: The prompt revision ID
    
    Returns:
        dict | None: The latest LLM result if found, None otherwise
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    
    # Sort by _id in descending order to get the latest document
    result = await db.llm_runs.find_one(
        {
            "document_id": document_id,
            "prompt_rev_id": prompt_rev_id
        },
        sort=[("_id", -1)]
    )

    if not result and fallback:
        # Get the prompt_id and prompt_version from the prompt_rev_id
        prompt_id, _ = await get_prompt_info_from_rev_id(analytiq_client, prompt_rev_id)
        result = await db.llm_runs.find_one(
            {
                "document_id": document_id,
                "prompt_id": prompt_id,
            },
            sort=[("prompt_version", -1)]
        )
    
    return result

async def get_prompt_info_from_rev_id(analytiq_client, prompt_rev_id: str) -> tuple[str, int]:
    """
    Get prompt_id and prompt_version from prompt_rev_id.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        prompt_rev_id: The prompt revision ID
        
    Returns:
        tuple[str, int]: (prompt_id, prompt_version)
    """
    # Special case for the default prompt
    if prompt_rev_id == "default":
        return "default", 1
    
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    
    # Get the prompt revision
    elem = await db.prompt_revisions.find_one({"_id": ObjectId(prompt_rev_id)})
    if elem is None:
        raise ValueError(f"Prompt revision {prompt_rev_id} not found")
    
    return str(elem["prompt_id"]), elem["prompt_version"]

async def save_llm_result(analytiq_client, 
                          document_id: str,
                          prompt_rev_id: str, 
                          llm_result: dict) -> str:
    """
    Save the LLM result to MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_rev_id: The prompt revision ID
        llm_result: The LLM result
    """

    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]

    current_time_utc = datetime.now(UTC)
    
    # Get prompt_id and prompt_version from prompt_rev_id
    prompt_id, prompt_version = await get_prompt_info_from_rev_id(analytiq_client, prompt_rev_id)

    element = {
        "prompt_rev_id": prompt_rev_id,
        "prompt_id": prompt_id,
        "prompt_version": prompt_version,
        "document_id": document_id,
        "llm_result": llm_result,
        "updated_llm_result": llm_result.copy(),
        "is_edited": False,
        "is_verified": False,
        "created_at": current_time_utc,
        "updated_at": current_time_utc
    }

    logger.info(f"Saving LLM result: {element}")

    # Save the result, return the ID
    result = await db.llm_runs.insert_one(element)
    return str(result.inserted_id)

async def delete_llm_result(analytiq_client,
                            document_id: str,
                            prompt_rev_id: str | None = None) -> bool:
    """
    Delete an LLM result from MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_rev_id: The prompt revision ID. If None, delete all LLM results for the document.
    
    Returns:
        bool: True if deleted, False if not found
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]

    delete_filter = {
        "document_id": document_id
    }

    if prompt_rev_id is not None:
        delete_filter["prompt_rev_id"] = prompt_rev_id

    result = await db.llm_runs.delete_many(delete_filter)
    
    return result.deleted_count > 0


async def run_llm_for_prompt_rev_ids(analytiq_client, document_id: str, prompt_rev_ids: list[str], model: str = "gpt-4o-mini") -> None:
    """
    Run the LLM for the given prompt IDs.

    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_rev_ids: The prompt revision IDs to run the LLM for
    """

    n_prompts = len(prompt_rev_ids)

    # Create n_prompts concurrent tasks
    tasks = [run_llm(analytiq_client, document_id, prompt_rev_id, model) for prompt_rev_id in prompt_rev_ids]

    # Run the tasks
    results = await asyncio.gather(*tasks)

    logger.info(f"LLM run completed for {document_id} with {n_prompts} prompts: {results}")

    return results

async def update_llm_result(analytiq_client,
                            document_id: str,
                            prompt_rev_id: str,
                            updated_llm_result: dict,
                            is_verified: bool = False) -> str:
    """
    Update an existing LLM result with edits and verification status.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_rev_id: The prompt revision ID
        updated_llm_result: The updated LLM result
        is_verified: Whether this result has been verified
    
    Returns:
        str: The ID of the updated document
        
    Raises:
        ValueError: If no existing result found or if result signatures don't match
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    
    # Get the latest result
    existing = await db.llm_runs.find_one(
        {
            "document_id": document_id,
            "prompt_rev_id": prompt_rev_id
        },
        sort=[("_id", -1)]
    )
    
    if not existing:
        raise ValueError(f"No existing LLM result found for document_id: {document_id}, prompt_rev_id: {prompt_rev_id}")
    
    # Validate that the updated result has the same structure as the original
    existing_keys = set(existing["llm_result"].keys())
    updated_keys = set(updated_llm_result.keys())
    
    if existing_keys != updated_keys:
        raise ValueError(
            f"Updated result signature does not match original. "
            f"Original keys: {sorted(existing_keys)}, "
            f"Updated keys: {sorted(updated_keys)}"
        )

    current_time_utc = datetime.now(UTC)
    created_at = existing.get("created_at", current_time_utc)
    updated_at = current_time_utc
    
    # Update the document
    update_data = {
        "llm_result": existing["llm_result"],
        "updated_llm_result": updated_llm_result,
        "is_edited": True,
        "is_verified": is_verified,
        "created_at": created_at,
        "updated_at": updated_at
    }
    
    result = await db.llm_runs.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise ValueError("Failed to update LLM result")
        
    return str(existing["_id"])