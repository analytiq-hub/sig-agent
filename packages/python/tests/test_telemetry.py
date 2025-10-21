"""
Tests for OpenTelemetry APIs - both OTLP gRPC and FastAPI HTTP endpoints
"""
import pytest
import grpc
from bson import ObjectId
import os
from datetime import datetime, UTC
import logging
import asyncio

# Import shared test utilities
from .conftest_utils import (
    client, TEST_ORG_ID,
    get_auth_headers
)
import analytiq_data as ad

# Import OTLP protobuf types
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import ExportMetricsServiceRequest
from opentelemetry.proto.collector.logs.v1.logs_service_pb2 import ExportLogsServiceRequest
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, ScopeSpans, Span
from opentelemetry.proto.metrics.v1.metrics_pb2 import ResourceMetrics, ScopeMetrics, Metric, Gauge, NumberDataPoint
from opentelemetry.proto.logs.v1.logs_pb2 import ResourceLogs, ScopeLogs, LogRecord
from opentelemetry.proto.common.v1.common_pb2 import InstrumentationScope, KeyValue, AnyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource

logger = logging.getLogger(__name__)

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

# Helper functions for creating OTLP data

def create_otlp_trace_request(trace_id_hex="0123456789abcdef0123456789abcdef", span_id_hex="0123456789abcdef"):
    """Create a sample OTLP trace request"""
    trace_id = bytes.fromhex(trace_id_hex)
    span_id = bytes.fromhex(span_id_hex)

    span = Span(
        trace_id=trace_id,
        span_id=span_id,
        name="test-span",
        kind=1,  # SPAN_KIND_INTERNAL
        start_time_unix_nano=int(datetime.now(UTC).timestamp() * 1e9),
        end_time_unix_nano=int(datetime.now(UTC).timestamp() * 1e9) + 1000000,
    )

    scope = InstrumentationScope(name="test-instrumentation", version="1.0.0")
    scope_spans = ScopeSpans(scope=scope, spans=[span])

    resource = Resource(attributes=[
        KeyValue(key="service.name", value=AnyValue(string_value="test-service"))
    ])
    resource_spans = ResourceSpans(resource=resource, scope_spans=[scope_spans])

    return ExportTraceServiceRequest(resource_spans=[resource_spans])

def create_otlp_metric_request(metric_name="test.metric"):
    """Create a sample OTLP metric request"""
    data_point = NumberDataPoint(
        time_unix_nano=int(datetime.now(UTC).timestamp() * 1e9),
        as_double=42.5
    )

    gauge = Gauge(data_points=[data_point])
    metric = Metric(name=metric_name, unit="count", gauge=gauge)

    scope = InstrumentationScope(name="test-instrumentation", version="1.0.0")
    scope_metrics = ScopeMetrics(scope=scope, metrics=[metric])

    resource = Resource(attributes=[
        KeyValue(key="service.name", value=AnyValue(string_value="test-service"))
    ])
    resource_metrics = ResourceMetrics(resource=resource, scope_metrics=[scope_metrics])

    return ExportMetricsServiceRequest(resource_metrics=[resource_metrics])

def create_otlp_log_request(body="test log message"):
    """Create a sample OTLP log request"""
    log_record = LogRecord(
        time_unix_nano=int(datetime.now(UTC).timestamp() * 1e9),
        severity_number=9,  # INFO
        body=AnyValue(string_value=body),
        attributes=[
            KeyValue(key="log.level", value=AnyValue(string_value="INFO"))
        ]
    )

    scope = InstrumentationScope(name="test-instrumentation", version="1.0.0")
    scope_logs = ScopeLogs(scope=scope, log_records=[log_record])

    resource = Resource(attributes=[
        KeyValue(key="service.name", value=AnyValue(string_value="test-service"))
    ])
    resource_logs = ResourceLogs(resource=resource, scope_logs=[scope_logs])

    return ExportLogsServiceRequest(resource_logs=[resource_logs])

# FastAPI HTTP Tests

