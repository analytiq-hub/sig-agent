import os
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
import ssl
import json

import analytiq_data as ad

def get_mongodb_client():
    """
    Get the MongoDB client.
    """
    mongo_uri = os.getenv("MONGODB_URI", "")
    if mongo_uri == "":
        raise ValueError("MONGODB_URI is not set")
    env = os.getenv("ENV", "dev")
    client = AsyncIOMotorClient(mongo_uri)
    return client[env]
