from datetime import datetime, UTC
import os
import subprocess
import tempfile
import logging
import platform

import analytiq_data as ad
from filelock import FileLock

# Use a lock file in /tmp so all processes (tests and app) share it
LIBREOFFICE_LOCK_PATH = "/tmp/libreoffice.lock"
libreoffice_filelock = FileLock(LIBREOFFICE_LOCK_PATH)

logger = logging.getLogger(__name__)

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
    
    logger.debug(f"File {file_name} has been saved.")

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

    logger.debug(f"File {file_name} has been deleted.")

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

async def get_file_async(analytiq_client, file_name: str) -> dict:
    """
    Get the file asynchronously
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name : str
            file name

    Returns:
        dict
            file dataset metadata    
    """
    return await ad.mongodb.get_blob_async(analytiq_client, bucket="files", key=file_name)

async def save_file_async(analytiq_client, file_name:str, blob:bytes, metadata:dict):
    """
    Save the file asynchronously
    
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
    await ad.mongodb.save_blob_async(analytiq_client, bucket="files", key=file_name, blob=blob, metadata=metadata)
    logger.debug(f"File {file_name} has been saved.")

async def delete_file_async(analytiq_client, file_name:str):
    """
    Delete the file asynchronously

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name : str
            File name
    """
    await ad.mongodb.delete_blob_async(analytiq_client, bucket="files", key=file_name)
    logger.debug(f"File {file_name} has been deleted.")

async def upload_file_async(analytiq_client, file_path: str, file_type: str = "application/pdf"):
    """
    Read a PDF file and save it using the file API asynchronously
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_path : str
            Path to the PDF file
        file_type : str
            Type of the file
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
    await save_file_async(analytiq_client, file_name, blob, metadata)

async def download_file_async(analytiq_client, file_name: str, output_path: str):
    """
    Download the file asynchronously

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        file_name: str
            File name
        output_path: str
            Output path
    """
    file = await get_file_async(analytiq_client, file_name)
    with open(output_path, "wb") as f:
        f.write(file["blob"])

async def download_all_files_async(analytiq_client, output_dir: str):
    """
    Download all the files from the database asynchronously

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        output_dir : str
            Output directory
    """
    # Get the db
    mongo = analytiq_client.mongodb_async
    db_name = analytiq_client.env
    db = mongo[db_name]
    collection = db["files.files"]

    # Get all the files
    cursor = collection.find()
    files = await cursor.to_list(length=None)

    # Download each file
    for file in files:
        file_name = file["filename"]
        file_data = await get_file_async(analytiq_client, file_name)
        file_blob = file_data["blob"]
        
        # Save the file to the output directory
        file_path = os.path.join(output_dir, file_name)
        with open(file_path, "wb") as f:
            f.write(file_blob)

def convert_to_pdf(blob: bytes, ext: str) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as input_file:
        input_file.write(blob)
        input_file.flush()
        input_path = input_file.name

    output_path = input_path.replace(ext, ".pdf")
    
    # Determine the correct LibreOffice command based on OS
    if platform.system() == "Darwin":  # macOS
        libreoffice_cmd = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    else:  # Linux and other Unix-like systems
        libreoffice_cmd = "libreoffice"
    
    with libreoffice_filelock:
        subprocess.run([
            libreoffice_cmd,
            "--headless",
            "--convert-to", "pdf",
            "--outdir", os.path.dirname(input_path),
            input_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    with open(output_path, "rb") as f:
        pdf_blob = f.read()

    os.remove(input_path)
    os.remove(output_path)
    return pdf_blob