"""
OTLP gRPC Server for organization-specific telemetry collection
"""

import asyncio
import grpc
import logging
from concurrent import futures
from typing import Dict, Optional

from opentelemetry.proto.collector.trace.v1 import trace_service_pb2_grpc
from opentelemetry.proto.collector.metrics.v1 import metrics_service_pb2_grpc
from opentelemetry.proto.collector.logs.v1 import logs_service_pb2_grpc

# Import the service classes will be defined in this file
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import (
    ExportMetricsServiceRequest,
    ExportMetricsServiceResponse,
)
from opentelemetry.proto.collector.logs.v1.logs_service_pb2 import (
    ExportLogsServiceRequest,
    ExportLogsServiceResponse,
)
from datetime import datetime, UTC
from bson import ObjectId
import analytiq_data as ad

logger = logging.getLogger(__name__)

# Global state
_otlp_server = None
_organization_services: Dict[str, Dict[str, any]] = {}

# OTLP Service Functions
async def export_traces(request: ExportTraceServiceRequest, context, organization_id: str, source: str = "otlp-grpc"):
    """Export traces via OTLP gRPC"""
    try:
        logger.info(f"OTLP Export traces for org {organization_id}: {len(request.resource_spans)} resource spans")

        # Convert OTLP traces to our format
        traces = []
        for resource_span in request.resource_spans:
            # Convert protobuf to dict format
            trace_data = {
                "resource_spans": [convert_resource_span(resource_span)],
                "tag_ids": [],
                "metadata": {"source": source}
            }
            traces.append(trace_data)

        # Store in database
        analytiq_client = ad.common.get_analytiq_client()
        db = ad.common.get_async_db(analytiq_client)

        uploaded_traces = []
        for trace_data in traces:
            trace_id = ad.common.create_id()

            # Calculate span count
            span_count = 0
            for resource_span in trace_data["resource_spans"]:
                if "scope_spans" in resource_span:
                    for scope_span in resource_span["scope_spans"]:
                        if "spans" in scope_span:
                            span_count += len(scope_span["spans"])

            trace_metadata = {
                "_id": ObjectId(trace_id),
                "trace_id": trace_id,
                "resource_spans": trace_data["resource_spans"],
                "span_count": span_count,
                "upload_date": datetime.now(UTC),
                "uploaded_by": source,
                "tag_ids": trace_data["tag_ids"],
                "metadata": trace_data["metadata"],
                "organization_id": organization_id
            }

            await db.telemetry_traces.insert_one(trace_metadata)
            uploaded_traces.append({
                "trace_id": trace_id,
                "span_count": span_count,
                "tag_ids": trace_data["tag_ids"],
                "metadata": trace_data["metadata"]
            })

        return ExportTraceServiceResponse(partial_success=None)

    except Exception as e:
        logger.error(f"Error in OTLP trace export: {str(e)}")
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details(f"Internal error: {str(e)}")
        return ExportTraceServiceResponse()

def convert_resource_span(resource_span):
    """Convert protobuf ResourceSpan to dict format"""
    # This is a simplified conversion - you may need to handle more fields
    result = {}

    if resource_span.resource:
        result["resource"] = {
            "attributes": [
                {"key": attr.key, "value": {"stringValue": attr.value.string_value}}
                for attr in resource_span.resource.attributes
            ]
        }

    if resource_span.scope_spans:
        result["scope_spans"] = []
        for scope_span in resource_span.scope_spans:
            scope_data = {}
            if scope_span.scope:
                scope_data["scope"] = {
                    "name": scope_span.scope.name,
                    "version": scope_span.scope.version
                }

            if scope_span.spans:
                scope_data["spans"] = []
                for span in scope_span.spans:
                    span_data = {
                        "traceId": span.trace_id.hex(),
                        "spanId": span.span_id.hex(),
                        "name": span.name,
                        "kind": span.kind,
                        "startTimeUnixNano": str(span.start_time_unix_nano),
                        "endTimeUnixNano": str(span.end_time_unix_nano),
                    }
                    if span.parent_span_id:
                        span_data["parentSpanId"] = span.parent_span_id.hex()
                    if span.attributes:
                        span_data["attributes"] = [
                            {"key": attr.key, "value": {"stringValue": attr.value.string_value}}
                            for attr in span.attributes
                        ]
                    if span.status:
                        span_data["status"] = {"code": span.status.code}

                    scope_data["spans"].append(span_data)

            result["scope_spans"].append(scope_data)

    return result

