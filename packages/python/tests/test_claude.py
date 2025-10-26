"""
Tests for Claude API endpoints
"""
import pytest
import pytest_asyncio
import json
import os
import sys
import logging
from datetime import datetime, UTC, timedelta
from bson import ObjectId
from unittest.mock import patch

# Import shared test utilities
from .conftest_utils import (
    client, TEST_ORG_ID, 
    get_auth_headers
)
import analytiq_data as ad

logger = logging.getLogger(__name__)

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

@pytest.fixture
def sample_claude_log_data():
    """Sample Claude log data for testing"""
    return {
        "hook_stdin": json.dumps({
            "session_id": "test-session-123",
            "hook_event_name": "UserPromptSubmit",
            "prompt": "What documents are available?",
            "permission_mode": "default",
            "cwd": "/test/directory"
        }),
        "hook_timestamp": datetime.now(UTC).isoformat() + 'Z'
    }

@pytest.fixture
def sample_claude_log_data_with_tool():
    """Sample Claude log data with tool usage for testing"""
    return {
        "hook_stdin": json.dumps({
            "session_id": "test-session-456",
            "hook_event_name": "PreToolUse",
            "tool_name": "mcp__docrouter__list_documents",
            "tool_input": {"limit": 10},
            "permission_mode": "default",
            "cwd": "/test/directory"
        }),
        "hook_timestamp": datetime.now(UTC).isoformat() + 'Z'
    }

@pytest.fixture
def invalid_claude_log_data():
    """Invalid Claude log data for testing error cases"""
    return {
        "hook_stdin": "invalid json data",
        "hook_timestamp": "invalid-timestamp"
    }

@pytest.fixture
def sample_claude_hook_data():
    """Sample Claude hook data for testing"""
    return {
        "hook_stdin": json.dumps({
            "session_id": "test-session-456",
            "hook_event_name": "ToolUse",
            "tool_name": "mcp__docrouter__get_document",
            "tool_input": {"document_id": "doc-123"},
            "permission_mode": "default",
            "cwd": "/test/directory"
        }),
        "hook_timestamp": datetime.now(UTC).isoformat() + 'Z'
    }

@pytest.fixture
def sample_claude_hook_data_with_error():
    """Sample Claude hook data with error for testing"""
    return {
        "hook_stdin": json.dumps({
            "session_id": "test-session-789",
            "hook_event_name": "ToolError",
            "tool_name": "mcp__docrouter__invalid_tool",
            "error": "Tool not found",
            "permission_mode": "default"
        }),
        "hook_timestamp": datetime.now(UTC).isoformat() + 'Z'
    }

