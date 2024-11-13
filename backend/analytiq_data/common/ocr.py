from datetime import datetime, UTC
import os

import analytiq_data as ad

OCR_BUCKET = "ocr"

def get_ocr_json(analytiq_client, document_id: str) -> dict:
    """
    Get the OCR JSON
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id

    Returns:
        dict
            OCR JSON
    """
    key = f"{document_id}_json"
    return ad.mongodb.get_blob(analytiq_client, bucket=OCR_BUCKET, key=key)
   

def save_ocr_json(analytiq_client, document_id:str, ocr_json:dict, metadata:dict):
    """
    Save the OCR JSON
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name : str
            file name
        blob : bytes
            file blob
        metadata : dict
            file metadata
    """
    key = f"{document_id}_json"
    ad.mongodb.save_blob(analytiq_client, bucket=OCR_BUCKET, key=key, blob=ocr_json, metadata=metadata)
    
    ad.log.debug(f"OCR JSON for {document_id} has been saved.")

def delete_ocr_json(analytiq_client, document_id:str):
    """
    Delete the file

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name : str
            File name
    """
    key = f"{document_id}_json"
    ad.mongodb.delete_blob(analytiq_client, bucket=OCR_BUCKET, key=key)

    ad.log.debug(f"OCR JSON for {document_id} has been deleted.")