from bson.objectid import ObjectId
import logging
import litellm

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
    
    litellm_model = prompt.get("model", default_model)
    if is_chat_model(litellm_model):
        return litellm_model
    else:
        return default_model

def is_chat_model(llm_model: str) -> bool:  
    """
    Check if the LLM model is a chat model

    Args:
        llm_model: The LLM model

    Returns:
        True if the LLM model is a chat model, False otherwise
    """
    try:
        model_info = litellm.get_model_info(llm_model)
        if model_info.get('mode') == 'chat':
            return True
        logger.info(f"Model {llm_model} is not a chat model")
    except Exception as e:
        logger.error(f"Error checking if {llm_model} is a chat model: {e}")

    return False