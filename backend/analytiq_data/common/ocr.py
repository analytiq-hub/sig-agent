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
   

def save_ocr_json(analytiq_client, document_id:str, ocr_json:dict, metadata:dict=None):
    """
    Save the OCR JSON
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
        ocr_json : dict
            OCR JSON
        metadata : dict
            OCR metadata
    """
    key = f"{document_id}_json"
    ad.mongodb.save_blob(analytiq_client, bucket=OCR_BUCKET, key=key, blob=ocr_json, metadata=metadata)
    
    ad.log.debug(f"OCR JSON for {document_id} has been saved.")

def delete_ocr_json(analytiq_client, document_id:str):
    """
    Delete the OCR JSON

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
    """
    key = f"{document_id}_json"
    ad.mongodb.delete_blob(analytiq_client, bucket=OCR_BUCKET, key=key)

    ad.log.debug(f"OCR JSON for {document_id} has been deleted.")

def get_ocr_text(analytiq_client, document_id:str, page_idx:int=None) -> str:
    """
    Get the OCR text
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
        page_idx : int
            page index. If None, return the whole OCR text.

    Returns:
        str
            OCR text
    """
    key = f"{document_id}_text"
    if page_idx is not None:
        key += f"_page_{page_idx}"
    return ad.mongodb.get_blob(analytiq_client, bucket=OCR_BUCKET, key=key)
   

def save_ocr_text(analytiq_client, document_id:str, ocr_text:str, page_idx:int=None, metadata:dict=None):
    """
    Save the OCR text
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
        ocr_text : str
            OCR text
        page_idx : int
            page index
        metadata : dict
            OCR metadata
    """
    key = f"{document_id}_text"
    if page_idx is not None:
        key += f"_page_{page_idx}"
    ad.mongodb.save_blob(analytiq_client, bucket=OCR_BUCKET, key=key, blob=ocr_text, metadata=metadata)
    
    ad.log.debug(f"OCR text for {document_id} page {page_idx} has been saved.")

def delete_ocr_text(analytiq_client, document_id:str, page_idx:int=None):
    """
    Delete the OCR text

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
        page_idx : int
            page index
    """
    key = f"{document_id}_text"
    if page_idx is not None:
        key += f"_page_{page_idx}"
    ad.mongodb.delete_blob(analytiq_client, bucket=OCR_BUCKET, key=key)

    ad.log.debug(f"OCR text for {document_id} page {page_idx} has been deleted.")