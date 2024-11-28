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

async def worker_ocr(analytiq_client) -> None:
    """
    Worker for OCR jobs

    Args:
        analytiq_client: The Analytiq client
    """
    while True:
        msg = await ad.queue.recv_msg(analytiq_client, "ocr")
        if msg:
            ad.log.info(f"Processing OCR msg: {msg}")
            await ad.msg_handlers.process_ocr_msg(analytiq_client, msg)
        else:
            await asyncio.sleep(0.2)  # Avoid tight loop

async def worker_llm(analytiq_client) -> None:
    """
    Worker for LLM jobs

    Args:
        analytiq_client: The Analytiq client
    """
    while True:
        msg = await ad.queue.recv_msg(analytiq_client, "llm")
        if msg:
            ad.log.info(f"Processing LLM msg: {msg}")
            await ad.msg_handlers.process_llm_msg(analytiq_client, msg)
        else:
            await asyncio.sleep(0.2)  # Avoid tight loop

async def main():
    analytiq_client = ad.common.get_analytiq_client(env=ENV)

    # Run both workers concurrently
    await asyncio.gather(
        worker_ocr(analytiq_client),
        worker_llm(analytiq_client)
    )

if __name__ == "__main__":
    try:    
        asyncio.run(main())
    except KeyboardInterrupt:
        ad.log.info("Keyboard interrupt received, exiting")
