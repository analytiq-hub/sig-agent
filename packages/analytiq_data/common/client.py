import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import analytiq_data as ad

class AnalytiqClient:
    def __init__(self, env: str = "dev", name: str = None):
        self.env = env
        self.name = name
        self.mongodb_async = ad.mongodb.get_mongodb_client_async(env)

def get_analytiq_client(env: str = None, name: str = None) -> AnalytiqClient:
    """
    Get the AnalytiqClient.

    Args:
        env: The environment to connect to. Defaults to the environment variable "ENV".

    Returns:
        The AnalytiqClient.
    """
    if not env:
        env = os.getenv("ENV", "dev")
    return AnalytiqClient(env, name)

def get_async_db(analytiq_client: AnalytiqClient = None) -> AsyncIOMotorClient:
    """
    Get the async MongoDB client.

    Args:
        analytiq_client: The AnalytiqClient. Defaults to the current environment client.

    Returns:
        The async MongoDB client.
    """
    if not analytiq_client:
        analytiq_client = get_analytiq_client()
    return analytiq_client.mongodb_async[analytiq_client.env]
