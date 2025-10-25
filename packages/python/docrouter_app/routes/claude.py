"""
Claude API Routes
"""

import json
import logging
from datetime import datetime, UTC
from typing import Dict, Any
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Body, Request
from pydantic import BaseModel, Field

import analytiq_data as ad
from docrouter_app.auth import get_current_user, get_org_id_from_token
from docrouter_app.models import User

logger = logging.getLogger(__name__)

# Pydantic Models for Claude Logs

class ClaudeLogRequest(BaseModel):
    """Claude log data"""
    hook_input: str = Field(..., description="Hook input data")
    timestamp: float = Field(..., description="Timestamp of the log")

class ClaudeLogResponse(BaseModel):
    """Response for Claude log operations"""
    log_id: str
    organization_id: str
    upload_date: datetime
    uploaded_by: str

# Router
claude_router = APIRouter()

@claude_router.post("/v0/claude/log", response_model=ClaudeLogResponse, tags=["claude"])
async def claude_log(
    log_request: ClaudeLogRequest = Body(...),
    request: Request = None
):
    """Log Claude interaction data"""
    logger.info(f"claude_log(): received log request")
    
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)
    
    # Get the bearer token from the request
    bearer_token = request.headers.get("Authorization")
    if not bearer_token:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization header"
        )
    
    # Extract the token from "Bearer <token>"
    if not bearer_token.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header format"
        )
    
    token = bearer_token[7:]  # Remove "Bearer " prefix
    
    # Get the organization ID from the bearer token
    try:
        organization_id = await get_org_id_from_token(token)
        if not organization_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token or token not associated with an organization"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving organization ID: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to resolve organization ID from token"
        )
    
    # Create the log entry
    log_id = ad.common.create_id()
    
    # Parse the hook_input as JSON if it's a string
    try:
        if isinstance(log_request.hook_input, str):
            hook_contents = json.loads(log_request.hook_input)
        else:
            hook_contents = log_request.hook_input
    except json.JSONDecodeError:
        # If it's not valid JSON, store it as a string
        hook_contents = log_request.hook_input
    
    log_metadata = {
        "_id": ObjectId(log_id),
        "log_id": log_id,
        "organization_id": organization_id,
        "hook_input": log_request.hook_input,
        "hook_contents": hook_contents,
        "timestamp": log_request.timestamp,
        "upload_date": datetime.now(UTC),
        "uploaded_by": "claude_hook"  # Since we don't have user context
    }
    
    # Save to claude_logs collection
    await db.claude_logs.insert_one(log_metadata)
    
    logger.info(f"Claude log saved: {log_id} for org: {organization_id}")
    
    return ClaudeLogResponse(
        log_id=log_id,
        organization_id=organization_id,
        upload_date=log_metadata["upload_date"],
        uploaded_by="claude_hook"
    )
