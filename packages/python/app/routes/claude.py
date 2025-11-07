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
from app.auth import get_current_user, get_org_id_from_token, get_org_user
from app.models import User
from app.routes.payments import SPUCreditException

logger = logging.getLogger(__name__)

# Pydantic Models for Claude Logs

class ClaudeLogRequest(BaseModel):
    """Claude log data"""
    hook_data: Dict[str, Any] = Field(..., description="Hook data")
    transcript_records: List[Dict[str, Any]] = Field(..., description="Transcript records")
    upload_timestamp: str = Field(..., description="Upload timestamp in ISO format")

class ClaudeLogResponse(BaseModel):
    """Response for Claude log operations"""
    log_id: str

class ClaudeLogItem(BaseModel):
    """Individual Claude log item"""
    log_id: str
    organization_id: str
    hook_data: Dict[str, Any]
    transcript_record: Dict[str, Any]
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
    """Log Claude interaction data with transcript records"""
    logger.info(f"claude_log(): received log request with {len(log_request.transcript_records)} transcript records")
    
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
    
    # Parse the upload timestamp
    try:
        # Remove 'Z' suffix if present and parse as datetime
        timestamp_str = log_request.upload_timestamp.rstrip('Z')
        if timestamp_str.endswith('+00:00'):
            timestamp_str = timestamp_str[:-6]  # Remove timezone info
        upload_timestamp = datetime.fromisoformat(timestamp_str)
        # Convert to UTC if not already
        if upload_timestamp.tzinfo is None:
            upload_timestamp = upload_timestamp.replace(tzinfo=UTC)
        else:
            upload_timestamp = upload_timestamp.astimezone(UTC)
    except (ValueError, AttributeError) as e:
        logger.warning(f"Failed to parse timestamp '{log_request.upload_timestamp}': {e}")
        # Fallback to current time
        upload_timestamp = datetime.now(UTC)
    
    # Process transcript records using backward-then-forward deduplication strategy
    records = log_request.transcript_records

    # Find the last index that already exists (searching backwards)
    last_existing_index = -1
    for idx in range(len(records) - 1, -1, -1):
        record = records[idx]
        uuid_value = record.get('uuid')
        if not uuid_value:
            continue
        existing = await db.claude_logs.find_one({
            "organization_id": organization_id,
            "transcript_record.uuid": uuid_value
        })
        if existing:
            last_existing_index = idx
            break

    # Calculate how many records will be saved (1 SPU per record)
    records_to_save = len(records) - (last_existing_index + 1)
    
    # Check SPU limits before saving
    if records_to_save > 0:
        try:
            await ad.payments.check_spu_limits(organization_id, 1)
        except SPUCreditException as e:
            logger.warning(f"Insufficient SPU credits for Claude logs: {str(e)}")
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient SPU credits: {str(e)}"
            )

    # Insert forward all records after last_existing_index
    saved_count = 0
    for idx in range(last_existing_index + 1, len(records)):
        transcript_record = records[idx]

        log_metadata = {
            "organization_id": organization_id,
            "hook_data": log_request.hook_data,
            "transcript_record": transcript_record,
            "upload_timestamp": upload_timestamp,
        }

        await db.claude_logs.insert_one(log_metadata)
        saved_count += 1
    
    logger.info(f"Claude logs saved: {saved_count} transcript records for org: {organization_id}")
    
    # Record SPU usage for monitoring (1 SPU per log record)
    if saved_count > 0:
        try:
            await ad.payments.record_spu_usage_mon(
                org_id=organization_id,
                spus=.1,
                operation="claude_log",
                source="claude"
            )
        except Exception as e:
            logger.error(f"Error recording SPU usage for Claude logs: {e}")
    
    return ClaudeLogResponse(
        log_id=f"batch_{saved_count}_records"
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
    
    # Check SPU limits before saving (1 SPU per hook)
    try:
        await ad.payments.check_spu_limits(organization_id, 1)
    except SPUCreditException as e:
        logger.warning(f"Insufficient SPU credits for Claude hook: {str(e)}")
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient SPU credits: {str(e)}"
        )
    
    # Save to claude_hooks collection and get the generated _id
    result = await db.claude_hooks.insert_one(hook_metadata)
    hook_id = str(result.inserted_id)
    
    logger.info(f"Claude hook saved: {hook_id} for org: {organization_id}")
    
    # Record SPU usage for monitoring (1 SPU per hook)
    try:
        await ad.payments.record_spu_usage_mon(
            org_id=organization_id,
            spus=.1,
            operation="claude_hook",
            source="claude"
        )
    except Exception as e:
        logger.error(f"Error recording SPU usage for Claude hook: {e}")
    
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
        query["upload_timestamp"] = timestamp_query
    
    # Add filtering for fields within transcript_record and hook_data using regex for superset matching
    if session_id:
        query["transcript_record.sessionId"] = {"$regex": session_id, "$options": "i"}  # Case-insensitive superset matching
    
    if hook_event_name:
        query["hook_data.hook_event_name"] = {"$regex": hook_event_name, "$options": "i"}  # Case-insensitive superset matching
    
    if tool_name:
        query["hook_data.tool_name"] = {"$regex": tool_name, "$options": "i"}  # Case-insensitive superset matching
    
    if permission_mode:
        query["hook_data.permission_mode"] = permission_mode
    
    # Get total count
    total = await db.claude_logs.count_documents(query)
    
    # Get logs
    cursor = db.claude_logs.find(query).skip(skip).limit(limit).sort("upload_timestamp", -1)
    logs = []
    
    async for log in cursor:
        logs.append(ClaudeLogItem(
            log_id=str(log["_id"]),
            organization_id=log["organization_id"],
            hook_data=log["hook_data"],
            transcript_record=log["transcript_record"],
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
        query["upload_timestamp"] = timestamp_query
    
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
