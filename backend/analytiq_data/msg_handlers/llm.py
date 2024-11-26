import asyncio
import openai
import analytiq_data as ad


async def process_llm_msg(analytiq_client, msg):
    # Implement your LLM job processing logic here
    ad.log.info(f"Processing LLM msg: {msg}")

    llm_key = await ad.llm.get_llm_key(analytiq_client)

    # Get the entire document text from MongoDB
    document_id = msg["msg"]["document_id"]

    await ad.llm.run_llm(analytiq_client, document_id)

    ad.log.info(f"LLM run completed for {document_id}")
    await ad.queue.delete_msg(analytiq_client, "llm", msg["_id"])