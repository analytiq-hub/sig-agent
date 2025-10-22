"""
OpenTelemetry HTTP API Routes
"""

import logging
from datetime import datetime, UTC
from typing import List, Optional, Dict, Any
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field

import analytiq_data as ad
from docrouter_app.auth import get_org_user
from docrouter_app.models import User

logger = logging.getLogger(__name__)

# Pydantic Models for OpenTelemetry

class TelemetrySpan(BaseModel):
    """OpenTelemetry span data"""
    trace_id: str = Field(..., description="Trace ID")
    span_id: str = Field(..., description="Span ID")
    parent_span_id: Optional[str] = Field(None, description="Parent span ID")
    name: str = Field(..., description="Span name")
    kind: Optional[int] = Field(None, description="Span kind")
    start_time_unix_nano: str = Field(..., description="Start time in nanoseconds")
    end_time_unix_nano: str = Field(..., description="End time in nanoseconds")
    status: Optional[Dict[str, Any]] = Field(None, description="Span status")
    attributes: Optional[Dict[str, Any]] = Field(None, description="Span attributes")
    events: Optional[List[Dict[str, Any]]] = Field(None, description="Span events")
    links: Optional[List[Dict[str, Any]]] = Field(None, description="Span links")

class TelemetryTrace(BaseModel):
    """OpenTelemetry trace data"""
    resource_spans: List[Dict[str, Any]] = Field(..., description="Resource spans data")
    tag_ids: List[str] = Field(default=[], description="Optional list of tag IDs")
    metadata: Optional[Dict[str, str]] = Field(default={}, description="Optional key-value metadata pairs")

class TelemetryMetric(BaseModel):
    """OpenTelemetry metric data"""
    name: str = Field(..., description="Metric name")
    description: Optional[str] = Field(None, description="Metric description")
    unit: Optional[str] = Field(None, description="Metric unit")
    type: str = Field(..., description="Metric type (counter, gauge, histogram, etc.)")
    data_points: List[Dict[str, Any]] = Field(..., description="Metric data points")
    resource: Optional[Dict[str, Any]] = Field(None, description="Resource information")
    tag_ids: List[str] = Field(default=[], description="Optional list of tag IDs")
    metadata: Optional[Dict[str, str]] = Field(default={}, description="Optional key-value metadata pairs")

class TelemetryLog(BaseModel):
    """OpenTelemetry log data"""
    timestamp: datetime = Field(..., description="Log timestamp")
    severity: Optional[str] = Field(None, description="Log severity level")
    body: str = Field(..., description="Log message body")
    attributes: Optional[Dict[str, Any]] = Field(None, description="Log attributes")
    resource: Optional[Dict[str, Any]] = Field(None, description="Resource information")
    trace_id: Optional[str] = Field(None, description="Associated trace ID")
    span_id: Optional[str] = Field(None, description="Associated span ID")
    tag_ids: List[str] = Field(default=[], description="Optional list of tag IDs")
    metadata: Optional[Dict[str, str]] = Field(default={}, description="Optional key-value metadata pairs")

class TelemetryTracesUpload(BaseModel):
    """Upload request for OpenTelemetry traces"""
    traces: List[TelemetryTrace] = Field(..., description="List of traces to upload")

class TelemetryMetricsUpload(BaseModel):
    """Upload request for OpenTelemetry metrics"""
    metrics: List[TelemetryMetric] = Field(..., description="List of metrics to upload")

class TelemetryLogsUpload(BaseModel):
    """Upload request for OpenTelemetry logs"""
    logs: List[TelemetryLog] = Field(..., description="List of logs to upload")

class TelemetryTraceResponse(BaseModel):
    """Response for trace operations"""
    trace_id: str
    span_count: int
    upload_date: datetime
    uploaded_by: str
    tag_ids: List[str]
    metadata: Optional[Dict[str, str]]

class TelemetryMetricResponse(BaseModel):
    """Response for metric operations"""
    metric_id: str
    name: str
    description: Optional[str] = Field(None, description="Metric description")
    unit: Optional[str] = Field(None, description="Metric unit")
    type: str
    data_points: Optional[List[Dict[str, Any]]] = Field(None, description="Metric data points")
    data_point_count: int
    resource: Optional[Dict[str, Any]] = Field(None, description="Resource information")
    upload_date: datetime
    uploaded_by: str
    tag_ids: List[str]
    metadata: Optional[Dict[str, str]]

