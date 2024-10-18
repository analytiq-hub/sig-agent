import gridfs
from datetime import datetime

def get_file(client, document_id: str, provider_name:str) -> dict:
    """
    Get the document
    
    Parameters
    ----------
    client: MongoClient
        The mongodb client
    document_id : str
        Document id
    provider_name : str
        Name of the provider

    Returns
    -------
    dict
        Document dataset metadata    
    """
    # Get the provider db
    db = client[provider_name]
    collection = db["documents.files"]

    # Get the doc metadata
    document = collection.find_one({"_id": document_id})
    if document is None:
        return None
    
    # Get the blob
    fs = gridfs.GridFS(db, collection='documents')
    file = fs.find_one({"_id": document_id})
    blob = file.read()

    # Add the blob to the document
    document["blob"] = blob

    return document

def save_file(client, document_id:str, blob:bytes, metadata:dict, provider_name:str):
    """
    Save the document
    
    Parameters
    ----------
    client: MongoClient
        The mongodb client
    document_id : str
        Document id
    blob : bytes
        Document blob
    metadata : dict
        Document metadata
    provider_name : str
        Name of the provider
    """
    # Get the provider db
    db = client[provider_name]
    fs = gridfs.GridFS(db, collection='documents')

    # Remove the old document
    try:
        file = fs.find_one({"_id": document_id})
        fs.delete(file._id)
    except:
        pass

    fs.put(blob, _id=document_id, metadata=metadata)

def delete_file(client, document_id:str, provider_name:str):
    """
    Delete the document
    
    Parameters
    ----------
    client: MongoClient
        The mongodb client
    document_id : str
        Document id
    provider_name : str
        Name of the provider
    """
    # Get the provider db
    db = client[provider_name]
    fs = gridfs.GridFS(db, collection='documents')

    # Remove the old document
    file = fs.find_one({"_id": document_id})
    fs.delete(file._id)