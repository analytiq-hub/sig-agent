"""
Test for the SigAgentClient class.
"""

import pytest
import sys
import os
from unittest.mock import patch, MagicMock
import json
import requests
import pathlib

# Add the backend directory to the Python path
#sys.path.append(str(pathlib.Path(__file__).parent.parent.parent.parent))

# Add the packages directory to the Python path
TOP_DIR = pathlib.Path(__file__).parent.parent.parent.parent
sys.path.append(str(TOP_DIR / "packages"))

# Import test utilities using absolute import
from tests.conftest_utils import (
    client as api_client, TEST_ORG_ID, 
    get_auth_headers
)

# Import the SigAgentClient
from sigagent_sdk import SigAgentClient

@pytest.fixture
def sigagent_client():
    """Create a SigAgentClient instance for testing"""
    return SigAgentClient(
        base_url="http://test-api.example.com",
        api_token="test-token"
    )


def test_init(sigagent_client):
    """Test client initialization"""
    assert sigagent_client.base_url == "http://test-api.example.com"
    assert sigagent_client.api_token == "test-token"
    assert sigagent_client.session is not None
    
    # Check that the API modules are initialized
    assert hasattr(sigagent_client, "documents")
    assert hasattr(sigagent_client, "ocr")
    assert hasattr(sigagent_client, "llm")
    assert hasattr(sigagent_client, "schemas")
    assert hasattr(sigagent_client, "prompts")
    assert hasattr(sigagent_client, "tags")


@patch("requests.Session.request")
def test_request_with_token(mock_request, sigagent_client):
    """Test request method with authorization token"""
    # Setup mock response
    mock_response = MagicMock()
    mock_response.content = json.dumps({"test": "data"}).encode("utf-8")
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {"test": "data"}
    mock_request.return_value = mock_response
    
    # Call the request method
    result = sigagent_client.request("GET", "/test/path", params={"key": "value"})
    
    # Verify the request was made with the correct parameters
    mock_request.assert_called_once_with(
        "GET", 
        "http://test-api.example.com/test/path", 
        headers={"Authorization": "Bearer test-token"},
        params={"key": "value"}
    )
    
    # Verify the result
    assert result == {"test": "data"}


@patch("requests.Session.request")
def test_request_without_token(mock_request):
    """Test request method without authorization token"""
    # Create client without token
    client_without_token = SigAgentClient(base_url="http://test-api.example.com")
    
    # Setup mock response
    mock_response = MagicMock()
    mock_response.content = json.dumps({"test": "data"}).encode("utf-8")
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {"test": "data"}
    mock_request.return_value = mock_response
    
    # Call the request method
    result = client_without_token.request("GET", "/test/path")
    
    # Verify the request was made with the correct parameters (no auth header)
    mock_request.assert_called_once_with(
        "GET", 
        "http://test-api.example.com/test/path", 
        headers={}
    )
    
    # Verify the result
    assert result == {"test": "data"}


@patch("requests.Session.request")
def test_request_error_handling(mock_request, sigagent_client):
    """Test error handling in request method"""
    # Setup mock error response
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("Error")
    mock_response.json.return_value = {"detail": "Custom error message"}
    mock_response.status_code = 400
    mock_request.return_value = mock_response
    
    # Test error handling
    with pytest.raises(Exception) as excinfo:
        sigagent_client.request("GET", "/error/path")
    
    # Verify error message contains the custom error detail
    assert "API Error (400): Custom error message" in str(excinfo.value)


@patch("requests.Session.request")
def test_request_text_response(mock_request, sigagent_client):
    """Test handling of text response"""
    # Setup mock text response
    mock_response = MagicMock()
    mock_response.content = "Sample text response".encode("utf-8")
    mock_response.headers = {"content-type": "text/plain"}
    mock_response.text = "Sample text response"
    mock_request.return_value = mock_response
    
    # Call the request method
    result = sigagent_client.request("GET", "/text/path")
    
    # Verify the result
    assert result == "Sample text response"


@patch("requests.Session.request")
def test_request_binary_response(mock_request, sigagent_client):
    """Test handling of binary response"""
    # Setup mock binary response
    binary_data = b"\x00\x01\x02\x03"
    mock_response = MagicMock()
    mock_response.content = binary_data
    mock_response.headers = {"content-type": "application/octet-stream"}
    mock_request.return_value = mock_response
    
    # Call the request method
    result = sigagent_client.request("GET", "/binary/path")
    
    # Verify the result
    assert result == binary_data