class TelemetryLogResponse(BaseModel):
    """Response for log operations"""
    log_id: str
    timestamp: datetime
    severity: Optional[str]
    body: str
    attributes: Optional[Dict[str, Any]] = Field(None, description="Log attributes")
    resource: Optional[Dict[str, Any]] = Field(None, description="Resource information")
    trace_id: Optional[str] = Field(None, description="Associated trace ID")
    span_id: Optional[str] = Field(None, description="Associated span ID")
    upload_date: datetime
    uploaded_by: str
    tag_ids: List[str]
    metadata: Optional[Dict[str, str]]

class ListTelemetryTracesResponse(BaseModel):
    """Response for listing traces"""
    traces: List[TelemetryTraceResponse]
    total: int
    skip: int
    limit: int

class ListTelemetryMetricsResponse(BaseModel):
    """Response for listing metrics"""
    metrics: List[TelemetryMetricResponse]
    total: int
    skip: int
    limit: int

class ListTelemetryLogsResponse(BaseModel):
    """Response for listing logs"""
    logs: List[TelemetryLogResponse]
    total: int
    skip: int
    limit: int

# Router
telemetry_router = APIRouter()

# Traces Endpoints

@telemetry_router.post("/v0/orgs/{organization_id}/telemetry/traces", tags=["telemetry"])
async def upload_telemetry_traces(
    organization_id: str,
    traces_upload: TelemetryTracesUpload = Body(...),
    current_user: User = Depends(get_org_user)
):
    """Upload OpenTelemetry traces"""
    logger.debug(f"upload_telemetry_traces(): traces: {len(traces_upload.traces)}")

    # Validate all tag IDs first
    all_tag_ids = set()
    for trace in traces_upload.traces:
        all_tag_ids.update(trace.tag_ids)

    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    if all_tag_ids:
        # Check if all tags exist and belong to the organization
        tags_cursor = db.tags.find({
            "_id": {"$in": [ObjectId(tag_id) for tag_id in all_tag_ids]},
            "organization_id": organization_id
        })
        existing_tags = await tags_cursor.to_list(None)
        existing_tag_ids = {str(tag["_id"]) for tag in existing_tags}

        invalid_tags = all_tag_ids - existing_tag_ids
        if invalid_tags:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tag IDs: {list(invalid_tags)}"
            )

    uploaded_traces = []

    for trace in traces_upload.traces:
        trace_id = ad.common.create_id()

        # Calculate span count from resource_spans
        span_count = 0
        for resource_span in trace.resource_spans:
            if "scope_spans" in resource_span:
                for scope_span in resource_span["scope_spans"]:
                    if "spans" in scope_span:
                        span_count += len(scope_span["spans"])

        trace_metadata = {
            "_id": ObjectId(trace_id),
            "trace_id": trace_id,
            "resource_spans": trace.resource_spans,
            "span_count": span_count,
            "upload_date": datetime.now(UTC),
            "uploaded_by": current_user.user_name,
            "tag_ids": trace.tag_ids,
            "metadata": trace.metadata,
            "organization_id": organization_id
        }

        await db.telemetry_traces.insert_one(trace_metadata)
        uploaded_traces.append({
            "trace_id": trace_id,
            "span_count": span_count,
            "tag_ids": trace.tag_ids,
            "metadata": trace.metadata
        })

    return {"traces": uploaded_traces}

@telemetry_router.get("/v0/orgs/{organization_id}/telemetry/traces", response_model=ListTelemetryTracesResponse, tags=["telemetry"])
async def list_telemetry_traces(
    organization_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    tag_ids: str = Query(None, description="Comma-separated list of tag IDs"),
    name_search: str = Query(None, description="Search term for trace names"),
    current_user: User = Depends(get_org_user)
):
    """List OpenTelemetry traces"""
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    # Build query
    query = {"organization_id": organization_id}

    if tag_ids:
        tag_id_list = [tag_id.strip() for tag_id in tag_ids.split(",")]
        query["tag_ids"] = {"$in": tag_id_list}

    # Get total count
    total = await db.telemetry_traces.count_documents(query)

    # Get traces
    cursor = db.telemetry_traces.find(query).skip(skip).limit(limit).sort("upload_date", -1)
    traces = []

    async for trace in cursor:
        traces.append(TelemetryTraceResponse(
            trace_id=trace["trace_id"],
            span_count=trace["span_count"],
            upload_date=trace["upload_date"],
            uploaded_by=trace["uploaded_by"],
            tag_ids=trace["tag_ids"],
            metadata=trace["metadata"]
        ))

    return ListTelemetryTracesResponse(
        traces=traces,
        total=total,
        skip=skip,
        limit=limit
    )

