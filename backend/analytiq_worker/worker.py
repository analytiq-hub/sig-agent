#!/usr/bin/env python3
import os
import sys
from dotenv import load_dotenv
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient


async def process_job(job):
    # Implement your job processing logic here
    print(f"Processing job: {job['_id']}")
    # Simulate work
    await asyncio.sleep(10)
    await queue_collection.update_one({"_id": job["_id"]}, {"$set": {"status": "completed"}})

async def worker():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.your_database
    queue_collection = db.job_queue

    while True:
        job = await queue_collection.find_one_and_update(
            {"status": "pending"},
            {"$set": {"status": "processing"}},
            sort=[("created_at", 1)]
        )
        if job:
            await process_job(job)
        else:
            await asyncio.sleep(1)  # Avoid tight loop

if __name__ == "__main__":
    # Add the parent directory to the sys path
    sys.path.append("..")
    import analytiq_data as ad

    # Get the current directory
    CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

    # Load the .env file
    if not load_dotenv(dotenv_path="../.env", verbose=True):
        raise Exception("Failed to load ../.env file")

    # Initialize the logger
    ad.init_logger("fastapi")

    asyncio.run(worker())
