import analytiq_data as ad

async def get_llm_key(analytiq_client, llm_vendor: str = "OpenAI") -> str:
    """
    Get the LLM key
    """
    if llm_vendor not in ["OpenAI", "Anthropic", "Gemini", "Groq", "Cerebras"]:
        raise ValueError(f"Invalid LLM vendor: {llm_vendor}")

    # Get the MongoDB client
    mongo = analytiq_client.mongodb_async
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db["llm_tokens"]

    # Get the LLM token
    tokens = await collection.find_one({"llm_vendor": llm_vendor})
    if tokens is None:
        raise ValueError("No LLM token found in the database")

    # Decrypt the token before returning
    return ad.crypto.decrypt_token(tokens["token"])