"""
Claude API Routes
"""

import json
import logging
from datetime import datetime, UTC
from typing import Dict, Any, List
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Body, Request, Query
from pydantic import BaseModel, Field

import analytiq_data as ad
from docrouter_app.auth import get_current_user, get_org_id_from_token, get_org_user
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

class ClaudeLogItem(BaseModel):
    """Individual Claude log item"""
    log_id: str
    organization_id: str
    hook_stdin: Dict[str, Any]
    hook_timestamp: datetime
    upload_timestamp: datetime

class ListClaudeLogsResponse(BaseModel):
    """Response for listing Claude logs"""
    logs: List[ClaudeLogItem]
    total: int
    skip: int
    limit: int

# Pydantic Models for Claude Hooks

class ClaudeHookRequest(BaseModel):
    """Claude hook data"""
    hook_stdin: str = Field(..., description="Hook input data")
    hook_timestamp: str = Field(..., description="Timestamp of the hook in ISO format")

class ClaudeHookResponse(BaseModel):
    """Response for Claude hook operations"""
    hook_id: str

class ClaudeHookItem(BaseModel):
    """Individual Claude hook item"""
    hook_id: str
    organization_id: str
    hook_stdin: Dict[str, Any]
    hook_timestamp: datetime
    upload_timestamp: datetime

class ListClaudeHooksResponse(BaseModel):
    """Response for listing Claude hooks"""
    hooks: List[ClaudeHookItem]
    total: int
    skip: int
    limit: int

# Router
claude_router = APIRouter()

@claude_router.post("/v0/claude/log", response_model=ClaudeLogResponse, tags=["claude"])
async def claude_log_handler(
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

@claude_router.post("/v0/claude/hook", response_model=ClaudeHookResponse, tags=["claude"])
async def claude_hook_handler(
    hook_request: ClaudeHookRequest = Body(...),
    request: Request = None
):
    """Log Claude hook data"""
    logger.info(f"claude_hook(): received hook request")
    
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
        if isinstance(hook_request.hook_stdin, str):
            hook_stdin_json = json.loads(hook_request.hook_stdin)
        else:
            hook_stdin_json = hook_request.hook_stdin
    except json.JSONDecodeError:
        # If it's not valid JSON, store it as a string
        hook_stdin_json = hook_request.hook_stdin
    
    # Parse the ISO timestamp
    try:
        # Remove 'Z' suffix if present and parse as datetime
        timestamp_str = hook_request.hook_timestamp.rstrip('Z')
        if timestamp_str.endswith('+00:00'):
            timestamp_str = timestamp_str[:-6]  # Remove timezone info
        timestamp = datetime.fromisoformat(timestamp_str)
        # Convert to UTC if not already
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        else:
            timestamp = timestamp.astimezone(UTC)
    except (ValueError, AttributeError) as e:
        logger.warning(f"Failed to parse timestamp '{hook_request.hook_timestamp}': {e}")
        # Fallback to current time
        timestamp = datetime.now(UTC)
    
    hook_metadata = {
        "organization_id": organization_id,
        "hook_stdin": hook_stdin_json,
        "hook_timestamp": timestamp,
        "upload_timestamp": datetime.now(UTC),
    }
    
    # Save to claude_hooks collection and get the generated _id
    result = await db.claude_hooks.insert_one(hook_metadata)
    hook_id = str(result.inserted_id)
    
    logger.info(f"Claude hook saved: {hook_id} for org: {organization_id}")
    
    return ClaudeHookResponse(
        hook_id=hook_id
    )

@claude_router.get("/v0/orgs/{organization_id}/claude/logs", response_model=ListClaudeLogsResponse, tags=["claude"])
async def list_claude_logs(
    organization_id: str,
    skip: int = Query(0, ge=0, description="Number of logs to skip"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of logs to return"),
    start_time: str = Query(None, description="Start time in UTC ISO format (e.g., 2025-10-25T02:00:00.000Z)"),
    end_time: str = Query(None, description="End time in UTC ISO format (e.g., 2025-10-25T03:00:00.000Z)"),
    session_id: str = Query(None, description="Filter by session ID"),
    hook_event_name: str = Query(None, description="Filter by hook event name"),
    tool_name: str = Query(None, description="Filter by tool name"),
    permission_mode: str = Query(None, description="Filter by permission mode"),
    current_user: User = Depends(get_org_user)
):
    """List Claude logs with filtering capabilities"""
    logger.info(f"list_claude_logs(): skip={skip}, limit={limit}, user: {current_user.user_name}")
    
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)
    
    # Build query
    query = {"organization_id": organization_id}
    
    # Add timestamp filtering
    if start_time or end_time:
        timestamp_query = {}
        if start_time:
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                timestamp_query["$gte"] = start_dt
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid start_time format. Use ISO format like '2025-10-25T02:00:00.000Z'"
                )
        if end_time:
            try:
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                timestamp_query["$lte"] = end_dt
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid end_time format. Use ISO format like '2025-10-25T03:00:00.000Z'"
                )
        query["hook_timestamp"] = timestamp_query
    
    # Add filtering for fields within hook_stdin using regex for superset matching
    if session_id:
        query["hook_stdin.session_id"] = {"$regex": session_id, "$options": "i"}  # Case-insensitive superset matching
    
    if hook_event_name:
        query["hook_stdin.hook_event_name"] = {"$regex": hook_event_name, "$options": "i"}  # Case-insensitive superset matching
    
    if tool_name:
        query["hook_stdin.tool_name"] = {"$regex": tool_name, "$options": "i"}  # Case-insensitive superset matching
    
    if permission_mode:
        query["hook_stdin.permission_mode"] = permission_mode
    
    # Get total count
    total = await db.claude_logs.count_documents(query)
    
    # Get logs
    cursor = db.claude_logs.find(query).skip(skip).limit(limit).sort("hook_timestamp", -1)
    logs = []
    
    async for log in cursor:
        logs.append(ClaudeLogItem(
            log_id=str(log["_id"]),
            organization_id=log["organization_id"],
            hook_stdin=log["hook_stdin"],
            hook_timestamp=log["hook_timestamp"],
            upload_timestamp=log["upload_timestamp"]
        ))
    
    return ListClaudeLogsResponse(
        logs=logs,
        total=total,
        skip=skip,
        limit=limit
    )

