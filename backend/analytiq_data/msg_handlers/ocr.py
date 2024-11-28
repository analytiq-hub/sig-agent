import asyncio
import json
import analytiq_data as ad

async def process_ocr_msg(analytiq_client, aws_client, msg, force:bool=False):
    """
    Process an OCR message

    Args:
        analytiq_client : AnalytiqClient
            The analytiq client
        aws_client : AwsClient
            The aws client
        msg : dict
            The OCR message
        force : bool
            Whether to force the processing
    """
    # Implement your job processing logic here
    ad.log.info(f"Processing OCR msg: {msg}")
    ad.log.info(f"Force: {force}")

    document_id = msg["msg"]["document_id"]

    ocr_list = None
    if not force:
        # Check if the OCR text already exists
        ocr_list = ad.common.get_ocr_list(analytiq_client, document_id)
        if ocr_list is not None:
            ad.log.info(f"OCR list for {document_id} already exists. Skipping OCR.")        
    
    if ocr_list is None:
        # Get the file
        mongo_file_name = f"{document_id}.pdf"
        file = ad.common.get_file(analytiq_client, mongo_file_name)
        if file is None:
            ad.log.error(f"File for {document_id} not found. Skipping OCR.")
            return

        # TO DO: read from config the OCR type, and run tesseract OCR instead of Textract

        # Run OCR
        ocr_list = ad.aws.textract.run_textract(aws_client, file["blob"])
        ad.log.info(f"OCR completed for {document_id}")

        # Save the OCR dictionary
        ad.common.save_ocr_list(analytiq_client, document_id, ocr_list)
    
    # Extract the text
    ad.common.save_ocr_text_from_list(analytiq_client, document_id, ocr_list, force=force)

    # Set the document state to OCR completed
    # TODO: implement
    # ad.common.set_document_state(analytiq_client, document_id, "OCR completed")

    await ad.queue.delete_msg(analytiq_client, "ocr", msg["_id"])

    # Post a message to the llm job queue
    msg = {"document_id": document_id}
    await ad.queue.send_msg(analytiq_client, "llm", msg=msg)