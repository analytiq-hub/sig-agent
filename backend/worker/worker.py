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
db_name = "prod" if client.env == "prod" else "dev"
db = client.mongodb_async[db_name]
job_queue_collection = db.job_queue

async def process_ocr_msg(msg):
    # Implement your job processing logic here
    print(f"Processing msg: {msg}")
    # Simulate work
    await asyncio.sleep(10)
    await ad.queue.delete_msg(client, "ocr", msg["_id"])

async def worker():
    while True:
        msg = await ad.queue.recv_msg(client, "ocr")
        if msg:
            ad.log.info(f"Processing msg: {msg}")
            await process_ocr_msg(msg)
        else:
            tmo = 0.2
            await asyncio.sleep(tmo)  # Avoid tight loop

if __name__ == "__main__":
    try:    
        asyncio.run(worker())
    except KeyboardInterrupt:
        ad.log.info("Keyboard interrupt received, exiting")
