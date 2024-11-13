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

    ocr_dict = None
    if not force:
        # Check if the OCR text already exists
        ocr_dict = ad.common.get_ocr_dict(analytiq_client, document_id)
        if ocr_dict is not None:
            ad.log.info(f"OCR dictionary for {document_id} already exists. Skipping OCR.")        
    
    if ocr_dict is None:
        # Get the file
        mongo_file_name = f"{document_id}.pdf"
        file = ad.common.get_file(analytiq_client, mongo_file_name)
        if file is None:
            ad.log.error(f"File for {document_id} not found. Skipping OCR.")
            return
        # Run OCR
        ocr_dict = ad.aws.textract.run_textract(aws_client, file["blob"])
        ad.log.info(f"OCR completed for {document_id}")

        # Save the OCR dictionary
        ad.common.save_ocr_dict(analytiq_client, document_id, ocr_dict)
    
    # Extract the text
    ad.common.save_ocr_text_from_dict(analytiq_client, document_id, ocr_dict, force=force)

    # Set the document state to OCR completed
    ad.common.set_document_state(analytiq_client, document_id, "OCR completed")

    await ad.queue.delete_msg(analytiq_client, "ocr", msg["_id"])
