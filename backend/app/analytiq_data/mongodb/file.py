import gridfs
from datetime import datetime

def get_file(analytiq_client, file_id: str, acct_name:str) -> dict:
    """
    Get the document
    
    Parameters
    ----------
    analytiq_client: AnalytiqClient
        The analytiq client
    file_id : str
        Document id
    acct_name : str
        Name of the account

    Returns
    -------
    dict
        Document dataset metadata    
    """
    # Get the provider db
    db = analytiq_client[analytiq_client.env]
    collection = db["files"]

    # Get the doc metadata
    document = collection.find_one({"_id": file_id})
    if document is None:
        return None
    
    # Get the blob
    fs = gridfs.GridFS(db, collection='files')
    file = fs.find_one({"_id": file_id})
    blob = file.read()

    # Add the blob to the document
    document["blob"] = blob

    return document

def save_file(analytiq_client, file_id:str, blob:bytes, metadata:dict, acct_name:str):
    """
    Save the document
    
    Parameters
    ----------
    analytiq_client: AnalytiqClient
        The analytiq client
    file_id : str
        Document id
    blob : bytes
        Document blob
    metadata : dict
        Document metadata
    acct_name : str
        Name of the account
    """
    # Get the db
    db = analytiq_client[analytiq_client.env]
    fs = gridfs.GridFS(db, collection='files')

    # Remove the old document
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

    # Remove the old document
    file = fs.find_one({"_id": file_id})
    fs.delete(file._id)