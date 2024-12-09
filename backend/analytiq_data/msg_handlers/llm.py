import asyncio
import openai
import analytiq_data as ad


async def process_llm_msg(analytiq_client, msg):
    ad.log.info(f"Processing LLM msg: {msg}")

    document_id = msg["msg"]["document_id"]
    
    try:
        # Update state to LLM processing
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_LLM_PROCESSING)

        llm_key = await ad.llm.get_llm_key(analytiq_client)
        await ad.llm.run_llm(analytiq_client, document_id)

        # Update state to LLM completed
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_LLM_COMPLETED)
        
        ad.log.info(f"LLM run completed for {document_id}")
    except Exception as e:
        ad.log.error(f"Error processing LLM msg: {e}")
        
        # Update state to LLM failed
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_LLM_FAILED)
        
        # Could add LLM error queue handling here if needed
        
    await ad.queue.delete_msg(analytiq_client, "llm", msg["_id"])