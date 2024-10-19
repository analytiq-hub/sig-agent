import gridfs
from datetime import datetime, UTC
import os

import analytiq_data as ad

def get_blob(analytiq_client, bucket: str, key: str) -> dict:
    """
    Get the file
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        bucket : str
            bucket name
        key : str
            blob key

    Returns:
        dict
            {"blob": bytes, "metadata": dict}
    """
    # Get the provider db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db[f"{bucket}.files"]

    # Get the doc metadata
    elem = collection.find_one({"name": key})
    if elem is None:
        return None
    metadata = elem["metadata"]
    
    # Get the blob
    fs = gridfs.GridFS(db, collection=bucket)
    elem = fs.find_one({"name": key})
    blob = elem.read()

    blob_dict = {
        "blob": blob,
        "metadata": metadata
    }

    return blob_dict

def save_blob(analytiq_client, bucket:str, key:str, blob:bytes, metadata:dict):
    """
    Save the file
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        bucket : str
            bucket name
        key : str
            blob key
        blob : bytes
            blob blob
        metadata : dict
            blob metadata
    """
    # Get the db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    fs = gridfs.GridFS(db, collection=bucket)

    # Remove the old blob
    try:
        old_blob = fs.find_one({"name": key})
        fs.delete(old_blob._id)
        ad.log.debug(f"Old blob {bucket}/{key} has been deleted.")
    except:
        pass

    fs.put(blob, name=key, metadata=metadata)

def delete_blob(analytiq_client, bucket:str, key:str):
    """
    Delete the blob

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        bucket : str
            bucket name
        key : str
            blob key
    """
    # Get the db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    fs = gridfs.GridFS(db, collection=bucket)

    # Remove the old blob
    blob = fs.find_one({"name": key})
    fs.delete(blob._id)
    ad.log.debug(f"Blob {bucket}/{key} has been deleted.")