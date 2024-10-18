import os
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
import ssl
import json

import analytiq_data as ad

def get_mongodb_client() -> AsyncIOMotorClient:
    """
    Get the MongoDB client.
    """
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
    return client

async def close_mongodb_client(client: AsyncIOMotorClient):
    """
    Close the MongoDB client.
    """
    await client.close()
