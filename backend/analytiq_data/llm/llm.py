import asyncio
import analytiq_data as ad
from litellm.main import acompletion  # Changed import path
from litellm.utils import supports_response_schema
import json
from datetime import datetime, UTC
from pydantic import BaseModel, create_model
from typing import Optional

async def run_llm(analytiq_client, 
                  document_id: str,
                  prompt_id: str = "default",
                  llm_model: str = None,
                  force: bool = False) -> dict:
    """
    Run the LLM for the given document and prompt.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
        llm_model: The model to use (e.g. "gpt-4", "claude-3-sonnet", "mixtral-8x7b-32768")
               If not provided, the model will be retrieved from the prompt.
        force: If True, run the LLM even if the result is already cached
    
    Returns:
        dict: The LLM result
    """
    # Check for existing result unless force is True
    if not force:
        existing_result = await get_llm_result(analytiq_client, document_id, prompt_id)
        if existing_result:
            ad.log.info(f"Using cached LLM result for document_id: {document_id}, prompt_id: {prompt_id}")
            return existing_result["llm_result"]
    else:
        # Delete the existing result
        await delete_llm_result(analytiq_client, document_id, prompt_id)

    ad.log.info(f"Running new LLM analysis for document_id: {document_id}, prompt_id: {prompt_id}")

    if llm_model is None:
        llm_model = await ad.llm.get_llm_model(analytiq_client, prompt_id)

    ad.log.info(f"LLM model: {llm_model}")

    # Get the appropriate API key based on the model prefix
    provider = "OpenAI"  # Default
    if llm_model.startswith("claude"):
        llm_model = "claude-3-5-sonnet-20240620"
        provider = "Anthropic"
    elif llm_model.startswith("gemini"):
        provider = "Gemini"
    elif llm_model.startswith("groq"):
        provider = "Groq"
        
    api_key = await ad.llm.get_llm_key(analytiq_client, provider)
    ocr_text = ad.common.get_ocr_text(analytiq_client, document_id)
    
    prompt1 = await ad.common.get_prompt_content(analytiq_client, prompt_id)
    
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
    if provider in ["OpenAI", "Anthropic", "Gemini", "Groq"]:
        response_format = {"type": "json_object"}

        # Most but not all models support response_format
        # See https://platform.openai.com/docs/guides/structured-outputs?format=without-parse
        if supports_response_schema(model=llm_model) and prompt_id != "default":
            # Get the prompt schema, if any
            schema = await ad.common.get_prompt_schema(analytiq_client, prompt_id)
            ad.log.info(f"Prompt schema: {schema}")

            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": "document_extraction",
                    "schema": {
                        "type": "object",
                        "properties": {},
                        "required": [],
                        "additionalProperties": False
                    },
                    "strict": True
                }
            }

            # Build properties from schema
            for field in schema:
                field_name = field["name"]
                field_type = field["type"]
                
                # Convert Python/Pydantic types to JSON schema types
                json_type = "string"  # default
                if field_type == "int":
                    json_type = "integer"
                elif field_type == "float":
                    json_type = "number"
                elif field_type == "bool":
                    json_type = "boolean"
                elif field_type == "list":
                    json_type = "array"
                    
                response_format["json_schema"]["schema"]["properties"][field_name] = {
                    "type": json_type,
                    "description": field["name"].replace("_", " ")
                }
                response_format["json_schema"]["schema"]["required"].append(field_name)

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

    # Save the new result
    await save_llm_result(analytiq_client, document_id, prompt_id, resp_dict)
    
    return resp_dict

async def get_llm_result(analytiq_client,
                         document_id: str,
                         prompt_id: str) -> dict | None:
    """
    Retrieve the latest LLM result from MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
    
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
            "prompt_id": prompt_id
        },
        sort=[("_id", -1)]
    )
    
    if result:
        # Remove MongoDB's _id field
        result.pop('_id', None)

        ad.log.info(f"LLM result: {result}")
        return result
        
    return None

async def save_llm_result(analytiq_client, 
                          document_id: str,
                          prompt_id: str, 
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
        "prompt_id": prompt_id,
        "document_id": document_id,
        "llm_result": llm_result,
        "updated_llm_result": llm_result.copy(),
        "is_edited": False,
        "is_verified": False,
        "created_at": current_time_utc,
        "updated_at": current_time_utc
    }

    ad.log.info(f"Saving LLM result: {element}")

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

    ad.log.info(f"LLM run completed for {document_id} with {n_prompts} prompts: {results}")

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