@pytest.mark.asyncio
async def test_upload_traces_http(test_db, mock_auth, setup_test_models):
    """Test uploading traces via FastAPI HTTP endpoint"""
    logger.info("test_upload_traces_http() start")

    # Create trace data in the format expected by FastAPI
    trace_data = {
        "traces": [{
            "resource_spans": [{
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "test-service"}}
                    ]
                },
                "scope_spans": [{
                    "scope": {"name": "test-scope", "version": "1.0.0"},
                    "spans": [{
                        "traceId": "0123456789abcdef0123456789abcdef",
                        "spanId": "0123456789abcdef",
                        "name": "test-span",
                        "kind": 1,
                        "startTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                        "endTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9) + 1000000)
                    }]
                }]
            }],
            "tag_ids": [],
            "metadata": {"source": "test"}
        }]
    }

    # Upload traces
    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces",
        json=trace_data,
        headers=get_auth_headers()
    )

    assert upload_response.status_code == 200
    result = upload_response.json()
    assert "traces" in result
    assert len(result["traces"]) == 1
    assert "trace_id" in result["traces"][0]
    assert "span_count" in result["traces"][0]
    assert result["traces"][0]["span_count"] == 1

    trace_id = result["traces"][0]["trace_id"]

    # Verify trace was stored in database
    db = ad.common.get_async_db()
    stored_trace = await db.telemetry_traces.find_one({"trace_id": trace_id})
    assert stored_trace is not None
    assert stored_trace["organization_id"] == TEST_ORG_ID
    assert stored_trace["span_count"] == 1

    logger.info("test_upload_traces_http() completed successfully")

@pytest.mark.asyncio
async def test_list_traces_http(test_db, mock_auth, setup_test_models):
    """Test listing traces via FastAPI HTTP endpoint"""
    logger.info("test_list_traces_http() start")

    # First upload some traces
    trace_data = {
        "traces": [
            {
                "resource_spans": [{
                    "scope_spans": [{
                        "spans": [{
                            "traceId": f"trace{i:032d}",
                            "spanId": f"span{i:016d}",
                            "name": f"test-span-{i}",
                            "kind": 1,
                            "startTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                            "endTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9) + 1000000)
                        }]
                    }]
                }],
                "tag_ids": [],
                "metadata": {"index": str(i)}
            }
            for i in range(3)
        ]
    }

    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces",
        json=trace_data,
        headers=get_auth_headers()
    )
    assert upload_response.status_code == 200

    # List traces
    list_response = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces?skip=0&limit=10",
        headers=get_auth_headers()
    )

    assert list_response.status_code == 200
    list_data = list_response.json()
    assert "traces" in list_data
    assert "total" in list_data
    assert len(list_data["traces"]) >= 3
    assert list_data["total"] >= 3

    # Verify trace structure
    for trace in list_data["traces"][:3]:
        assert "trace_id" in trace
        assert "span_count" in trace
        assert "upload_date" in trace
        assert "uploaded_by" in trace
        assert "tag_ids" in trace
        assert "metadata" in trace

    logger.info("test_list_traces_http() completed successfully")

@pytest.mark.asyncio
async def test_upload_metrics_http(test_db, mock_auth, setup_test_models):
    """Test uploading metrics via FastAPI HTTP endpoint"""
    logger.info("test_upload_metrics_http() start")

    # Create metric data
    metric_data = {
        "metrics": [{
            "name": "test.metric.counter",
            "description": "A test counter metric",
            "unit": "count",
            "type": "counter",
            "data_points": [{
                "timeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                "value": {"asDouble": 42.5}
            }],
            "resource": {
                "attributes": [
                    {"key": "service.name", "value": {"stringValue": "test-service"}}
                ]
            },
            "tag_ids": [],
            "metadata": {"source": "test"}
        }]
    }

    # Upload metrics
    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics",
        json=metric_data,
        headers=get_auth_headers()
    )

    assert upload_response.status_code == 200
    result = upload_response.json()
    assert "metrics" in result
    assert len(result["metrics"]) == 1
    assert "metric_id" in result["metrics"][0]
    assert "name" in result["metrics"][0]
    assert result["metrics"][0]["name"] == "test.metric.counter"
    assert result["metrics"][0]["data_point_count"] == 1

    metric_id = result["metrics"][0]["metric_id"]

    # Verify metric was stored in database
    db = ad.common.get_async_db()
    stored_metric = await db.telemetry_metrics.find_one({"metric_id": metric_id})
    assert stored_metric is not None
    assert stored_metric["organization_id"] == TEST_ORG_ID
    assert stored_metric["name"] == "test.metric.counter"
    assert stored_metric["type"] == "counter"

    logger.info("test_upload_metrics_http() completed successfully")