# Metrics Endpoints

@telemetry_router.post("/v0/orgs/{organization_id}/telemetry/metrics", tags=["telemetry"])
async def upload_telemetry_metrics(
    organization_id: str,
    metrics_upload: TelemetryMetricsUpload = Body(...),
    current_user: User = Depends(get_org_user)
):
    """Upload OpenTelemetry metrics"""
    logger.debug(f"upload_telemetry_metrics(): metrics: {len(metrics_upload.metrics)}")

    # Validate all tag IDs first
    all_tag_ids = set()
    for metric in metrics_upload.metrics:
        all_tag_ids.update(metric.tag_ids)

    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    if all_tag_ids:
        # Check if all tags exist and belong to the organization
        tags_cursor = db.tags.find({
            "_id": {"$in": [ObjectId(tag_id) for tag_id in all_tag_ids]},
            "organization_id": organization_id
        })
        existing_tags = await tags_cursor.to_list(None)
        existing_tag_ids = {str(tag["_id"]) for tag in existing_tags}

        invalid_tags = all_tag_ids - existing_tag_ids
        if invalid_tags:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tag IDs: {list(invalid_tags)}"
            )

    uploaded_metrics = []

    for metric in metrics_upload.metrics:
        metric_id = ad.common.create_id()

        metric_metadata = {
            "_id": ObjectId(metric_id),
            "metric_id": metric_id,
            "name": metric.name,
            "description": metric.description,
            "unit": metric.unit,
            "type": metric.type,
            "data_points": metric.data_points,
            "data_point_count": len(metric.data_points),
            "resource": metric.resource,
            "upload_date": datetime.now(UTC),
            "uploaded_by": current_user.user_name,
            "tag_ids": metric.tag_ids,
            "metadata": metric.metadata,
            "organization_id": organization_id
        }

        await db.telemetry_metrics.insert_one(metric_metadata)
        uploaded_metrics.append(TelemetryMetricResponse(
            metric_id=metric_id,
            name=metric.name,
            description=metric.description,
            unit=metric.unit,
            type=metric.type,
            data_points=metric.data_points,
            data_point_count=len(metric.data_points),
            resource=metric.resource,
            upload_date=metric_metadata["upload_date"],
            uploaded_by=metric_metadata["uploaded_by"],
            tag_ids=metric.tag_ids,
            metadata=metric.metadata
        ))

    return {"metrics": uploaded_metrics}

@telemetry_router.get("/v0/orgs/{organization_id}/telemetry/metrics", response_model=ListTelemetryMetricsResponse, tags=["telemetry"])
async def list_telemetry_metrics(
    organization_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    tag_ids: str = Query(None, description="Comma-separated list of tag IDs"),
    name_search: str = Query(None, description="Search term for metric names"),
    start_time: str = Query(None, description="Start time in UTC ISO format (e.g., 2025-10-22T15:00:00.000Z)"),
    end_time: str = Query(None, description="End time in UTC ISO format (e.g., 2025-10-22T16:00:00.000Z)"),
    current_user: User = Depends(get_org_user)
):
    """List OpenTelemetry metrics"""
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    # Build query
    query = {"organization_id": organization_id}

    if tag_ids:
        tag_id_list = [tag_id.strip() for tag_id in tag_ids.split(",")]
        query["tag_ids"] = {"$in": tag_id_list}

    if name_search:
        query["name"] = {"$regex": name_search, "$options": "i"}

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
                    detail=f"Invalid start_time format. Use ISO format like '2025-10-22T15:00:00.000Z'"
                )
        if end_time:
            try:
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                timestamp_query["$lte"] = end_dt
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid end_time format. Use ISO format like '2025-10-22T16:00:00.000Z'"
                )
        query["upload_date"] = timestamp_query

    # Get total count
    total = await db.telemetry_metrics.count_documents(query)

    # Get metrics
    cursor = db.telemetry_metrics.find(query).skip(skip).limit(limit).sort("upload_date", -1)
    metrics = []

    async for metric in cursor:
        metrics.append(TelemetryMetricResponse(
            metric_id=metric["metric_id"],
            name=metric["name"],
            description=metric.get("description"),
            unit=metric.get("unit"),
            type=metric["type"],
            data_points=metric.get("data_points"),
            data_point_count=metric["data_point_count"],
            resource=metric.get("resource"),
            upload_date=metric["upload_date"],
            uploaded_by=metric["uploaded_by"],
            tag_ids=metric["tag_ids"],
            metadata=metric["metadata"]
        ))

    return ListTelemetryMetricsResponse(
        metrics=metrics,
        total=total,
        skip=skip,
        limit=limit
    )

