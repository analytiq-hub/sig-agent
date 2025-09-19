import asyncio
import json
import logging
import os
import analytiq_data as ad
import stamina

logger = logging.getLogger(__name__)


@stamina.retry(on=FileNotFoundError)
async def _ocr_get_file(analytiq_client, file_name: str):
    """
    Get file with retry mechanism for file not found errors.
    This handles race conditions where large files may not be fully committed to GridFS yet.
    """
    file = await ad.common.get_file_async(analytiq_client, file_name)
    if file is None:
        raise FileNotFoundError(f"File {file_name} not found")
    return file

async def process_ocr_msg(analytiq_client, msg, force:bool=False):
    """
    Process an OCR message

    Args:
        analytiq_client : AnalytiqClient
            The analytiq client
        msg : dict
            The OCR message
        force : bool
            Whether to force the processing
    """
    # Implement your job processing logic here
    logger.info(f"Processing OCR msg: {msg}")
    logger.info(f"Force: {force}")

    msg_id = msg["_id"]

    try:
        document_id = msg["msg"]["document_id"]

        # Get document info to check if we should skip OCR
        doc = await ad.common.doc.get_doc(analytiq_client, document_id)
        if not doc:
            logger.error(f"Document {document_id} not found. Skipping OCR.")
            return

        # Check if OCR is supported for this file
        if not ad.common.doc.ocr_supported(doc.get("user_file_name", "")):
            logger.info(f"Skipping OCR processing for structured data file: {document_id} ({doc.get('user_file_name')})")
            # Update state to OCR completed without doing OCR
            await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_COMPLETED)
            # Post a message to the llm job queue
            msg = {"document_id": document_id}
            await ad.queue.send_msg(analytiq_client, "llm", msg=msg)
            return

        # Update state to OCR processing
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_PROCESSING)
        
        # Get the AWS client. This will give None for textract if the AWS keys are not set.
        aws_client = ad.aws.get_aws_client(analytiq_client)
        if aws_client.textract is None:
            raise Exception(f"AWS textract client not created. Skipping OCR.")

        ocr_json = None
        if not force:
            # Check if the OCR text already exists
            ocr_json = ad.common.get_ocr_json(analytiq_client, document_id)
            if ocr_json is not None:
                logger.info(f"OCR list for {document_id} already exists. Skipping OCR.")        
        
        if ocr_json is None:            
            # Get the file
            doc = await ad.common.doc.get_doc(analytiq_client, document_id)
            if not doc or "mongo_file_name" not in doc:
                logger.error(f"Document metadata for {document_id} not found or missing mongo_file_name. Skipping OCR.")
                await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_FAILED)
                return

            # Use the PDF file if available, otherwise fallback to original
            pdf_file_name = doc.get("pdf_file_name")
            if pdf_file_name is None:
                logger.error(f"Document metadata for {document_id} not found or missing pdf_file_name. Skipping OCR.")
                await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_FAILED)
                return

            file = await _ocr_get_file(analytiq_client, pdf_file_name)
            if file is None:
                logger.error(f"File for {document_id} not found. Skipping OCR.")
                await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_FAILED)
                return

            # Run OCR
            ocr_json = await ad.aws.textract.run_textract(analytiq_client, file["blob"])
            logger.info(f"OCR completed for {document_id}")

            # Save the OCR dictionary
            ad.common.save_ocr_json(analytiq_client, document_id, ocr_json)
            logger.info(f"OCR list for {document_id} has been saved.")
        
        # Extract the text
        ad.common.save_ocr_text_from_list(analytiq_client, document_id, ocr_json, force=force)
        logger.info(f"OCR text for {document_id} has been saved.")
        # Update state to OCR completed
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_COMPLETED)

        # Post a message to the llm job queue
        msg = {"document_id": document_id}
        await ad.queue.send_msg(analytiq_client, "llm", msg=msg)
    
    except Exception as e:
        logger.error(f"Error processing OCR msg: {e}")
        
        # Update state to OCR failed
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_FAILED)

        # Save the message to the ocr_err queue
        await ad.queue.send_msg(analytiq_client, "ocr_err", msg=msg)

    # Delete the message from the ocr queue
    await ad.queue.delete_msg(analytiq_client, "ocr", msg_id)