import asyncio
import analytiq_data as ad
from openai import AsyncOpenAI
import json


async def run_llm(analytiq_client, 
                  document_id: str,
                  prompt_id: str = "default",
                  force: bool = False) -> dict:
    """
    Run the LLM for the given document and prompt.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
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
    
    llm_key = await ad.llm.get_llm_key(analytiq_client)
    ocr_text = ad.common.get_ocr_text(analytiq_client, document_id)
    
    client = AsyncOpenAI(api_key=llm_key)
    
    prompt1 = await ad.common.get_prompt_content(analytiq_client, prompt_id)
    
    # Build the prompt
    prompt = f"""{prompt1}

        Now extract from this text: 
        
        {ocr_text}"""
    
    response = await client.chat.completions.create(
        model="gpt-4o-mini", # gpt-4-turbo has 30,000 TPM limit in stage 1
        messages=[
            {"role": "system", "content": "You are a helpful assistant that extracts document information into JSON format."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        response_format={ "type": "json_object" }
    )
    
    resp_json = response.choices[0].message.content

    # Convert to dict
    resp_dict = json.loads(resp_json)

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
    # MongoDB's ObjectId contains a timestamp, so sorting by _id gives us chronological order
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

    element = {
        "prompt_id": prompt_id,
        "document_id": document_id,
        "llm_result": llm_result
    }

    # Save the result, return the ID
    result = await queue_collection.insert_one(element)
    return str(result.inserted_id)

async def delete_llm_result(analytiq_client,
                            document_id: str,
                            prompt_id: str) -> bool:
    """
    Delete an LLM result from MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
    
    Returns:
        bool: True if deleted, False if not found
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["llm.runs"]
    
    result = await collection.delete_one({
        "document_id": document_id,
        "prompt_id": prompt_id
    })
    
    return result.deleted_count > 0


async def run_llm_for_prompt_ids(analytiq_client, document_id: str, prompt_ids: list[str]) -> None:
    """
    Run the LLM for the given prompt IDs.

    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_ids: The prompt IDs to run the LLM for
    """

    n_prompts = len(prompt_ids)

    # Create n_prompts concurrent tasks
    tasks = [run_llm(analytiq_client, document_id, prompt_id) for prompt_id in prompt_ids]

    # Run the tasks
    results = await asyncio.gather(*tasks)

    ad.log.info(f"LLM run completed for {document_id} with {n_prompts} prompts: {results}")