async def export_metrics(request: ExportMetricsServiceRequest, context, organization_id: str, source: str = "otlp-grpc"):
    """Export metrics via OTLP gRPC"""
    try:
        logger.info(f"OTLP Export metrics for org {organization_id}: {len(request.resource_metrics)} resource metrics")

        # Convert OTLP metrics to our format
        metrics = []
        for resource_metric in request.resource_metrics:
            for scope_metric in resource_metric.scope_metrics:
                for metric in scope_metric.metrics:
                    metric_data = {
                        "name": metric.name,
                        "description": metric.description,
                        "unit": metric.unit,
                        "type": get_metric_type(metric),
                        "data_points": convert_data_points(metric),
                        "resource": convert_resource(resource_metric.resource),
                        "tag_ids": [],
                        "metadata": {"source": source}
                    }
                    metrics.append(metric_data)

        # Store in database
        analytiq_client = ad.common.get_analytiq_client()
        db = ad.common.get_async_db(analytiq_client)

        uploaded_metrics = []
        for metric_data in metrics:
            metric_id = ad.common.create_id()

            metric_metadata = {
                "_id": ObjectId(metric_id),
                "metric_id": metric_id,
                "name": metric_data["name"],
                "description": metric_data["description"],
                "unit": metric_data["unit"],
                "type": metric_data["type"],
                "data_points": metric_data["data_points"],
                "resource": metric_data["resource"],
                "data_point_count": len(metric_data["data_points"]),
                "upload_date": datetime.now(UTC),
                "uploaded_by": source,
                "tag_ids": metric_data["tag_ids"],
                "metadata": metric_data["metadata"],
                "organization_id": organization_id
            }

            await db.telemetry_metrics.insert_one(metric_metadata)
            uploaded_metrics.append({
                "metric_id": metric_id,
                "name": metric_data["name"],
                "type": metric_data["type"],
                "data_point_count": len(metric_data["data_points"]),
                "tag_ids": metric_data["tag_ids"],
                "metadata": metric_data["metadata"]
            })

        return ExportMetricsServiceResponse(partial_success=None)

    except Exception as e:
        logger.error(f"Error in OTLP metrics export: {str(e)}")
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details(f"Internal error: {str(e)}")
        return ExportMetricsServiceResponse()

def get_metric_type(metric):
    """Determine metric type from protobuf"""
    if metric.HasField("gauge"):
        return "gauge"
    elif metric.HasField("sum"):
        return "counter" if metric.sum.is_monotonic else "gauge"
    elif metric.HasField("histogram"):
        return "histogram"
    elif metric.HasField("summary"):
        return "summary"
    else:
        return "unknown"

def convert_data_points(metric):
    """Convert metric data points to our format"""
    data_points = []

    if metric.HasField("gauge"):
        for dp in metric.gauge.data_points:
            data_points.append({
                "timeUnixNano": str(dp.time_unix_nano),
                "value": {"asDouble": dp.as_double} if dp.HasField("as_double") else {"asInt": str(dp.as_int)}
            })
    elif metric.HasField("sum"):
        for dp in metric.sum.data_points:
            data_points.append({
                "timeUnixNano": str(dp.time_unix_nano),
                "value": {"asDouble": dp.as_double} if dp.HasField("as_double") else {"asInt": str(dp.as_int)}
            })
    elif metric.HasField("histogram"):
        for dp in metric.histogram.data_points:
            data_points.append({
                "timeUnixNano": str(dp.time_unix_nano),
                "count": str(dp.count),
                "sum": dp.sum,
                "bucket_counts": [str(bc) for bc in dp.bucket_counts],
                "explicit_bounds": [eb for eb in dp.explicit_bounds]
            })

    return data_points

def convert_resource(resource):
    """Convert resource to our format"""
    if not resource:
        return {}

    return {
        "attributes": [
            {"key": attr.key, "value": {"stringValue": attr.value.string_value}}
            for attr in resource.attributes
        ]
    }

