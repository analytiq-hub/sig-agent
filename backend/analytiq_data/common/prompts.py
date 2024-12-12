from datetime import datetime, UTC
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

import analytiq_data as ad

async def get_prompt_id(analytiq_client, prompt_name: str) -> str:
    """
    Get a prompt ID by its name

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        prompt_name: str
            Prompt name

    Returns:
        str
            Prompt ID
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompts"]
    elem = await collection.find_one({"name": prompt_name})
    if elem is None:
        raise ValueError(f"Prompt {prompt_name} not found")
    return str(elem["_id"])

async def get_prompt_name(analytiq_client, prompt_id: str) -> str:
    """
    Get a prompt name by its ID
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompts"]
    elem = await collection.find_one({"_id": ObjectId(prompt_id)})
    if elem is None:
        raise ValueError(f"Prompt {prompt_id} not found")
    return elem["name"]

async def get_prompt_content(analytiq_client, prompt_id: str) -> str:
    """
    Get a prompt content by its ID
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        prompt_id: str
            Prompt ID

    Returns:
        str
            Prompt content
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompts"]
    
    elem = await collection.find_one({"_id": ObjectId(prompt_id)})
    if elem is None:
        raise ValueError(f"Prompt {prompt_id} not found")
    return elem["content"]
