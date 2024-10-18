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
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    env = os.getenv("ENV", "dev")
    if env == "prod" and mongo_uri == "mongodb://localhost:27017":
        raise ValueError("MONGODB_URI is not set for prod")
    client = AsyncIOMotorClient(mongo_uri)
    return client[env]