@pytest.mark.asyncio
async def test_list_metrics_http(test_db, mock_auth, setup_test_models):
    """Test listing metrics via FastAPI HTTP endpoint"""
    logger.info("test_list_metrics_http() start")

    # Upload multiple metrics
    metric_data = {
        "metrics": [
            {
                "name": f"test.metric.{i}",
                "description": f"Test metric {i}",
                "unit": "count",
                "type": "gauge",
                "data_points": [{
                    "timeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                    "value": {"asDouble": float(i * 10)}
                }],
                "tag_ids": [],
                "metadata": {"index": str(i)}
            }
            for i in range(3)
        ]
    }

    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics",
        json=metric_data,
        headers=get_auth_headers()
    )
    assert upload_response.status_code == 200

    # List metrics
    list_response = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics?skip=0&limit=10",
        headers=get_auth_headers()
    )

    assert list_response.status_code == 200
    list_data = list_response.json()
    assert "metrics" in list_data
    assert "total" in list_data
    assert len(list_data["metrics"]) >= 3

    # Test name search filter
    search_response = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics?name_search=test.metric.1",
        headers=get_auth_headers()
    )
    assert search_response.status_code == 200
    search_data = search_response.json()
    assert len(search_data["metrics"]) >= 1

    logger.info("test_list_metrics_http() completed successfully")

@pytest.mark.asyncio
async def test_upload_logs_http(test_db, mock_auth, setup_test_models):
    """Test uploading logs via FastAPI HTTP endpoint"""
    logger.info("test_upload_logs_http() start")

    # Create log data
    log_data = {
        "logs": [{
            "timestamp": datetime.now(UTC).isoformat(),
            "severity": "INFO",
            "body": "Test log message",
            "attributes": {
                "log.level": "INFO",
                "module": "test"
            },
            "resource": {
                "attributes": [
                    {"key": "service.name", "value": {"stringValue": "test-service"}}
                ]
            },
            "trace_id": "0123456789abcdef0123456789abcdef",
            "span_id": "0123456789abcdef",
            "tag_ids": [],
            "metadata": {"source": "test"}
        }]
    }

    # Upload logs
    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/logs",
        json=log_data,
        headers=get_auth_headers()
    )

    assert upload_response.status_code == 200
    result = upload_response.json()
    assert "logs" in result
    assert len(result["logs"]) == 1
    assert "log_id" in result["logs"][0]
    assert "body" in result["logs"][0]
    assert result["logs"][0]["body"] == "Test log message"

    log_id = result["logs"][0]["log_id"]

    # Verify log was stored in database
    db = ad.common.get_async_db()
    stored_log = await db.telemetry_logs.find_one({"log_id": log_id})
    assert stored_log is not None
    assert stored_log["organization_id"] == TEST_ORG_ID
    assert stored_log["severity"] == "INFO"
    assert stored_log["body"] == "Test log message"

    logger.info("test_upload_logs_http() completed successfully")

@pytest.mark.asyncio
async def test_list_logs_http(test_db, mock_auth, setup_test_models):
    """Test listing logs via FastAPI HTTP endpoint"""
    logger.info("test_list_logs_http() start")

    # Upload logs with different severity levels
    log_data = {
        "logs": [
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "severity": severity,
                "body": f"Test {severity} log message",
                "tag_ids": [],
                "metadata": {"index": str(i)}
            }
            for i, severity in enumerate(["INFO", "WARN", "ERROR"])
        ]
    }

    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/logs",
        json=log_data,
        headers=get_auth_headers()
    )
    assert upload_response.status_code == 200

    # List all logs
    list_response = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/logs?skip=0&limit=10",
        headers=get_auth_headers()
    )

    assert list_response.status_code == 200
    list_data = list_response.json()
    assert "logs" in list_data
    assert "total" in list_data
    assert len(list_data["logs"]) >= 3

    # Test severity filter
    error_response = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/logs?severity=ERROR",
        headers=get_auth_headers()
    )
    assert error_response.status_code == 200
    error_data = error_response.json()
    assert len(error_data["logs"]) >= 1
    for log in error_data["logs"]:
        if "severity" in log and log["severity"]:
            assert log["severity"] == "ERROR"

    logger.info("test_list_logs_http() completed successfully")

