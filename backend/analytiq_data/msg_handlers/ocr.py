import asyncio
import analytiq_data as ad

async def process_ocr_msg(msg):
    # Implement your job processing logic here
    ad.log.info(f"Processing OCR msg: {msg}")
    # Simulate work
    await asyncio.sleep(10)
    await ad.queue.delete_msg(client, "ocr", msg["_id"])
