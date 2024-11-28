import os
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
import ssl
import json

import analytiq_data as ad

def get_mongodb_client_async(env: str = "dev") -> AsyncIOMotorClient:
    """
    Get the MongoDB client.

    Args:
        env: The environment to connect to. Defaults to "dev".

    Returns:
        The MongoDB client.
    """
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    return client

def get_mongodb_client(env: str = "dev") -> MongoClient:
    """
    Get the MongoDB client.

    Args:
        env: The environment to connect to. Defaults to "dev".

    Returns:
        The MongoDB client.
    """
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = MongoClient(mongo_uri,
                         w='majority', # write operations will wait for a majority of the replica set members to acknowledge the write before returning successfully
                         retryWrites=False, # retryWrites not supported in AWS DocumentDB
                         readPreference="secondaryPreferred") 
    return client
