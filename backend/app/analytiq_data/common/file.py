import gridfs
from datetime import datetime

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
    collection = db["files"]

    # Get the doc metadata
    file = collection.find_one({"name": file_name})
    if file is None:
        return None
    
    # Get the blob
    fs = gridfs.GridFS(db, collection='files')
    file = fs.find_one({"name": file_name})
    blob = file.read()

    # Add the blob to the file
    file["blob"] = blob

    return file

def save_file(analytiq_client, file_id:str, blob:bytes, metadata:dict):
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
    except:
        pass

    fs.put(blob, _id=file_id, metadata=metadata)

def delete_file(analytiq_client, file_id:str):
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