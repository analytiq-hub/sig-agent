import analytiq_data as ad

async def get_llm_key(analytiq_client):
    """
    Get the LLM key
    """
    mongo = analytiq_client.mongodb_async
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db["llm_tokens"]

    # Get the OpenAI token
    tokens = await collection.find_one({"llm_vendor": "OpenAI"})
    if tokens is None:
        raise ValueError("No LLM token found in the database")

    return tokens["token"]
