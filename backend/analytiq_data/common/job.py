from datetime import datetime, UTC
from typing import Optional, Dict, Any
from bson import ObjectId

import analytiq_data as ad

async def submit_job(
    analytiq_client,
    job_type: str,
    document_id: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Create a new job in the queue.

    Args:
        analytiq_client: The AnalytiqClient instance
        job_type: Type of job to create
        document_id: ID of the document to process
        metadata: Optional additional metadata for the job

    Returns:
        str: The ID of the created job
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    job_queue_collection = db.job_queue

    job_data = {
        "status": "pending",
        "created_at": datetime.now(UTC),
        "job_type": job_type,
        "document_id": document_id,
    }
    
    if metadata:
        job_data["metadata"] = metadata

    result = await job_queue_collection.insert_one(job_data)
    job_id = str(result.inserted_id)
    ad.log.info(f"Created job: {job_id}")
    return job_id

async def get_job(analytiq_client) -> Optional[Dict[str, Any]]:
    """
    Get and claim the next available job from the queue.
    
    Args:
        analytiq_client: The AnalytiqClient instance
    
    Returns:
        Optional[Dict]: The job document if found, None otherwise
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    job_queue_collection = db.job_queue

    job = await job_queue_collection.find_one_and_update(
        {"status": "pending"},
        {"$set": {"status": "processing"}},
        sort=[("created_at", 1)]
    )
    
    return job

async def release_job(analytiq_client, job_id: str, status: str = "completed"):
    """
    Release a job by updating its status.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        job_id: The ID of the job to release
        status: The new status to set (default: "completed")
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    job_queue_collection = db.job_queue

    await job_queue_collection.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"status": status}}
    )
    ad.log.info(f"Released job {job_id} with status: {status}") 