import analytiq_data as ad

async def get_llm_key(analytiq_client, llm_provider: str) -> str:
    """
    Get the LLM key
    """
    db = analytiq_client.mongodb_async[analytiq_client.env]
    provider_config = await db.llm_providers.find_one({"litellm_provider": llm_provider})
    if provider_config is None:
        raise ValueError(f"LLM provider {llm_provider} not found")
    if provider_config["token"] in [None, ""]:
        return ""

    # Decrypt the token before returning
    return ad.crypto.decrypt_token(provider_config["token"])