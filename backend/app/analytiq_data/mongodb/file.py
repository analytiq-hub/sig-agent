import gridfs
from datetime import datetime

def get_file(analytiq_client, file_id: str, acct_name:str) -> dict:
    """
    Get the file
    
    Parameters
    ----------
    analytiq_client: AnalytiqClient
        The analytiq client
    file_id : str
        file id
    acct_name : str
        Name of the account

    Returns
    -------
    dict
        file dataset metadata    
    """
    # Get the provider db
    db = analytiq_client[analytiq_client.env]
    collection = db["files"]

    # Get the doc metadata
    file = collection.find_one({"_id": file_id})
    if file is None:
        return None
    
    # Get the blob
    fs = gridfs.GridFS(db, collection='files')
    file = fs.find_one({"_id": file_id})
    blob = file.read()

    # Add the blob to the file
    file["blob"] = blob

    return file

def save_file(analytiq_client, file_id:str, blob:bytes, metadata:dict, acct_name:str):
    """
    Save the file
    
    Parameters
    ----------
    analytiq_client: AnalytiqClient
        The analytiq client
    file_id : str
        file id
    blob : bytes
        file blob
    metadata : dict
        file metadata
    acct_name : str
        Name of the account
    """
    # Get the db
    db = analytiq_client[analytiq_client.env]
    fs = gridfs.GridFS(db, collection='files')

    # Remove the old file
    try:
        file = fs.find_one({"_id": file_id})
        fs.delete(file._id)
    except:
        pass

    fs.put(blob, _id=file_id, metadata=metadata)

def delete_file(analytiq_client, file_id:str, acct_name:str):
    """
    Delete the file
    
    Parameters
    ----------
    analytiq_client: AnalytiqClient
        The analytiq client
    file_id : str
        File id
    acct_name : str
        Name of the account
    """
    # Get the db
    db = analytiq_client[analytiq_client.env]
    fs = gridfs.GridFS(db, collection='files')

    # Remove the old file
    file = fs.find_one({"_id": file_id})
    fs.delete(file._id)