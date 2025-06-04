import asyncio
import analytiq_data as ad
from litellm.main import acompletion  # Changed import path
from litellm.utils import supports_response_schema
import json
from datetime import datetime, UTC
from pydantic import BaseModel, create_model
from typing import Optional, Dict, Any
from collections import OrderedDict
import logging

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

    if llm_model is None:
        llm_model = await ad.llm.get_llm_model(analytiq_client, prompt_rev_id)

    logger.info(f"LLM model: {llm_model}")

    # Get the appropriate API key based on the model prefix
    provider = "OpenAI"  # Default
    if llm_model.startswith("claude"):
        llm_model = "claude-3-5-sonnet-20240620"
        provider = "Anthropic"
    elif llm_model.startswith("gemini"):
        provider = "Gemini"
    elif llm_model.startswith("groq"):
        provider = "Groq"
    elif llm_model.startswith("mistral"):
        provider = "Mistral"
        
    api_key = await ad.llm.get_llm_key(analytiq_client, provider)
    ocr_text = ad.common.get_ocr_text(analytiq_client, document_id)

    logger.info(f"LLM model: {llm_model}, provider: {provider}, api_key: {api_key}")
    
    prompt1 = await ad.common.get_prompt_content(analytiq_client, prompt_rev_id)
    
    # Build the prompt
    prompt = f"""{prompt1}

        Now extract from this text: 
        
        {ocr_text}"""

    system_prompt = (
        "You are a helpful assistant that extracts document information into JSON format. "
        "Always respond with valid JSON only, no other text. "
        "Format your entire response as a JSON object."
    )

    response_format = None
    if provider in ["OpenAI", "Anthropic", "Gemini", "Groq", "Mistral"]:
        # Initialize response_format
        response_format = None

        # Most but not all models support response_format
        # See https://platform.openai.com/docs/guides/structured-outputs?format=without-parse
        if supports_response_schema(model=llm_model) and prompt_rev_id != "default":
            # Get the prompt response format, if any
            response_format = await ad.common.get_prompt_response_format(analytiq_client, prompt_rev_id)
            logger.info(f"Response format: {response_format}")
        
        if response_format is None:
            logger.info(f"No response format found for prompt {prompt_rev_id}")
            # Use a default response format
            response_format = {"type": "json_object"}

    response = await acompletion(
        model=llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        api_key=api_key,
        temperature=0.1,
        response_format=response_format
    )

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

    # Save the new result
    await save_llm_result(analytiq_client, document_id, prompt_rev_id, resp_dict)
    
    return resp_dict

async def get_llm_result(analytiq_client,
                         document_id: str,
                         prompt_rev_id: str) -> dict | None:
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
    collection = db["llm.runs"]
    
    # Sort by _id in descending order to get the latest document
    result = await collection.find_one(
        {
            "document_id": document_id,
            "prompt_id": prompt_rev_id
        },
        sort=[("_id", -1)]
    )
    
    if result:
        # Remove MongoDB's _id field
        result.pop('_id', None)

        logger.info(f"LLM result: {result}")
        return result
        
    return None

async def save_llm_result(analytiq_client, 
                          document_id: str,
                          prompt_rev_id: str, 
                          llm_result: dict) -> str:
    """
    Save the LLM result to MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
        llm_result: The LLM result
    """

    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    queue_collection_name = f"llm.runs"
    queue_collection = db[queue_collection_name]

    current_time_utc = datetime.now(UTC)

    element = {
        "prompt_id": prompt_rev_id,
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
    result = await queue_collection.insert_one(element)
    return str(result.inserted_id)

async def delete_llm_result(analytiq_client,
                            document_id: str,
                            prompt_id: str | None = None) -> bool:
    """
    Delete an LLM result from MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID. If None, delete all LLM results for the document.
    
    Returns:
        bool: True if deleted, False if not found
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["llm.runs"]

    delete_filter = {
        "document_id": document_id
    }

    if prompt_id is not None:
        delete_filter["prompt_id"] = prompt_id

    result = await collection.delete_many(delete_filter)
    
    return result.deleted_count > 0


async def run_llm_for_prompt_ids(analytiq_client, document_id: str, prompt_ids: list[str], model: str = "gpt-4o-mini") -> None:
    """
    Run the LLM for the given prompt IDs.

    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_ids: The prompt IDs to run the LLM for
    """

    n_prompts = len(prompt_ids)

    # Create n_prompts concurrent tasks
    tasks = [run_llm(analytiq_client, document_id, prompt_id, model) for prompt_id in prompt_ids]

    # Run the tasks
    results = await asyncio.gather(*tasks)

    logger.info(f"LLM run completed for {document_id} with {n_prompts} prompts: {results}")

async def update_llm_result(analytiq_client,
                            document_id: str,
                            prompt_id: str,
                            updated_llm_result: dict,
                            is_verified: bool = False) -> str:
    """
    Update an existing LLM result with edits and verification status.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
        updated_llm_result: The updated LLM result
        is_verified: Whether this result has been verified
    
    Returns:
        str: The ID of the updated document
        
    Raises:
        ValueError: If no existing result found or if result signatures don't match
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["llm.runs"]
    
    # Get the latest result
    existing = await collection.find_one(
        {
            "document_id": document_id,
            "prompt_id": prompt_id
        },
        sort=[("_id", -1)]
    )
    
    if not existing:
        raise ValueError(f"No existing LLM result found for document_id: {document_id}, prompt_id: {prompt_id}")
    
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
    
    result = await collection.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise ValueError("Failed to update LLM result")
        
    return str(existing["_id"])