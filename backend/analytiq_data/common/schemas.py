from datetime import datetime, UTC
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

import analytiq_data as ad

async def get_schema_id(analytiq_client, schema_name: str, schema_version: int) -> str:
    """
    Get a schema ID by its name and version

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        schema_name: str
            Schema name
        schema_version: int
            Schema version. Must be an integer starting from 1.

    Returns:
        str
            Schema ID
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["schemas"]
    elem = await collection.find_one({"name": schema_name, "version": schema_version})
    if elem is None:
        raise ValueError(f"Schema {schema_name} version {schema_version} not found")
    return str(elem["_id"])