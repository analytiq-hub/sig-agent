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
    return ad.mongodb.get_blob(analytiq_client, bucket="files", key=file_name)
   

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
    ad.mongodb.save_blob(analytiq_client, bucket="files", key=file_name, blob=blob, metadata=metadata)
    
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
    ad.mongodb.delete_blob(analytiq_client, bucket="files", key=file_name)

    ad.log.debug(f"File {file_name} has been deleted.")

def upload_file(analytiq_client, file_path: str, file_type: str = "application/pdf"):
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
        "type": file_type,
        "size": len(blob),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    }

    # Save the file using the save_file function
    save_file(analytiq_client, file_name, blob, metadata)

def download_file(analytiq_client, file_name: str, output_path: str):
    """
    Download the file

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name: str
            File name
        output_path: str
            Output path
    """
    file = get_file(analytiq_client, file_name)
    with open(output_path, "wb") as file:
        file.write(file["blob"])


# Download all the files from the database
def download_all_files(analytiq_client, output_dir: str):
    """
    Download all the files from the database

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        output_dir : str
            Output directory
    """
    # Get the db
    mongo = analytiq_client.mongodb
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db["files.files"]

    # Get all the files
    cursor = collection.find()
    files = cursor.to_list(length=None)

    # Download each file
    for file in files:
        file_name = file["name"]
        file = get_file(analytiq_client, file_name)
        file_blob = file["blob"]
        file_metadata = file["metadata"]

        # Save the file to the output directory
        file_path = os.path.join(output_dir, file_name)
        with open(file_path, "wb") as file:
            file.write(file_blob)