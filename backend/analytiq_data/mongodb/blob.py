import gridfs
from datetime import datetime, UTC
import os
import time

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
    elem = collection.find_one({"filename": key})
    if elem is None:
        return None
    metadata = elem.get("metadata", None)
    
    # Get the blob
    fs = gridfs.GridFS(db, collection=bucket)
    elem = fs.find_one({"filename": key})
    blob = elem.read()

    blob_dict = {
        "blob": blob,
        "metadata": metadata
    }

    return blob_dict

def save_blob(analytiq_client, bucket: str, key: str, blob: bytes, metadata: dict, chunk_size_bytes: int = 64*1024*1024):
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
        chunk_size_bytes : int
            chunk size in bytes
    """
    # Get the db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    fs_bucket = gridfs.GridFSBucket(db, bucket_name=bucket)

    # Remove the old blob with retry logic
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            old_blob = fs_bucket.find({"filename": key})
            old_blobs = list(old_blob)
            if old_blobs:
                ad.log.debug(f"Deleting old blob {bucket}/{key} from mongodb.")
                for blob_item in old_blobs:
                    fs_bucket.delete(blob_item._id)
                
                # Verify deletion is complete
                verification_attempts = 3
                for _ in range(verification_attempts):
                    check_blob = list(fs_bucket.find({"filename": key}))
                    if not check_blob:
                        ad.log.debug(f"Old blob {bucket}/{key} deletion verified.")
                        break
                    time.sleep(retry_delay)
                else:
                    raise Exception("Failed to verify deletion")
                
            break  # Exit retry loop if successful
        except Exception as e:
            if attempt == max_retries - 1:
                ad.log.error(f"Failed to delete old blob {bucket}/{key} after {max_retries} attempts: {e}")
                raise
            ad.log.warning(f"Retry {attempt + 1}/{max_retries} for deleting {bucket}/{key}: {e}")
            time.sleep(retry_delay)

    # Create a new GridFS bucket to ensure clean state
    fs_bucket = gridfs.GridFSBucket(db, bucket_name=bucket)
    
    ad.log.debug(f"Uploading blob {bucket}/{key} to mongodb.")
    fs_bucket.upload_from_stream(filename=key, source=blob, chunk_size_bytes=chunk_size_bytes, metadata=metadata)

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
    blob = fs.find_one({"filename": key})
    if blob is not None:
        fs.delete(blob._id)
        ad.log.debug(f"Blob {bucket}/{key} has been deleted.")