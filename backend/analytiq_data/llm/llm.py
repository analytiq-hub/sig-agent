import analytiq_data as ad

async def run_llm(analytiq_client, document_id: str):
    llm_key = await ad.llm.get_llm_key(analytiq_client)
    ocr_text = ad.common.get_ocr_text(analytiq_client, document_id)

    ad.log.info(f"{document_id}: OCR text: {ocr_text}")