@pytest.mark.asyncio
async def test_telemetry_with_tags(test_db, mock_auth, setup_test_models):
    """Test telemetry data with tag associations"""
    logger.info("test_telemetry_with_tags() start")

    # Create a tag first
    tag_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/tags",
        json={"name": "telemetry-tag", "description": "Tag for telemetry"},
        headers=get_auth_headers()
    )
    assert tag_response.status_code == 200
    tag_id = tag_response.json()["id"]

    # Upload trace with tag
    trace_data = {
        "traces": [{
            "resource_spans": [{
                "scope_spans": [{
                    "spans": [{
                        "traceId": "tagged0123456789abcdef0123456789ab",
                        "spanId": "tagged012345678",
                        "name": "tagged-span",
                        "kind": 1,
                        "startTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                        "endTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9) + 1000000)
                    }]
                }]
            }],
            "tag_ids": [tag_id],
            "metadata": {"tagged": "true"}
        }]
    }

    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces",
        json=trace_data,
        headers=get_auth_headers()
    )
    assert upload_response.status_code == 200

    # List traces filtered by tag
    list_response = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces?tag_ids={tag_id}",
        headers=get_auth_headers()
    )

    assert list_response.status_code == 200
    list_data = list_response.json()
    assert len(list_data["traces"]) >= 1

    # Verify tag is associated
    found_tagged = False
    for trace in list_data["traces"]:
        if tag_id in trace["tag_ids"]:
            found_tagged = True
            break
    assert found_tagged, "Should find trace with the tag"

    logger.info("test_telemetry_with_tags() completed successfully")

@pytest.mark.asyncio
async def test_telemetry_invalid_tags(test_db, mock_auth, setup_test_models):
    """Test that invalid tag IDs are rejected"""
    logger.info("test_telemetry_invalid_tags() start")

    # Try to upload trace with valid ObjectId format but non-existent tag
    # Use a valid 24-character hex string that doesn't exist in the database
    non_existent_tag_id = "000000000000000000000000"

    trace_data = {
        "traces": [{
            "resource_spans": [{
                "scope_spans": [{
                    "spans": [{
                        "traceId": "invalid0123456789abcdef0123456789ab",
                        "spanId": "invalid012345678",
                        "name": "invalid-span",
                        "kind": 1,
                        "startTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                        "endTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9) + 1000000)
                    }]
                }]
            }],
            "tag_ids": [non_existent_tag_id],
            "metadata": {}
        }]
    }

    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces",
        json=trace_data,
        headers=get_auth_headers()
    )

    # Should fail with 400 error
    assert upload_response.status_code == 400
    assert "Invalid tag IDs" in upload_response.json()["detail"]

    logger.info("test_telemetry_invalid_tags() completed successfully")

@pytest.mark.asyncio
async def test_combined_upload_download_workflow(test_db, mock_auth, setup_test_models):
    """Test complete workflow: upload via HTTP, verify via list endpoints"""
    logger.info("test_combined_upload_download_workflow() start")

    # Step 1: Upload a trace
    trace_data = {
        "traces": [{
            "resource_spans": [{
                "scope_spans": [{
                    "spans": [{
                        "traceId": "workflow0123456789abcdef0123456789ab",
                        "spanId": "workflow01234567",
                        "name": "workflow-span",
                        "kind": 1,
                        "startTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                        "endTimeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9) + 1000000)
                    }]
                }]
            }],
            "metadata": {"workflow": "test"}
        }]
    }

    trace_upload = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces",
        json=trace_data,
        headers=get_auth_headers()
    )
    assert trace_upload.status_code == 200
    uploaded_trace_id = trace_upload.json()["traces"][0]["trace_id"]

    # Step 2: Upload a metric
    metric_data = {
        "metrics": [{
            "name": "workflow.metric",
            "type": "gauge",
            "data_points": [{
                "timeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                "value": {"asDouble": 123.45}
            }],
            "metadata": {"workflow": "test"}
        }]
    }

    metric_upload = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics",
        json=metric_data,
        headers=get_auth_headers()
    )
    assert metric_upload.status_code == 200
    uploaded_metric_id = metric_upload.json()["metrics"][0]["metric_id"]

    # Step 3: Upload a log
    log_data = {
        "logs": [{
            "timestamp": datetime.now(UTC).isoformat(),
            "severity": "DEBUG",
            "body": "Workflow test log",
            "metadata": {"workflow": "test"}
        }]
    }

    log_upload = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/logs",
        json=log_data,
        headers=get_auth_headers()
    )
    assert log_upload.status_code == 200
    uploaded_log_id = log_upload.json()["logs"][0]["log_id"]

    # Step 4: Verify all uploaded data via list endpoints

    # Verify trace
    trace_list = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/traces",
        headers=get_auth_headers()
    )
    assert trace_list.status_code == 200
    trace_ids = [t["trace_id"] for t in trace_list.json()["traces"]]
    assert uploaded_trace_id in trace_ids

    # Verify metric
    metric_list = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics",
        headers=get_auth_headers()
    )
    assert metric_list.status_code == 200
    metric_ids = [m["metric_id"] for m in metric_list.json()["metrics"]]
    assert uploaded_metric_id in metric_ids

    # Verify log
    log_list = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/logs",
        headers=get_auth_headers()
    )
    assert log_list.status_code == 200
    log_ids = [l["log_id"] for l in log_list.json()["logs"]]
    assert uploaded_log_id in log_ids

    logger.info("test_combined_upload_download_workflow() completed successfully")

