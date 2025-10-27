"""
OTLP HTTP endpoints for organization-specific telemetry collection
"""

import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import Response
import analytiq_data as ad
from docrouter_app.auth import get_org_user
from docrouter_app.models import User

logger = logging.getLogger(__name__)

# Create router for OTLP HTTP endpoints
otlp_http_router = APIRouter(prefix="/v1", tags=["otlp-http"])

async def get_organization_from_token(request: Request) -> Optional[str]:
    """Extract organization ID from Authorization header"""
    try:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            logger.warning("OTLP HTTP: Missing or invalid Authorization header")
            return None
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Validate token and get organization
        analytiq_client = ad.common.get_analytiq_client()
        db = ad.common.get_async_db(analytiq_client)
        
        # Find organization by token
        org = await db.organizations.find_one({"api_tokens.token": token})
        if org:
            logger.info(f"OTLP HTTP: Valid token for organization {org['_id']}")
            return str(org["_id"])
        else:
            logger.warning("OTLP HTTP: Invalid token")
            return None
            
    except Exception as e:
        logger.error(f"OTLP HTTP token validation failed: {e}")
        return None

@otlp_http_router.post("/traces")
async def export_traces_http(request: Request):
    """Export traces via OTLP HTTP"""
    try:
        # Get organization from token
        organization_id = await get_organization_from_token(request)
        if not organization_id:
            raise HTTPException(status_code=401, detail="Invalid or missing authorization token")
        
        # Read the request body
        body = await request.body()
        
        # Import the OTLP server functions
        from docrouter_app.routes.otlp_server import export_traces
        
        # Parse the protobuf data
        from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
        from google.protobuf.json_format import Parse
        
        # Convert JSON to protobuf (OTLP HTTP typically sends JSON)
        try:
            # Try to parse as JSON first
            import json
            json_data = json.loads(body.decode('utf-8'))
            otlp_request = Parse(json.dumps(json_data), ExportTraceServiceRequest())
        except:
            # If not JSON, try to parse as protobuf binary
            otlp_request = ExportTraceServiceRequest()
            otlp_request.ParseFromString(body)
        
        # Call the existing gRPC export function
        await export_traces(otlp_request, None, organization_id)
        
        logger.info(f"OTLP HTTP: Successfully exported traces for org {organization_id}")
        return Response(status_code=200)
        
    except Exception as e:
        logger.error(f"OTLP HTTP traces export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@otlp_http_router.post("/metrics")
async def export_metrics_http(request: Request):
    """Export metrics via OTLP HTTP"""
    try:
        # Get organization from token
        organization_id = await get_organization_from_token(request)
        if not organization_id:
            raise HTTPException(status_code=401, detail="Invalid or missing authorization token")
        
        # Read the request body
        body = await request.body()
        
        # Import the OTLP server functions
        from docrouter_app.routes.otlp_server import export_metrics
        
        # Parse the protobuf data
        from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import ExportMetricsServiceRequest
        from google.protobuf.json_format import Parse
        
        # Convert JSON to protobuf
        try:
            import json
            json_data = json.loads(body.decode('utf-8'))
            otlp_request = Parse(json.dumps(json_data), ExportMetricsServiceRequest())
        except:
            otlp_request = ExportMetricsServiceRequest()
            otlp_request.ParseFromString(body)
        
        # Call the existing gRPC export function
        await export_metrics(otlp_request, None, organization_id)
        
        logger.info(f"OTLP HTTP: Successfully exported metrics for org {organization_id}")
        return Response(status_code=200)
        
    except Exception as e:
        logger.error(f"OTLP HTTP metrics export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@otlp_http_router.post("/logs")
async def export_logs_http(request: Request):
    """Export logs via OTLP HTTP"""
    try:
        # Get organization from token
        organization_id = await get_organization_from_token(request)
        if not organization_id:
            raise HTTPException(status_code=401, detail="Invalid or missing authorization token")
        
        # Read the request body
        body = await request.body()
        
        # Import the OTLP server functions
        from docrouter_app.routes.otlp_server import export_logs
        
        # Parse the protobuf data
        from opentelemetry.proto.collector.logs.v1.logs_service_pb2 import ExportLogsServiceRequest
        from google.protobuf.json_format import Parse
        
        # Convert JSON to protobuf
        try:
            import json
            json_data = json.loads(body.decode('utf-8'))
            otlp_request = Parse(json.dumps(json_data), ExportLogsServiceRequest())
        except:
            otlp_request = ExportLogsServiceRequest()
            otlp_request.ParseFromString(body)
        
        # Call the existing gRPC export function
        await export_logs(otlp_request, None, organization_id)
        
        logger.info(f"OTLP HTTP: Successfully exported logs for org {organization_id}")
        return Response(status_code=200)
        
    except Exception as e:
        logger.error(f"OTLP HTTP logs export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
