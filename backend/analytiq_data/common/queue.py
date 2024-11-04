from datetime import datetime, UTC
from typing import Optional, Dict, Any
from bson import ObjectId

import analytiq_data as ad

async def send_msg(
    analytiq_client,
    queue_name: str,
    msg_type: str,
    msg: Optional[Dict[str, Any]] = None
) -> str:
    """
    Send a message to the queue.

    Args:
        analytiq_client: The AnalytiqClient instance
        queue_name: Name of the queue collection
        msg_type: Type of message to send
        msg: Optional message data

    Returns:
        str: The ID of the created message
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    queue_collection = db[queue_name]

    msg_data = {
        "status": "pending",
        "created_at": datetime.now(UTC),
        "msg_type": msg_type,
        "msg": msg
    }

    result = await queue_collection.insert_one(msg_data)
    msg_id = str(result.inserted_id)
    ad.log.info(f"Sent message: {msg_id}")
    return msg_id

async def recv_msg(analytiq_client, queue_name: str) -> Optional[Dict[str, Any]]:
    """
    Receive and claim the next available message from the queue.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        queue_name: Name of the queue collection
    
    Returns:
        Optional[Dict]: The message document if found, None otherwise
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    queue_collection = db[queue_name]

    msg_data = await queue_collection.find_one_and_update(
        {"status": "pending"},
        {"$set": {"status": "processing"}},
        sort=[("created_at", 1)]
    )
    
    return msg_data

async def delete_msg(analytiq_client, queue_name: str, msg_id: str, status: str = "completed"):
    """
    Delete/complete a message by updating its status.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        queue_name: Name of the queue collection
        msg_id: The ID of the message to delete
        status: The final status to set (default: "completed")
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    queue_collection = db[queue_name]

    await queue_collection.update_one(
        {"_id": ObjectId(msg_id)},
        {"$set": {"status": status}}
    )
    ad.log.info(f"Deleted message {msg_id} with status: {status}") 