@pytest.mark.asyncio
async def test_pagination(test_db, mock_auth, setup_test_models):
    """Test pagination for list endpoints"""
    logger.info("test_pagination() start")

    # Use unique metric names to avoid conflicts with other tests
    import uuid
    unique_prefix = f"paginationtest_{uuid.uuid4().hex[:8]}"

    # Upload 15 metrics with unique names
    metric_data = {
        "metrics": [
            {
                "name": f"{unique_prefix}.metric.{i:03d}",
                "type": "counter",
                "data_points": [{
                    "timeUnixNano": str(int(datetime.now(UTC).timestamp() * 1e9)),
                    "value": {"asDouble": float(i)}
                }],
                "metadata": {"test_batch": unique_prefix}
            }
            for i in range(15)
        ]
    }

    upload_response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics",
        json=metric_data,
        headers=get_auth_headers()
    )
    assert upload_response.status_code == 200
    uploaded_ids = {m["metric_id"] for m in upload_response.json()["metrics"]}

    # Use name search to filter only our test metrics
    # Test pagination - first page
    page1 = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics?skip=0&limit=5&name_search={unique_prefix}",
        headers=get_auth_headers()
    )
    assert page1.status_code == 200
    page1_data = page1.json()
    assert len(page1_data["metrics"]) == 5
    assert page1_data["skip"] == 0
    assert page1_data["limit"] == 5
    assert page1_data["total"] == 15

    # Test pagination - second page
    page2 = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics?skip=5&limit=5&name_search={unique_prefix}",
        headers=get_auth_headers()
    )
    assert page2.status_code == 200
    page2_data = page2.json()
    assert len(page2_data["metrics"]) == 5
    assert page2_data["skip"] == 5

    # Test pagination - third page
    page3 = client.get(
        f"/v0/orgs/{TEST_ORG_ID}/telemetry/metrics?skip=10&limit=5&name_search={unique_prefix}",
        headers=get_auth_headers()
    )
    assert page3.status_code == 200
    page3_data = page3.json()
    assert len(page3_data["metrics"]) == 5

    # Verify no overlap between pages
    page1_ids = {m["metric_id"] for m in page1_data["metrics"]}
    page2_ids = {m["metric_id"] for m in page2_data["metrics"]}
    page3_ids = {m["metric_id"] for m in page3_data["metrics"]}

    assert len(page1_ids & page2_ids) == 0, "Page 1 and 2 should not overlap"
    assert len(page2_ids & page3_ids) == 0, "Page 2 and 3 should not overlap"
    assert len(page1_ids & page3_ids) == 0, "Page 1 and 3 should not overlap"

    # Verify all uploaded metrics are retrieved across all pages
    all_retrieved_ids = page1_ids | page2_ids | page3_ids
    assert all_retrieved_ids == uploaded_ids, "All uploaded metrics should be retrieved across pages"

    logger.info("test_pagination() completed successfully")
