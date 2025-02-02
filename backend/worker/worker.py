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

# Environment variables
ENV = os.getenv("ENV", "dev")
N_WORKERS = int(os.getenv("N_WORKERS", "1"))  # Convert to int with default value of 1

ad.log.info(f"ENV: {ENV}")
ad.log.info(f"N_WORKERS: {N_WORKERS}")

async def worker_ocr(worker_id: int) -> None:
    """
    Worker for OCR jobs

    Args:
        worker_id: The worker ID
    """
    # Create a separate client instance for each worker
    analytiq_client = ad.common.get_analytiq_client(env=ENV)
    ad.log.info(f"Starting OCR worker {worker_id}")

    while True:
        msg = await ad.queue.recv_msg(analytiq_client, "ocr")
        if msg:
            ad.log.info(f"Worker {worker_id} processing OCR msg: {msg}")
            await ad.msg_handlers.process_ocr_msg(analytiq_client, msg)
        else:
            await asyncio.sleep(0.2)  # Avoid tight loop

async def worker_llm(worker_id: int) -> None:
    """
    Worker for LLM jobs

    Args:
        worker_id: The worker ID
    """
    # Create a separate client instance for each worker
    analytiq_client = ad.common.get_analytiq_client(env=ENV)
    ad.log.info(f"Starting LLM worker {worker_id}")

    while True:
        msg = await ad.queue.recv_msg(analytiq_client, "llm")
        if msg:
            ad.log.info(f"Worker {worker_id} processing LLM msg: {msg}")
            await ad.msg_handlers.process_llm_msg(analytiq_client, msg)
        else:
            await asyncio.sleep(0.2)  # Avoid tight loop

async def main():
    # Create N_WORKERS workers of worker_ocr and worker_llm
    ocr_workers = [worker_ocr(i) for i in range(N_WORKERS)]
    llm_workers = [worker_llm(i) for i in range(N_WORKERS)]

    # Run all workers concurrently
    await asyncio.gather(*ocr_workers, *llm_workers)

if __name__ == "__main__":
    try:    
        asyncio.run(main())
    except KeyboardInterrupt:
        ad.log.info("Keyboard interrupt received, exiting")