# Logs Endpoints

@telemetry_router.post("/v0/orgs/{organization_id}/telemetry/logs", tags=["telemetry"])
async def upload_telemetry_logs(
    organization_id: str,
    logs_upload: TelemetryLogsUpload = Body(...),
    current_user: User = Depends(get_org_user)
):
    """Upload OpenTelemetry logs"""
    logger.debug(f"upload_telemetry_logs(): logs: {len(logs_upload.logs)}")

    # Validate all tag IDs first
    all_tag_ids = set()
    for log in logs_upload.logs:
        all_tag_ids.update(log.tag_ids)

    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    if all_tag_ids:
        # Check if all tags exist and belong to the organization
        tags_cursor = db.tags.find({
            "_id": {"$in": [ObjectId(tag_id) for tag_id in all_tag_ids]},
            "organization_id": organization_id
        })
        existing_tags = await tags_cursor.to_list(None)
        existing_tag_ids = {str(tag["_id"]) for tag in existing_tags}

        invalid_tags = all_tag_ids - existing_tag_ids
        if invalid_tags:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tag IDs: {list(invalid_tags)}"
            )

    uploaded_logs = []

    for log in logs_upload.logs:
        log_id = ad.common.create_id()

        log_metadata = {
            "_id": ObjectId(log_id),
            "log_id": log_id,
            "timestamp": log.timestamp,
            "severity": log.severity,
            "body": log.body,
            "attributes": log.attributes,
            "resource": log.resource,
            "trace_id": log.trace_id,
            "span_id": log.span_id,
            "upload_date": datetime.now(UTC),
            "uploaded_by": current_user.user_name,
            "tag_ids": log.tag_ids,
            "metadata": log.metadata,
            "organization_id": organization_id
        }

        await db.telemetry_logs.insert_one(log_metadata)
        uploaded_logs.append(TelemetryLogResponse(
            log_id=log_id,
            timestamp=log.timestamp,
            severity=log.severity,
            body=log.body,
            attributes=log.attributes,
            resource=log.resource,
            trace_id=log.trace_id,
            span_id=log.span_id,
            upload_date=log_metadata["upload_date"],
            uploaded_by=log_metadata["uploaded_by"],
            tag_ids=log.tag_ids,
            metadata=log.metadata
        ))

    return {"logs": uploaded_logs}

@telemetry_router.get("/v0/orgs/{organization_id}/telemetry/logs", response_model=ListTelemetryLogsResponse, tags=["telemetry"])
async def list_telemetry_logs(
    organization_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    tag_ids: str = Query(None, description="Comma-separated list of tag IDs"),
    severity: str = Query(None, description="Filter by log severity"),
    start_time: str = Query(None, description="Start time in UTC ISO format (e.g., 2025-10-22T15:00:00.000Z)"),
    end_time: str = Query(None, description="End time in UTC ISO format (e.g., 2025-10-22T16:00:00.000Z)"),
    current_user: User = Depends(get_org_user)
):
    """List OpenTelemetry logs"""
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    # Build query
    query = {"organization_id": organization_id}

    if tag_ids:
        tag_id_list = [tag_id.strip() for tag_id in tag_ids.split(",")]
        query["tag_ids"] = {"$in": tag_id_list}

    if severity:
        query["severity"] = severity

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
                    detail=f"Invalid start_time format. Use ISO format like '2025-10-22T15:00:00.000Z'"
                )
        if end_time:
            try:
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                timestamp_query["$lte"] = end_dt
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid end_time format. Use ISO format like '2025-10-22T16:00:00.000Z'"
                )
        query["timestamp"] = timestamp_query

    # Get total count
    total = await db.telemetry_logs.count_documents(query)

    # Get logs
    cursor = db.telemetry_logs.find(query).skip(skip).limit(limit).sort("timestamp", -1)
    logs = []

    async for log in cursor:
        logs.append(TelemetryLogResponse(
            log_id=log["log_id"],
            timestamp=log["timestamp"],
            severity=log["severity"],
            body=log["body"],
            attributes=log.get("attributes"),
            resource=log.get("resource"),
            trace_id=log.get("trace_id"),
            span_id=log.get("span_id"),
            upload_date=log["upload_date"],
            uploaded_by=log["uploaded_by"],
            tag_ids=log["tag_ids"],
            metadata=log["metadata"]
        ))

    return ListTelemetryLogsResponse(
        logs=logs,
        total=total,
        skip=skip,
        limit=limit
    )
