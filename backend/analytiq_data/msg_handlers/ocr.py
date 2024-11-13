import asyncio
import analytiq_data as ad

async def process_ocr_msg(analytiq_client, msg):
    # Implement your job processing logic here
    ad.log.info(f"Processing OCR msg: {msg}")

    document_id = msg["document_id"]

    # Simulate work
    await asyncio.sleep(1)
    await ad.queue.delete_msg(analytiq_client, "ocr", msg["_id"])
