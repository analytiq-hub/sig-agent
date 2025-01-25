from datetime import datetime, UTC
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

import analytiq_data as ad

DOCUMENT_STATE_UPLOADED = "uploaded"
DOCUMENT_STATE_OCR_PROCESSING = "ocr_processing" 
DOCUMENT_STATE_OCR_COMPLETED = "ocr_completed"
DOCUMENT_STATE_OCR_FAILED = "ocr_failed"
DOCUMENT_STATE_LLM_PROCESSING = "llm_processing"
DOCUMENT_STATE_LLM_COMPLETED = "llm_completed"
DOCUMENT_STATE_LLM_FAILED = "llm_failed"

async def get_doc(analytiq_client, document_id: str, organization_id: str | None = None) -> dict:
    """
    Get a document by its ID within an organization
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id: str
            Document ID
        organization_id: str | None
            Organization ID. If None, will not filter by organization.

    Returns:
        dict
            Document metadata    
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["docs"]
    
    # Build query based on whether organization_id is provided
    query = {"_id": ObjectId(document_id)}
    if organization_id:
        query["organization_id"] = organization_id
    
    return await collection.find_one(query)

async def save_doc(analytiq_client, document: dict) -> str:
    """
    Save a document (organization_id should be included in document)
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document: dict
            Document metadata to save

    Returns:
        str
            Document ID of the saved document
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    
    if "_id" not in document:
        document["_id"] = ObjectId()
    
    if "organization_id" not in document:
        raise ValueError("organization_id is required")
    
    await db.docs.replace_one(
        {
            "_id": document["_id"],
            "organization_id": document["organization_id"]
        },
        document,
        upsert=True
    )
    
    ad.log.debug(f"Document {document['_id']} has been saved.")
    return str(document["_id"])

async def delete_doc(analytiq_client, document_id: str, organization_id: str):
    """
    Delete a document within an organization
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id: str
            Document ID to delete
        organization_id: str
            Organization ID
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["docs"]
    
    await collection.delete_one({
        "_id": ObjectId(document_id),
        "organization_id": organization_id
    })
    ad.log.debug(f"Document {document_id} has been deleted.")

async def list_docs(analytiq_client, skip: int = 0, limit: int = 10) -> tuple[list, int]:
    """
    List documents with pagination
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        skip: int
            Number of documents to skip
        limit: int
            Maximum number of documents to return

    Returns:
        tuple[list, int]
            List of documents and total count
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["docs"]
    
    total_count = await collection.count_documents({})
    cursor = collection.find().sort("upload_date", 1).skip(skip).limit(limit)
    documents = await cursor.to_list(length=limit)
    
    return documents, total_count

async def update_doc_state(analytiq_client, document_id: str, state: str):
    """
    Update document state
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id: str
            Document ID
        state: str
            New state
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["docs"]
    
    await collection.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {
            "state": state,
            "state_updated_at": datetime.now(UTC)
        }}
    )
    
    ad.log.debug(f"Document {document_id} state updated to {state}")

async def get_doc_tag_ids(analytiq_client, document_id: str) -> list[str]:
    """
    Get a document tag IDs

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        document_id: str
            Document ID

    Returns:
        list[str]
            Document tag IDs
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["docs"]
    elem = await collection.find_one({"_id": ObjectId(document_id)})
    if elem is None:
        return []
    return elem["tag_ids"]

async def get_doc_ids_by_tag_ids(analytiq_client, tag_ids: list[str]) -> list[str]:
    """
    Get document IDs by tag IDs

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        tag_ids: list[str]
            Tag IDs

    Returns:
        list[str]
            Document IDs
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["docs"]
    cursor = collection.find({"tag_ids": {"$in": tag_ids}})
    # Convert cursor to list before processing
    elems = await cursor.to_list(length=None)  # None means no limit
    return [str(elem["_id"]) for elem in elems]