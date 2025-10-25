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
    hook_stdin: str = Field(..., description="Hook input data")
    hook_timestamp: str = Field(..., description="Timestamp of the log in ISO format")

class ClaudeLogResponse(BaseModel):
    """Response for Claude log operations"""
    log_id: str

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
    
    # Parse the hook_stdin as JSON if it's a string
    try:
        if isinstance(log_request.hook_stdin, str):
            hook_stdin_json = json.loads(log_request.hook_stdin)
        else:
            hook_stdin_json = log_request.hook_stdin
    except json.JSONDecodeError:
        # If it's not valid JSON, store it as a string
        hook_stdin_json = log_request.hook_stdin
    
    # Parse the ISO timestamp
    try:
        # Remove 'Z' suffix if present and parse as datetime
        timestamp_str = log_request.hook_timestamp.rstrip('Z')
        if timestamp_str.endswith('+00:00'):
            timestamp_str = timestamp_str[:-6]  # Remove timezone info
        timestamp = datetime.fromisoformat(timestamp_str)
        # Convert to UTC if not already
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        else:
            timestamp = timestamp.astimezone(UTC)
    except (ValueError, AttributeError) as e:
        logger.warning(f"Failed to parse timestamp '{log_request.hook_timestamp}': {e}")
        # Fallback to current time
        timestamp = datetime.now(UTC)
    
    log_metadata = {
        "organization_id": organization_id,
        "hook_stdin": hook_stdin_json,
        "hook_timestamp": timestamp,
        "upload_timestamp": datetime.now(UTC),
    }
    
    # Save to claude_logs collection and get the generated _id
    result = await db.claude_logs.insert_one(log_metadata)
    log_id = str(result.inserted_id)
    
    logger.info(f"Claude log saved: {log_id} for org: {organization_id}")
    
    return ClaudeLogResponse(
        log_id=log_id
    )
