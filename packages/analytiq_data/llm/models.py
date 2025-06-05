from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

import analytiq_data as ad

async def get_llm_model(analytiq_client, prompt_rev_id: str) -> dict:
    """
    Get the LLM model for a prompt

    Args:
        analytiq_client: The AnalytiqClient instance
        prompt_rev_id: The prompt revision ID

    Returns:
        The LLM model for the prompt
    """
    # Get the MongoDB client
    mongo = analytiq_client.mongodb_async
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db["prompt_revisions"]

    default_model = "gpt-4o-mini"

    if prompt_rev_id == "default":
        return default_model

    prompt = await collection.find_one({"_id": ObjectId(prompt_rev_id)})
    if prompt is None:
        return default_model
    
    return prompt.get("model", default_model)
