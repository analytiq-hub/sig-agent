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
    client = AsyncIOMotorClient(mongo_uri)
    return client
