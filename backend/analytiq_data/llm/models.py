import analytiq_data as ad

async def get_llm_model(analytiq_client, prompt_id: str) -> dict:
    """
    Get the LLM model for a prompt

    Args:
        analytiq_client: The AnalytiqClient instance
        prompt_id: The prompt ID

    Returns:
        The LLM model for the prompt
    """
    # Get the MongoDB client
    mongo = analytiq_client.mongodb_async
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db["prompts"]
    prompt = await collection.find_one({"_id": prompt_id})
    
    return prompt.get("model", "gpt-4o-mini")