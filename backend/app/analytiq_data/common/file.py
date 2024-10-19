import gridfs
from datetime import datetime, UTC
import os

import analytiq_data as ad

def get_file(analytiq_client, file_name: str) -> dict:
    """
    Get the file
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name : str
            file name

    Returns:
        dict
            file dataset metadata    
    """
    # Get the provider db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db["files.files"]

    # Get the doc metadata
    elem = collection.find_one({"name": file_name})
    if elem is None:
        return None
    metadata = elem["metadata"]
    
    # Get the blob
    fs = gridfs.GridFS(db, collection="files")
    elem = fs.find_one({"name": file_name})
    blob = elem.read()

    file = {
        "blob": blob,
        "metadata": metadata
    }

    return file

def save_file(analytiq_client, file_name:str, blob:bytes, metadata:dict):
    """
    Save the file
    
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
    # Get the db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    fs = gridfs.GridFS(db, collection='files')

    # Remove the old file
    try:
        file = fs.find_one({"name": file_name})
        fs.delete(file._id)
        ad.log.debug(f"File {file_name} has been deleted.")
    except:
        pass

    fs.put(blob, name=file_name, metadata=metadata)
    ad.log.debug(f"File {file_name} has been saved.")

def delete_file(analytiq_client, file_name:str):
    """
    Delete the file

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name : str
            File name
    """
    # Get the db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    fs = gridfs.GridFS(db, collection='files')

    # Remove the old file
    file = fs.find_one({"name": file_name})
    fs.delete(file._id)
    ad.log.debug(f"File {file_name} has been deleted.")

def upload_pdf(analytiq_client, file_path: str):
    """
    Read a PDF file and save it using the file API
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_path : str
            Path to the PDF file
    """
    # Check if the file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file {file_path} does not exist.")

    # Read the PDF file
    with open(file_path, 'rb') as file:
        blob = file.read()

    # Get the file name from the path
    file_name = os.path.basename(file_path)

    # Create metadata
    metadata = {
        "name": file_name,
        "type": "application/pdf",
        "size": len(blob),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    }

    # Save the file using the save_file function
    save_file(analytiq_client, file_name, blob, metadata)