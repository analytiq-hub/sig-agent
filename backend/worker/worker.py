#!/usr/bin/env python3
import os
import sys
from dotenv import load_dotenv
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# Add the parent directory to the sys path
sys.path.append("..")
import analytiq_data as ad

# Set up the environment variables. This reads the .env file.
ad.common.setup()

# Initialize the logger
ad.init_logger("worker")

# Environment variables
ENV = os.getenv("ENV", "dev")

client = ad.common.get_client(env=ENV)
db_name = "prod" if ENV == "prod" else "dev"
db = client.mongodb_async[db_name]
job_queue_collection = db.job_queue

async def process_job(job):
    # Implement your job processing logic here
    print(f"Processing job: {job['_id']}")
    # Simulate work
    await asyncio.sleep(10)
    await job_queue_collection.update_one({"_id": job["_id"]}, {"$set": {"status": "completed"}})

async def worker():
    while True:
        job = await job_queue_collection.find_one_and_update(
            {"status": "pending"},
            {"$set": {"status": "processing"}},
            sort=[("created_at", 1)]
        )
        if job:
            ad.log.info(f"Processing job: {job['_id']}")
            await process_job(job)
        else:
            await asyncio.sleep(.2)  # Avoid tight loop

if __name__ == "__main__":
    try:    
        asyncio.run(worker())
    except KeyboardInterrupt:
        ad.log.info("Keyboard interrupt received, exiting")
