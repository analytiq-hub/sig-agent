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

ad.log.info(f"ENV: {ENV}")

client = ad.common.get_analytiq_client(env=ENV)
db_name = "prod" if client.env == "prod" else "dev"
db = client.mongodb_async[db_name]
job_queue_collection = db.job_queue

async def worker_ocr():
    while True:
        msg = await ad.queue.recv_msg(client, "ocr")
        if msg:
            ad.log.info(f"Processing OCR msg: {msg}")
            await ad.msg_handlers.process_ocr_msg(msg)
        else:
            await asyncio.sleep(0.2)  # Avoid tight loop

async def worker_llm():
    while True:
        msg = await ad.queue.recv_msg(client, "llm")
        if msg:
            ad.log.info(f"Processing LLM msg: {msg}")
            await ad.msg_handlers.process_llm_msg(msg)
        else:
            await asyncio.sleep(0.2)  # Avoid tight loop

async def main():
    # Run both workers concurrently
    await asyncio.gather(
        worker_ocr(),
        worker_llm()
    )

if __name__ == "__main__":
    try:    
        asyncio.run(main())
    except KeyboardInterrupt:
        ad.log.info("Keyboard interrupt received, exiting")
