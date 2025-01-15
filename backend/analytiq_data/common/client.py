import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import analytiq_data as ad

class AnalytiqClient:
    def __init__(self, env: str = "dev"):
        self.env = env
        self.mongodb_async = ad.mongodb.get_mongodb_client_async(env)
        self.mongodb = ad.mongodb.get_mongodb_client(env)

def get_analytiq_client(env: str = os.getenv("ENV", "dev")) -> AnalytiqClient:
    """
    Get the AnalytiqClient.

    Args:
        env: The environment to connect to. Defaults to the environment variable "ENV".

    Returns:
        The AnalytiqClient.
    """
    return AnalytiqClient(env)

def get_db(analytiq_client: AnalytiqClient = get_analytiq_client()) -> MongoClient:
    """
    Get the MongoDB client.

    Args:
        analytiq_client: The AnalytiqClient. Defaults to the current environment client.

    Returns:
        The MongoDB client.
    """
    return analytiq_client.mongodb[analytiq_client.env]

def get_async_db(analytiq_client: AnalytiqClient = get_analytiq_client()) -> AsyncIOMotorClient:
    """
    Get the async MongoDB client.

    Args:
        analytiq_client: The AnalytiqClient. Defaults to the current environment client.

    Returns:
        The async MongoDB client.
    """
    return analytiq_client.mongodb_async[analytiq_client.env]
