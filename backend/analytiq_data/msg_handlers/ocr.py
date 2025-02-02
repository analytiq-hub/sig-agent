import asyncio
import json
import analytiq_data as ad

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
    ad.log.info(f"Processing OCR msg: {msg}")
    ad.log.info(f"Force: {force}")

    msg_id = msg["_id"]

    try:
        document_id = msg["msg"]["document_id"]
        
        # Update state to OCR processing
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_PROCESSING)
        
        # Get the AWS client. This will give None for textract if the AWS keys are not set.
        aws_client = ad.aws.get_aws_client(analytiq_client)
        if aws_client.textract is None:
            raise Exception(f"AWS textract client not created. Skipping OCR.")

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
                await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_FAILED)
                return

            # Run OCR
            ocr_list = await ad.aws.textract.run_textract(aws_client, file["blob"])
            ad.log.info(f"OCR completed for {document_id}")

            # Save the OCR dictionary
            ad.common.save_ocr_list(analytiq_client, document_id, ocr_list)
        
        # Extract the text
        ad.common.save_ocr_text_from_list(analytiq_client, document_id, ocr_list, force=force)

        # Update state to OCR completed
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_COMPLETED)

        # Post a message to the llm job queue
        msg = {"document_id": document_id}
        await ad.queue.send_msg(analytiq_client, "llm", msg=msg)
    
    except Exception as e:
        ad.log.error(f"Error processing OCR msg: {e}")
        
        # Update state to OCR failed
        await ad.common.doc.update_doc_state(analytiq_client, document_id, ad.common.doc.DOCUMENT_STATE_OCR_FAILED)

        # Save the message to the ocr_err queue
        await ad.queue.send_msg(analytiq_client, "ocr_err", msg=msg)

    # Delete the message from the ocr queue
    await ad.queue.delete_msg(analytiq_client, "ocr", msg_id)