@claude_router.get("/v0/orgs/{organization_id}/claude/hooks", response_model=ListClaudeHooksResponse, tags=["claude"])
async def list_claude_hooks(
    organization_id: str,
    skip: int = Query(0, ge=0, description="Number of hooks to skip"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of hooks to return"),
    start_time: str = Query(None, description="Start time in UTC ISO format (e.g., 2025-10-25T02:00:00.000Z)"),
    end_time: str = Query(None, description="End time in UTC ISO format (e.g., 2025-10-25T03:00:00.000Z)"),
    session_id: str = Query(None, description="Filter by session ID"),
    hook_event_name: str = Query(None, description="Filter by hook event name"),
    tool_name: str = Query(None, description="Filter by tool name"),
    permission_mode: str = Query(None, description="Filter by permission mode"),
    current_user: User = Depends(get_org_user)
):
    """List Claude hooks with filtering capabilities"""
    logger.info(f"list_claude_hooks(): skip={skip}, limit={limit}, user: {current_user.user_name}")
    
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)
    
    # Build query
    query = {"organization_id": organization_id}
    
    # Add timestamp filtering
    if start_time or end_time:
        timestamp_query = {}
        if start_time:
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                timestamp_query["$gte"] = start_dt
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid start_time format. Use ISO format like '2025-10-25T02:00:00.000Z'"
                )
        if end_time:
            try:
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                timestamp_query["$lte"] = end_dt
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid end_time format. Use ISO format like '2025-10-25T03:00:00.000Z'"
                )
        query["hook_timestamp"] = timestamp_query
    
    # Add filtering for fields within hook_stdin using regex for superset matching
    if session_id:
        query["hook_stdin.session_id"] = {"$regex": session_id, "$options": "i"}  # Case-insensitive superset matching
    
    if hook_event_name:
        query["hook_stdin.hook_event_name"] = {"$regex": hook_event_name, "$options": "i"}  # Case-insensitive superset matching
    
    if tool_name:
        query["hook_stdin.tool_name"] = {"$regex": tool_name, "$options": "i"}  # Case-insensitive superset matching
    
    if permission_mode:
        query["hook_stdin.permission_mode"] = permission_mode
    
    # Get total count
    total = await db.claude_hooks.count_documents(query)
    
    # Get hooks
    cursor = db.claude_hooks.find(query).skip(skip).limit(limit).sort("hook_timestamp", -1)
    hooks = []
    
    async for hook in cursor:
        hooks.append(ClaudeHookItem(
            hook_id=str(hook["_id"]),
            organization_id=hook["organization_id"],
            hook_stdin=hook["hook_stdin"],
            hook_timestamp=hook["hook_timestamp"],
            upload_timestamp=hook["upload_timestamp"]
        ))
    
    return ListClaudeHooksResponse(
        hooks=hooks,
        total=total,
        skip=skip,
        limit=limit
    )
