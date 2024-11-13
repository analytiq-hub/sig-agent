import asyncio
import analytiq_data as ad

async def process_llm_msg(analytiq_client, msg):
    # Implement your LLM job processing logic here
    ad.log.info(f"Processing LLM msg: {msg}")
    # Simulate work
    await asyncio.sleep(5)
    await ad.queue.delete_msg(analytiq_client, "llm", msg["_id"])