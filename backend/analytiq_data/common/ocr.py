from datetime import datetime, UTC
import os
import pickle
import analytiq_data as ad

OCR_BUCKET = "ocr"

def get_ocr_list(analytiq_client, document_id: str) -> list:
    """
    Get the OCR blocks as a list
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id

    Returns:
        list
            OCR list
    """
    key = f"{document_id}_list"
    ocr_blob = ad.mongodb.get_blob(analytiq_client, bucket=OCR_BUCKET, key=key)
    if ocr_blob is None:
        return None
    return pickle.loads(ocr_blob["blob"])
   

def save_ocr_list(analytiq_client, document_id:str, ocr_list:list, metadata:dict=None):
    """
    Save the OCR JSON
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
        ocr_list : list
            OCR list
        metadata : dict
            OCR metadata
    """
    key = f"{document_id}_list"
    # Pickle the dictionary
    ocr_bytes = pickle.dumps(ocr_list)
    ad.mongodb.save_blob(analytiq_client, bucket=OCR_BUCKET, key=key, blob=ocr_bytes, metadata=metadata)
    
    ad.log.debug(f"OCR list for {document_id} has been saved.")

def delete_ocr_list(analytiq_client, document_id:str):
    """
    Delete the OCR JSON

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
    """
    key = f"{document_id}_list"
    ad.mongodb.delete_blob(analytiq_client, bucket=OCR_BUCKET, key=key)

    ad.log.debug(f"OCR list for {document_id} has been deleted.")

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
    blob = ad.mongodb.get_blob(analytiq_client, bucket=OCR_BUCKET, key=key)
    if blob is None:
        return None
    return blob["blob"].decode("utf-8")
   

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
    
    # Convert the text to bytes 
    ocr_text_bytes = ocr_text.encode("utf-8")

    # Save the blob
    ad.mongodb.save_blob(analytiq_client, bucket=OCR_BUCKET, key=key, blob=ocr_text_bytes, metadata=metadata)
    
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

def save_ocr_text_from_list(analytiq_client, document_id:str, ocr_list:list, metadata:dict=None, force:bool=False):
    """
    Save the OCR text from the OCR list
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id
        ocr_list : list
            OCR list
        metadata : dict
            OCR metadata
        force : bool
            Whether to force the processing
    """
    block_map = ad.aws.textract.get_block_map(ocr_list)
    page_text_map = ad.aws.textract.get_page_text_map(block_map)

    if not force:
        ocr_text = get_ocr_text(analytiq_client, document_id)
        if ocr_text is not None:
            ad.log.info(f"OCR text for {document_id} already exists. Returning.")
            return
    else:
        # Remove the old OCR text, if any
        delete_ocr_text(analytiq_client, document_id)
        for page_idx in range(len(page_text_map)):
            delete_ocr_text(analytiq_client, document_id, page_idx)
    
    # Record the number of pages in the metadata
    if metadata is None:
        metadata = {}
    metadata["n_pages"] = len(page_text_map)
    
    # Save the new OCR text
    for page_num, page_text in page_text_map.items():
        page_idx = int(page_num) - 1
        save_ocr_text(analytiq_client, document_id, page_text, page_idx, metadata)

    text = "\n".join(page_text_map.values())
    save_ocr_text(analytiq_client, document_id, text, metadata=metadata)

    ad.log.info(f"OCR text for {document_id} has been saved.")

def get_ocr_n_pages(analytiq_client, document_id:str) -> int:
    """
    Get the number of pages in the OCR text

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id : str
            document id

    Returns:
        int
            Number of pages in the OCR text
    """
    key = f"{document_id}_text"
    blob = ad.mongodb.get_blob(analytiq_client, bucket=OCR_BUCKET, key=key)
    if blob is None:
        return 0
    return blob["metadata"]["n_pages"]
