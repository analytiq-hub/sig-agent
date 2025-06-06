from bson.objectid import ObjectId
import os
import logging
import litellm
from datetime import datetime
import analytiq_data as ad

logger = logging.getLogger(__name__)

async def list_llm_providers(analytiq_client) -> dict:
    """
    List the LLM providers

    Args:
        analytiq_client: The AnalytiqClient instance

    Returns:
        The LLM model for the prompt
    """
    return list(litellm.models_by_provider.keys())

async def setup_llm_providers(analytiq_client):
    """Set up default LLM providers by upserting based on provider name"""
    env = analytiq_client.env
    db = analytiq_client.mongodb_async[env]

    providers = {
        "ai21": {
            "display_name": "AI21",
            "litellm_provider": "ai21",
            "litellm_models": ["j2-light"],
            "enabled": False,
            "token" : "",
            "token_created_at": None,
            "token_env": "AI21_API_KEY",
        },
        "anthropic": {
            "display_name": "Anthropic",
            "litellm_provider": "anthropic",
            "litellm_models": ["claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
            "enabled": True,
            "token" : "",
            "token_created_at": None,
            "token_env": "ANTHROPIC_API_KEY",
        },
        "azure": {
            "display_name": "Azure OpenAI",
            "litellm_provider": "azure",
            "litellm_models": ["azure/gpt-4.1-nano"],
            "enabled": False,
            "token" : "",
            "token_created_at": None,
            "token_env": "AZURE_OPENAI_API_KEY",
        },
        "azure_ai": {
            "display_name": "Azure AI Studio",
            "litellm_provider": "azure_ai",
            "litellm_models": ["azure_ai/deepseek-v3"],
            "enabled": False,
            "token" : "",
            "token_created_at": None,
            "token_env": "AZURE_AI_STUDIO_API_KEY",
        },
        "bedrock": {
            "display_name": "AWS Bedrock",
            "litellm_provider": "bedrock",
            "litellm_models": ["anthropic.claude-3-7-sonnet-20250219-v1:0"],
            "enabled": False,
            "token" : "",
            "token_created_at": None,
            "token_env": "AWS_BEDROCK_API_KEY",
        },
        "gemini": {
            "display_name": "Gemini",
            "litellm_provider": "gemini",
            "litellm_models": ["gemini/gemini-2.0-flash", "gemini/gemini-2.5-flash-preview-05-20"],
            "enabled": True,
            "token" : "",
            "token_created_at": None,
            "token_env": "GEMINI_API_KEY",
        },
        "groq": {
            "display_name": "Groq",
            "litellm_provider": "groq",
            "litellm_models": ["groq/deepseek-r1-distill-llama-70b"],
            "enabled": True,
            "token" : "",
            "token_created_at": None,
            "token_env": "GROQ_API_KEY",
        },
        "mistral": {
            "display_name": "Mistral",
            "litellm_provider": "mistral",
            "litellm_models": ["mistral/mistral-tiny"],
            "enabled": True,
            "token" : "",
            "token_created_at": None,
            "token_env": "MISTRAL_API_KEY",
        },
        "openai": {
            "display_name": "OpenAI",
            "litellm_provider": "openai",
            "litellm_models": ["gpt-4o-mini", "gpt-4.1-2025-04-14", "gpt-4.5-preview", "o4-mini"],
            "enabled": True,
            "token" : "",
            "token_created_at": None,
            "token_env": "OPENAI_API_KEY",
        },
        "vertex_ai": {
            "display_name": "Google Vertex AI",
            "litellm_provider": "vertex_ai",
            "litellm_models": ["gemini-1.5-flash"],
            "enabled": False,
            "token" : "",
            "token_created_at": None,
            "token_env": "VERTEX_AI_API_KEY",
        },
    }

    try:
        # Upsert each provider individually using the name as the unique identifier
        for provider, config in providers.items():
            # Skip if the provider is not supported by litellm
            if config["litellm_provider"] not in litellm.models_by_provider.keys():
                logger.error(f"Provider {config['litellm_provider']} is not supported by litellm, skipping")
                continue
            
            # Get the current provider config from MongoDB
            provider_config = await db.llm_providers.find_one({"name": provider})
            update = False

            # If the provider is not in MongoDB, create it
            if provider_config is None:
                logger.info(f"Creating provider config for {provider}")
                provider_config = {**config}
                update = True

            # Should we update the token?
            if provider_config.get("token") in [None, ""]:
                # If the token is available in the environment, set it in the config
                if os.getenv(config["token_env"]):
                    logger.info(f"Updating token for {provider}")
                    token = os.getenv(config["token_env"])
                    if len(token) > 0:
                        provider_config["token"] = ad.crypto.encrypt_token(token)
                    provider_config["token_created_at"] = datetime.now()
                    update = True

            # Get the litellm_models for the provider
            litellm_models = litellm.models_by_provider[provider]
            models = provider_config.get("litellm_models", [])
            if models is None:
                provider_config["litellm_models"] = []
                models = []
                update = True

            logger.info(f"Litellm models: {litellm_models}")
            logger.info(f"Models: {models}")

            # Eliminate unsupported models
            for model in models:
                if model not in litellm_models:
                    logger.info(f"Model {model} is not supported by {provider}, removing from provider config")
                    provider_config["litellm_models"].remove(model)
                    update = True

            # Order the litellm_models using same order from litellm.models_by_provider. If order changes, set the update flag
            litellm_models_ordered = sorted(provider_config["litellm_models"], 
                                          key=lambda x: litellm.models_by_provider[provider].index(x))
            if litellm_models_ordered != provider_config["litellm_models"]:
                logger.info(f"Litellm models ordered: {litellm_models_ordered}")
                logger.info(f"Provider config litellm_models: {provider_config['litellm_models']}")
                provider_config["litellm_models"] = litellm_models_ordered
                update = True

            if update:
                logger.info(f"Updating provider config for {provider}")
                logger.info(f"Provider config: {provider_config}")
                await db.llm_providers.update_one(
                    {"name": provider},
                    {"$set": provider_config},
                    upsert=True
                )

        # Remove any unsupported providers
        litellm_provider_list = list(litellm.models_by_provider.keys())
        # Get the list of provider litellm_provider from MongoDB    
        provider_list = []
        for provider in await db.llm_providers.find().to_list(length=None):
            provider_list.append(provider["litellm_provider"])

        logger.info(f"Provider list: {provider_list}")
        logger.info(f"Litellm provider list: {litellm_provider_list}")

        # Remove any unsupported providers
        for provider_name in provider_list:
            if provider_name not in litellm_provider_list:
                logger.info(f"Removing unsupported provider {provider_name}")
                await db.llm_providers.delete_one({"litellm_provider": provider_name})

    except Exception as e:
        logger.error(f"Failed to upsert LLM providers: {e}")

def get_llm_model_provider(llm_model: str) -> str | None:
    """
    Get the provider for a given LLM model

    Args:
        llm_model: The LLM model

    Returns:
        The provider for the given LLM model
    """
    if llm_model is None:
        return None

    for litellm_provider, litellm_models in litellm.models_by_provider.items():
        if llm_model in litellm_models:
            return litellm_provider

    # If we get here, the model is not supported by litellm
    return None