async def export_logs(request: ExportLogsServiceRequest, context, organization_id: str, source: str = "otlp-grpc"):
    """Export logs via OTLP gRPC"""
    try:
        logger.info(f"OTLP Export logs for org {organization_id}: {len(request.resource_logs)} resource logs")

        # Convert OTLP logs to our format
        logs = []
        for resource_log in request.resource_logs:
            for scope_log in resource_log.scope_logs:
                for log_record in scope_log.log_records:
                    log_data = {
                        "timestamp": datetime.fromtimestamp(log_record.time_unix_nano / 1_000_000_000, tz=UTC).isoformat(),
                        "severity": get_severity_name(log_record.severity_number),
                        "body": log_record.body.string_value if log_record.body.HasField("string_value") else "",
                        "attributes": convert_attributes(log_record.attributes),
                        "resource": convert_resource(resource_log.resource),
                        "trace_id": log_record.trace_id.hex() if log_record.trace_id else None,
                        "span_id": log_record.span_id.hex() if log_record.span_id else None,
                        "tag_ids": [],
                        "metadata": {"source": source}
                    }
                    logs.append(log_data)
                    logger.info(f"Processed log record: severity={log_data['severity']}, body='{log_data['body'][:100]}...'")

        logger.info(f"Converted {len(logs)} log records for database storage")

        # Store in database
        analytiq_client = ad.common.get_analytiq_client()
        db = ad.common.get_async_db(analytiq_client)

        uploaded_logs = []
        for log_data in logs:
            log_id = ad.common.create_id()

            log_metadata = {
                "_id": ObjectId(log_id),
                "log_id": log_id,
                "timestamp": datetime.fromisoformat(log_data["timestamp"].replace('Z', '+00:00')),
                "severity": log_data["severity"],
                "body": log_data["body"],
                "attributes": log_data["attributes"],
                "resource": log_data["resource"],
                "trace_id": log_data["trace_id"],
                "span_id": log_data["span_id"],
                "upload_date": datetime.now(UTC),
                "uploaded_by": source,
                "tag_ids": log_data["tag_ids"],
                "metadata": log_data["metadata"],
                "organization_id": organization_id
            }

            await db.telemetry_logs.insert_one(log_metadata)
            logger.info(f"Successfully inserted log {log_id} into database for org {organization_id}")
            uploaded_logs.append({
                "log_id": log_id,
                "timestamp": log_data["timestamp"],
                "severity": log_data["severity"],
                "body": log_data["body"],
                "tag_ids": log_data["tag_ids"],
                "metadata": log_data["metadata"]
            })

        logger.info(f"OTLP logs export completed: {len(uploaded_logs)} logs saved to database for org {organization_id}")
        return ExportLogsServiceResponse(partial_success=None)

    except Exception as e:
        logger.error(f"Error in OTLP logs export: {str(e)}")
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details(f"Internal error: {str(e)}")
        return ExportLogsServiceResponse()

def get_severity_name(severity_number):
    """Convert severity number to name"""
    severity_map = {
        1: "TRACE", 2: "TRACE", 3: "TRACE", 4: "TRACE",
        5: "DEBUG", 6: "DEBUG", 7: "DEBUG", 8: "DEBUG",
        9: "INFO", 10: "INFO", 11: "INFO", 12: "INFO",
        13: "WARN", 14: "WARN", 15: "WARN", 16: "WARN",
        17: "ERROR", 18: "ERROR", 19: "ERROR", 20: "ERROR",
        21: "FATAL", 22: "FATAL", 23: "FATAL", 24: "FATAL"
    }
    return severity_map.get(severity_number, "INFO")

def convert_attributes(attributes):
    """Convert attributes to our format"""
    result = {}
    for attr in attributes:
        if attr.value.HasField("string_value"):
            result[attr.key] = attr.value.string_value
        elif attr.value.HasField("int_value"):
            result[attr.key] = attr.value.int_value
        elif attr.value.HasField("double_value"):
            result[attr.key] = attr.value.double_value
        elif attr.value.HasField("bool_value"):
            result[attr.key] = attr.value.bool_value
    return result

# OTLP is always enabled for all organizations - no management needed

def get_organization_from_metadata(context) -> Optional[str]:
    """Extract organization ID from gRPC metadata"""
    # Check for organization header in metadata
    metadata = dict(context.invocation_metadata())
    organization_id = metadata.get('organization-id')
    
    logger.info(f"OTLP metadata check: organization-id={organization_id}, all metadata keys={list(metadata.keys())}")

    if not organization_id:
        # Try to extract from authority (host header)
        authority = metadata.get(':authority', '')
        logger.info(f"OTLP authority check: authority='{authority}'")
        if 'org-' in authority:
            # Extract org ID from subdomain like org-12345.localhost:4317
            try:
                # Find the part that starts with 'org-'
                parts = authority.split('.')
                for part in parts:
                    if part.startswith('org-'):
                        organization_id = part
                        logger.info(f"OTLP extracted org ID from authority: {organization_id}")
                        break
            except (IndexError, ValueError):
                logger.warning(f"OTLP failed to parse authority: {authority}")
                pass

    logger.info(f"OTLP final organization ID from metadata: {organization_id}")
    return organization_id