class TestClaudeLogEndpoint:
    """Test the POST /v0/claude/log endpoint"""

    @pytest.mark.asyncio
    async def test_claude_log_success(self, test_db, org_and_users, sample_claude_log_data):
        """Test successful Claude log creation"""
        # Use the member token (has access to the org)
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.post(
            "/v0/claude/log",
            json=sample_claude_log_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "log_id" in data
        assert data["log_id"] is not None
        
        # Verify the log was saved to the database
        log_id = data["log_id"]
        log_doc = await test_db.claude_logs.find_one({"_id": ObjectId(log_id)})
        assert log_doc is not None
        assert log_doc["organization_id"] == org_and_users["org_id"]
        assert log_doc["hook_stdin"]["session_id"] == "test-session-123"
        assert log_doc["hook_stdin"]["hook_event_name"] == "UserPromptSubmit"

    @pytest.mark.asyncio
    async def test_claude_log_with_tool_usage(self, test_db, org_and_users, sample_claude_log_data_with_tool):
        """Test Claude log creation with tool usage data"""
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.post(
            "/v0/claude/log",
            json=sample_claude_log_data_with_tool,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "log_id" in data
        
        # Verify the tool usage data was saved correctly
        log_id = data["log_id"]
        log_doc = await test_db.claude_logs.find_one({"_id": ObjectId(log_id)})
        assert log_doc["hook_stdin"]["tool_name"] == "mcp__docrouter__list_documents"
        assert log_doc["hook_stdin"]["tool_input"]["limit"] == 10

    def test_claude_log_missing_auth_header(self, sample_claude_log_data):
        """Test Claude log creation without authorization header"""
        response = client.post(
            "/v0/claude/log",
            json=sample_claude_log_data
        )
        
        assert response.status_code == 401
        assert "Missing Authorization header" in response.json()["detail"]

    def test_claude_log_invalid_auth_format(self, sample_claude_log_data):
        """Test Claude log creation with invalid authorization format"""
        headers = {"Authorization": "InvalidFormat token123"}
        
        response = client.post(
            "/v0/claude/log",
            json=sample_claude_log_data,
            headers=headers
        )
        
        assert response.status_code == 401
        assert "Invalid Authorization header format" in response.json()["detail"]

    def test_claude_log_invalid_token(self, sample_claude_log_data):
        """Test Claude log creation with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        
        response = client.post(
            "/v0/claude/log",
            json=sample_claude_log_data,
            headers=headers
        )
        
        assert response.status_code == 401
        assert "Invalid token" in response.json()["detail"]

    def test_claude_log_missing_required_fields(self):
        """Test Claude log creation with missing required fields"""
        token = "test_token"
        headers = {"Authorization": f"Bearer {token}"}
        
        # Missing hook_stdin
        response = client.post(
            "/v0/claude/log",
            json={"hook_timestamp": datetime.now(UTC).isoformat() + 'Z'},
            headers=headers
        )
        assert response.status_code == 422
        
        # Missing hook_timestamp
        response = client.post(
            "/v0/claude/log",
            json={"hook_stdin": "test data"},
            headers=headers
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_claude_log_invalid_json_in_stdin(self, test_db, org_and_users):
        """Test Claude log creation with invalid JSON in hook_stdin"""
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        data = {
            "hook_stdin": "invalid json data {",
            "hook_timestamp": datetime.now(UTC).isoformat() + 'Z'
        }
        
        response = client.post(
            "/v0/claude/log",
            json=data,
            headers=headers
        )
        
        assert response.status_code == 200  # Should still succeed, storing as string
        log_id = response.json()["log_id"]
        
        # Verify the invalid JSON was stored as a string
        log_doc = await test_db.claude_logs.find_one({"_id": ObjectId(log_id)})
        assert log_doc["hook_stdin"] == "invalid json data {"

    @pytest.mark.asyncio
    async def test_claude_log_invalid_timestamp_format(self, test_db, org_and_users):
        """Test Claude log creation with invalid timestamp format"""
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        data = {
            "hook_stdin": json.dumps({"test": "data"}),
            "hook_timestamp": "invalid-timestamp-format"
        }
        
        response = client.post(
            "/v0/claude/log",
            json=data,
            headers=headers
        )
        
        assert response.status_code == 200  # Should succeed with fallback timestamp
        log_id = response.json()["log_id"]
        
        # Verify a timestamp was still stored (fallback to current time)
        log_doc = await test_db.claude_logs.find_one({"_id": ObjectId(log_id)})
        assert "hook_timestamp" in log_doc
        assert isinstance(log_doc["hook_timestamp"], datetime)

    @pytest.mark.asyncio
    async def test_claude_log_account_level_token_rejected(self, test_db, org_and_users):
        """Test that account-level tokens are rejected for Claude logging"""
        # Use account-level token (should be rejected)
        token = org_and_users["member"]["account_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        data = {
            "hook_stdin": json.dumps({"test": "data"}),
            "hook_timestamp": datetime.now(UTC).isoformat() + 'Z'
        }
        
        response = client.post(
            "/v0/claude/log",
            json=data,
            headers=headers
        )
        
        assert response.status_code == 401
        assert "Invalid token or token not associated with an organization" in response.json()["detail"]


class TestListClaudeLogsEndpoint:
    """Test the GET /v0/orgs/{organization_id}/claude/logs endpoint"""

    # Removed sample_logs fixture - tests now create their own data

    @pytest.mark.asyncio
    async def test_list_claude_logs_success(self, test_db, org_and_users):
        """Test successful listing of Claude logs"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create some test logs first
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "test-1", "hook_event_name": "UserPromptSubmit"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "test-2", "hook_event_name": "PreToolUse"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert data["total"] == 2
        assert len(data["logs"]) == 2

    @pytest.mark.asyncio
    async def test_list_claude_logs_pagination(self, test_db, org_and_users):
        """Test pagination in Claude logs listing"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create 5 test logs
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": f"test-{i}"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
            for i in range(5)
        ])
        
        # Test skip and limit
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?skip=2&limit=2",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["skip"] == 2
        assert data["limit"] == 2
        assert len(data["logs"]) == 2

    @pytest.mark.asyncio
    async def test_list_claude_logs_filter_by_session_id(self, test_db, org_and_users):
        """Test filtering Claude logs by session ID"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create test logs with specific session IDs
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "session-0", "hook_event_name": "UserPromptSubmit"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "session-1", "hook_event_name": "PreToolUse"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?session_id=session-0",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["logs"]) == 1
        assert data["logs"][0]["hook_stdin"]["session_id"] == "session-0"

    @pytest.mark.asyncio
    async def test_list_claude_logs_filter_by_hook_event_name(self, test_db, org_and_users):
        """Test filtering Claude logs by hook event name"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create test logs with different hook event names
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"hook_event_name": "UserPromptSubmit", "session_id": "test-1"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"hook_event_name": "UserPromptSubmit", "session_id": "test-2"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"hook_event_name": "PreToolUse", "session_id": "test-3"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?hook_event_name=UserPromptSubmit",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # 2 logs with UserPromptSubmit
        assert all(log["hook_stdin"]["hook_event_name"] == "UserPromptSubmit" for log in data["logs"])

    @pytest.mark.asyncio
    async def test_list_claude_logs_filter_by_tool_name(self, test_db, org_and_users):
        """Test filtering Claude logs by tool name"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create test logs with tool names
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"tool_name": "tool-1", "session_id": "test-1"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"tool_name": "tool-2", "session_id": "test-2"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?tool_name=tool-1",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["logs"][0]["hook_stdin"]["tool_name"] == "tool-1"

    @pytest.mark.asyncio
    async def test_list_claude_logs_filter_by_permission_mode(self, test_db, org_and_users):
        """Test filtering Claude logs by permission mode"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create test logs with permission modes
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"permission_mode": "default", "session_id": "test-1"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"permission_mode": "default", "session_id": "test-2"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"permission_mode": "restricted", "session_id": "test-3"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?permission_mode=default",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # 2 logs have permission_mode=default
        assert all(log["hook_stdin"]["permission_mode"] == "default" for log in data["logs"])

    @pytest.mark.asyncio
    async def test_list_claude_logs_filter_by_timestamp_range(self, test_db, org_and_users):
        """Test filtering Claude logs by timestamp range"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create test logs with specific timestamps
        base_time = datetime.now(UTC)
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "test-1"},
                "hook_timestamp": base_time - timedelta(minutes=3),
                "upload_timestamp": base_time - timedelta(minutes=3)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "test-2"},
                "hook_timestamp": base_time - timedelta(minutes=2),
                "upload_timestamp": base_time - timedelta(minutes=2)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "test-3"},
                "hook_timestamp": base_time - timedelta(minutes=1),
                "upload_timestamp": base_time - timedelta(minutes=1)
            }
        ])
        
        # Filter for logs between 2 and 1 minutes ago
        start_time = (base_time - timedelta(minutes=2, seconds=30)).isoformat() + 'Z'
        end_time = (base_time - timedelta(seconds=30)).isoformat() + 'Z'
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?start_time={start_time}&end_time={end_time}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        # Should return 2 logs (test-2 and test-3)
        assert data["total"] == 2

    @pytest.mark.asyncio
    async def test_list_claude_logs_combined_filters(self, test_db, org_and_users):
        """Test combining multiple filters"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create test logs with different combinations
        await test_db.claude_logs.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"hook_event_name": "UserPromptSubmit", "permission_mode": "default", "session_id": "test-1"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"hook_event_name": "UserPromptSubmit", "permission_mode": "default", "session_id": "test-2"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"hook_event_name": "PreToolUse", "permission_mode": "default", "session_id": "test-3"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?hook_event_name=UserPromptSubmit&permission_mode=default&limit=2",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 2
        assert data["total"] == 2
        assert all(log["hook_stdin"]["hook_event_name"] == "UserPromptSubmit" for log in data["logs"])
        assert all(log["hook_stdin"]["permission_mode"] == "default" for log in data["logs"])

    def test_list_claude_logs_unauthorized_access(self, org_and_users):
        """Test unauthorized access to Claude logs"""
        org_id = org_and_users["org_id"]
        
        # No authorization header
        response = client.get(f"/v0/orgs/{org_id}/claude/logs")
        assert response.status_code == 403  # FastAPI returns 403 for missing auth
        
        # Invalid token
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get(f"/v0/orgs/{org_id}/claude/logs", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_claude_logs_outsider_access_denied(self, test_db, org_and_users):
        """Test that users outside the organization cannot access logs"""
        org_id = org_and_users["org_id"]
        outsider_token = org_and_users["outsider"]["token"]
        headers = {"Authorization": f"Bearer {outsider_token}"}
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs",
            headers=headers
        )
        
        assert response.status_code == 403
        assert "not a member of this organization" in response.json()["detail"]

    def test_list_claude_logs_invalid_timestamp_format(self, org_and_users):
        """Test invalid timestamp format in filters"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?start_time=invalid-timestamp",
            headers=headers
        )
        
        assert response.status_code == 400
        assert "Invalid start_time format" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_claude_logs_empty_result(self, test_db, org_and_users):
        """Test listing logs when no logs exist"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert len(data["logs"]) == 0

    @pytest.mark.asyncio
    async def test_list_claude_logs_limit_validation(self, test_db, org_and_users):
        """Test limit parameter validation"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test limit too high (should be capped at 100)
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?limit=200",
            headers=headers
        )
        
        assert response.status_code == 422  # FastAPI validation error for limit > 100
        
        # Test limit too low (should be at least 1)
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?limit=0",
            headers=headers
        )
        
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_list_claude_logs_skip_validation(self, test_db, org_and_users):
        """Test skip parameter validation"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test negative skip (should be at least 0)
        response = client.get(
            f"/v0/orgs/{org_id}/claude/logs?skip=-1",
            headers=headers
        )
        
        assert response.status_code == 422  # Validation error


class TestClaudeHookEndpoint:
    """Test the POST /v0/claude/hook endpoint"""

    @pytest.mark.asyncio
    async def test_claude_hook_success(self, test_db, org_and_users, sample_claude_hook_data):
        """Test successful Claude hook creation"""
        # Use the member token (has access to the org)
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.post(
            "/v0/claude/hook",
            json=sample_claude_hook_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "hook_id" in data
        assert data["hook_id"] is not None
        
        # Verify the hook was saved to the database
        hook_id = data["hook_id"]
        hook_doc = await test_db.claude_hooks.find_one({"_id": ObjectId(hook_id)})
        assert hook_doc is not None
        assert hook_doc["organization_id"] == org_and_users["org_id"]
        assert hook_doc["hook_stdin"]["session_id"] == "test-session-456"
        assert hook_doc["hook_stdin"]["hook_event_name"] == "ToolUse"

    @pytest.mark.asyncio
    async def test_claude_hook_with_error(self, test_db, org_and_users, sample_claude_hook_data_with_error):
        """Test Claude hook creation with error data"""
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.post(
            "/v0/claude/hook",
            json=sample_claude_hook_data_with_error,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "hook_id" in data
        
        # Verify the error data was saved correctly
        hook_id = data["hook_id"]
        hook_doc = await test_db.claude_hooks.find_one({"_id": ObjectId(hook_id)})
        assert hook_doc["hook_stdin"]["hook_event_name"] == "ToolError"
        assert hook_doc["hook_stdin"]["error"] == "Tool not found"

    def test_claude_hook_missing_auth_header(self, sample_claude_hook_data):
        """Test Claude hook creation without authorization header"""
        response = client.post(
            "/v0/claude/hook",
            json=sample_claude_hook_data
        )
        
        assert response.status_code == 401
        assert "Missing Authorization header" in response.json()["detail"]

    def test_claude_hook_invalid_auth_format(self, sample_claude_hook_data):
        """Test Claude hook creation with invalid authorization format"""
        headers = {"Authorization": "InvalidFormat token123"}
        
        response = client.post(
            "/v0/claude/hook",
            json=sample_claude_hook_data,
            headers=headers
        )
        
        assert response.status_code == 401
        assert "Invalid Authorization header format" in response.json()["detail"]

    def test_claude_hook_invalid_token(self, sample_claude_hook_data):
        """Test Claude hook creation with invalid token"""
        headers = {"Authorization": "Bearer invalid-token"}
        
        response = client.post(
            "/v0/claude/hook",
            json=sample_claude_hook_data,
            headers=headers
        )
        
        assert response.status_code == 401
        assert "Invalid token" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_claude_hook_invalid_timestamp(self, test_db, org_and_users):
        """Test Claude hook creation with invalid timestamp"""
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        invalid_hook_data = {
            "hook_stdin": json.dumps({"session_id": "test-session"}),
            "hook_timestamp": "invalid-timestamp"
        }
        
        response = client.post(
            "/v0/claude/hook",
            json=invalid_hook_data,
            headers=headers
        )
        
        # Should still succeed but use current time as fallback
        assert response.status_code == 200
        data = response.json()
        assert "hook_id" in data
        
        # Verify the hook was saved with current time
        hook_id = data["hook_id"]
        hook_doc = await test_db.claude_hooks.find_one({"_id": ObjectId(hook_id)})
        assert hook_doc is not None
        # The timestamp should be close to current time (within 1 minute)
        current_time = datetime.now(UTC)
        # Ensure both datetimes are timezone-aware for comparison
        hook_timestamp = hook_doc["hook_timestamp"]
        if hook_timestamp.tzinfo is None:
            hook_timestamp = hook_timestamp.replace(tzinfo=UTC)
        time_diff = abs((current_time - hook_timestamp).total_seconds())
        assert time_diff < 60  # Within 1 minute

    @pytest.mark.asyncio
    async def test_claude_hook_account_level_token_rejected(self, test_db, org_and_users):
        """Test that account-level tokens are rejected for hook creation"""
        # Create an account-level token (no organization_id)
        account_token = org_and_users["member"]["account_token"]
        headers = {"Authorization": f"Bearer {account_token}"}
        
        hook_data = {
            "hook_stdin": json.dumps({"session_id": "test-session"}),
            "hook_timestamp": datetime.now(UTC).isoformat() + 'Z'
        }
        
        response = client.post(
            "/v0/claude/hook",
            json=hook_data,
            headers=headers
        )
        
        assert response.status_code == 401
        assert "Invalid token or token not associated with an organization" in response.json()["detail"]


class TestListClaudeHooksEndpoint:
    """Test the GET /v0/orgs/{organization_id}/claude/hooks endpoint"""

    @pytest.mark.asyncio
    async def test_list_claude_hooks_success(self, test_db, org_and_users):
        """Test successful listing of Claude hooks"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create some test hooks first
        await test_db.claude_hooks.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "test-1", "hook_event_name": "ToolUse"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "test-2", "hook_event_name": "ToolError"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "hooks" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert data["total"] == 2
        assert len(data["hooks"]) == 2

    @pytest.mark.asyncio
    async def test_list_claude_hooks_pagination(self, test_db, org_and_users):
        """Test pagination for listing Claude hooks"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create 5 test hooks
        hooks_data = []
        for i in range(5):
            hooks_data.append({
                "organization_id": org_id,
                "hook_stdin": {"session_id": f"test-{i}", "hook_event_name": "ToolUse"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            })
        await test_db.claude_hooks.insert_many(hooks_data)
        
        # Test first page
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?skip=0&limit=2",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["skip"] == 0
        assert data["limit"] == 2
        assert len(data["hooks"]) == 2
        
        # Test second page
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?skip=2&limit=2",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["skip"] == 2
        assert data["limit"] == 2
        assert len(data["hooks"]) == 2

    @pytest.mark.asyncio
    async def test_list_claude_hooks_filtering(self, test_db, org_and_users):
        """Test filtering for listing Claude hooks"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create test hooks with different session IDs
        await test_db.claude_hooks.insert_many([
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "session-123", "hook_event_name": "ToolUse"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            },
            {
                "organization_id": org_id,
                "hook_stdin": {"session_id": "session-456", "hook_event_name": "ToolError"},
                "hook_timestamp": datetime.now(UTC),
                "upload_timestamp": datetime.now(UTC)
            }
        ])
        
        # Filter by session ID
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?session_id=session-123",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["hooks"][0]["hook_stdin"]["session_id"] == "session-123"
        
        # Filter by hook event name
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?hook_event_name=ToolError",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["hooks"][0]["hook_stdin"]["hook_event_name"] == "ToolError"

    def test_list_claude_hooks_unauthorized_user(self, org_and_users):
        """Test listing hooks with unauthorized user"""
        org_id = org_and_users["org_id"]
        # Use a token from a user who is not a member of the organization
        outsider_token = org_and_users["outsider"]["token"]
        headers = {"Authorization": f"Bearer {outsider_token}"}
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks",
            headers=headers
        )
        
        assert response.status_code == 403
        assert "not a member of this organization" in response.json()["detail"]

    def test_list_claude_hooks_invalid_timestamp_format(self, org_and_users):
        """Test invalid timestamp format in filters"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?start_time=invalid-timestamp",
            headers=headers
        )
        
        assert response.status_code == 400
        assert "Invalid start_time format" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_claude_hooks_empty_result(self, test_db, org_and_users):
        """Test listing hooks when no hooks exist"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert len(data["hooks"]) == 0

    @pytest.mark.asyncio
    async def test_list_claude_hooks_limit_validation(self, test_db, org_and_users):
        """Test limit parameter validation"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test limit too high (should be capped at 100)
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?limit=200",
            headers=headers
        )
        
        assert response.status_code == 422  # FastAPI validation error for limit > 100
        
        # Test limit too low (should be at least 1)
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?limit=0",
            headers=headers
        )
        
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_list_claude_hooks_skip_validation(self, test_db, org_and_users):
        """Test skip parameter validation"""
        org_id = org_and_users["org_id"]
        token = org_and_users["member"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test negative skip (should be at least 0)
        response = client.get(
            f"/v0/orgs/{org_id}/claude/hooks?skip=-1",
            headers=headers
        )
        
        assert response.status_code == 422  # Validation error