async def get_organization_from_token(context) -> Optional[str]:
    """Extract organization ID from Bearer token in gRPC metadata"""
    metadata = dict(context.invocation_metadata())
    authorization = metadata.get('authorization')
    
    logger.info(f"OTLP token check: authorization present={authorization is not None}")

    if not authorization or not authorization.startswith('Bearer '):
        logger.info("OTLP no Bearer token found in metadata")
        return None

    token = authorization[7:]  # Remove 'Bearer ' prefix
    logger.info(f"OTLP extracted token (first 10 chars): {token[:10]}...")

    # Use the centralized auth function
    from docrouter_app.auth import get_org_id_from_token
    try:
        organization_id = await get_org_id_from_token(token)
        logger.info(f"OTLP organization ID from token: {organization_id}")
        return organization_id
    except Exception as e:
        logger.error(f"OTLP token validation failed: {e}")
        return None

async def start_otlp_server(port: int = 4317):
    """Start the OTLP gRPC server"""
    global _otlp_server

    _otlp_server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))

    # Add router services
    trace_service_pb2_grpc.add_TraceServiceServicer_to_server(
        OrganizationRouterTraceService(), _otlp_server
    )
    metrics_service_pb2_grpc.add_MetricsServiceServicer_to_server(
        OrganizationRouterMetricsService(), _otlp_server
    )
    logs_service_pb2_grpc.add_LogsServiceServicer_to_server(
        OrganizationRouterLogsService(), _otlp_server
    )

    listen_addr = f'[::]:{port}'
    _otlp_server.add_insecure_port(listen_addr)

    logger.info(f"Starting OTLP gRPC server on {listen_addr}")
    await _otlp_server.start()
    logger.info("OTLP gRPC server started successfully")

async def stop_otlp_server():
    """Stop the OTLP gRPC server"""
    global _otlp_server

    if _otlp_server:
        logger.info("Stopping OTLP gRPC server...")
        await _otlp_server.stop(grace=5.0)
        logger.info("OTLP gRPC server stopped")
        _otlp_server = None

async def wait_for_termination():
    """Wait for server termination"""
    global _otlp_server

    if _otlp_server:
        await _otlp_server.wait_for_termination()

# Router service classes (required by gRPC)
class OrganizationRouterTraceService(trace_service_pb2_grpc.TraceServiceServicer):
    """Router service that routes trace requests to organization-specific services"""

    async def Export(self, request, context):
        """Route trace export to organization-specific service"""
        # Try to get organization ID from token first, then metadata
        organization_id = await get_organization_from_token(context)

        if not organization_id:
            organization_id = get_organization_from_metadata(context)

        if not organization_id:
            context.set_code(grpc.StatusCode.UNAUTHENTICATED)
            context.set_details("Organization ID required in Bearer token, metadata, or subdomain")
            return None

        # OTLP is always enabled for all organizations - no need to check
        # Route to organization-specific service
        return await export_traces(request, context, organization_id)

class OrganizationRouterMetricsService(metrics_service_pb2_grpc.MetricsServiceServicer):
    """Router service that routes metrics requests to organization-specific services"""

    async def Export(self, request, context):
        """Route metrics export to organization-specific service"""
        # Try to get organization ID from token first, then metadata
        organization_id = await get_organization_from_token(context)

        if not organization_id:
            organization_id = get_organization_from_metadata(context)

        if not organization_id:
            context.set_code(grpc.StatusCode.UNAUTHENTICATED)
            context.set_details("Organization ID required in Bearer token, metadata, or subdomain")
            return None

        # OTLP is always enabled for all organizations - no need to check
        # Route to organization-specific service
        return await export_metrics(request, context, organization_id)

class OrganizationRouterLogsService(logs_service_pb2_grpc.LogsServiceServicer):
    """Router service that routes logs requests to organization-specific services"""

    async def Export(self, request, context):
        """Route logs export to organization-specific service"""
        logger.info("OTLP logs service Export called")
        
        # Try to get organization ID from token first, then metadata
        organization_id = await get_organization_from_token(context)

        if not organization_id:
            organization_id = get_organization_from_metadata(context)

        if not organization_id:
            logger.error("OTLP logs service: No organization ID found in token or metadata")
            context.set_code(grpc.StatusCode.UNAUTHENTICATED)
            context.set_details("Organization ID required in Bearer token, metadata, or subdomain")
            return None

        logger.info(f"OTLP logs service: Routing to organization {organization_id}")
        # OTLP is always enabled for all organizations - no need to check
        # Route to organization-specific service
        return await export_logs(request, context, organization_id)

# OTLP is always enabled for all organizations - no management functions needed
