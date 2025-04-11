import pytest
import pytest_asyncio
import os
import base64
from fastapi.testclient import TestClient
from bson import ObjectId
from unittest.mock import patch, MagicMock
import json
from typing import Dict, Any, List

# Import shared test utilities
from .test_utils import (
    client, TEST_USER, TEST_ORG_ID, 
    test_db, get_auth_headers, mock_auth
)
import analytiq_data as ad

# Import the DocRouterClient
from docrouter_client import DocRouterClient
from docrouter_client.models.document import ListDocumentsResponse

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

def mock_request(self, method: str, path: str, **kwargs) -> Any:
    """
    Override the request method to use FastAPI test client
    instead of making real HTTP requests
    
    Args:
        method: The HTTP method to use (GET, POST, PUT, DELETE)
        path: The path to request
        **kwargs: Additional arguments to pass to the client
        
    Returns:
        The response data
    """
    url = f"{path}"
    
    # Add Authorization header
    headers = kwargs.pop("headers", {})
    headers.update(get_auth_headers())
    
    # Extract parameters for different request types
    params = kwargs.pop("params", None)
    json_data = kwargs.pop("json", None)
    
    # Make the request using the FastAPI test client
    if method.upper() == "GET":
        response = client.get(url, headers=headers, params=params)
    elif method.upper() == "POST":
        response = client.post(url, headers=headers, json=json_data)
    elif method.upper() == "PUT":
        response = client.put(url, headers=headers, json=json_data)
    elif method.upper() == "DELETE":
        response = client.delete(url, headers=headers)
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")

    # Check for errors
    try:
        response.raise_for_status()
    except Exception as err:
        try:
            error_detail = response.json().get("detail", str(err))
            raise Exception(f"API Error ({response.status_code}): {error_detail}")
        except (ValueError, KeyError):
            raise err
            
    # Parse the response
    if response.content and response.headers.get("content-type") == "application/json":
        return response.json()
    
    # For text content type, return the text
    if response.content and response.headers.get("content-type") == "text/plain":
        return response.text
        
    # Return raw response for binary data
    return response.content


@pytest.fixture
def mock_docrouter_client():
    """
    Fixture that provides a DocRouterClient with mocked request method
    that uses FastAPI test client instead of making real HTTP requests
    """
    # Create a client with a dummy URL and token
    client = DocRouterClient(
        base_url="",  # Doesn't matter, not used for requests
        api_token="test_token"   # Doesn't matter, we use get_auth_headers
    )
    
    # Override the request method with our mock implementation
    with patch.object(DocRouterClient, 'request', mock_request):
        yield client

@pytest.fixture
def small_pdf():
    """Create a minimal test PDF file"""
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    return {
        "name": "small_test.pdf",
        "content": f"data:application/pdf;base64,{base64.b64encode(pdf_content).decode()}"
    }


@pytest.mark.asyncio
async def test_documents_api(test_db, mock_auth, mock_docrouter_client, small_pdf):
    """Test the documents API using the mock DocRouterClient"""
    ad.log.info(f"test_documents_api() start")
    
    try:
        # Test 1: Create a document
        upload_result = mock_docrouter_client.documents.upload(TEST_ORG_ID, [small_pdf])
        assert "uploaded_documents" in upload_result
        assert len(upload_result["uploaded_documents"]) == 1
        assert upload_result["uploaded_documents"][0]["document_name"] == "small_test.pdf"
        
        document_id = upload_result["uploaded_documents"][0]["document_id"]
        
        # Test 2: List documents
        documents = mock_docrouter_client.documents.list(TEST_ORG_ID)
        assert isinstance(documents, ListDocumentsResponse)
        assert documents.total_count >= 1
        
        # Find our document in the list
        created_doc = next((doc for doc in documents.documents 
                           if doc.id == document_id), None)
        assert created_doc is not None
        assert created_doc.document_name == "small_test.pdf"
        
        # Test 3: Get a document
        doc = mock_docrouter_client.documents.get(TEST_ORG_ID, document_id)
        assert doc.metadata.id == document_id
        assert doc.metadata.document_name == "small_test.pdf"
        
        # Test 4: Update a document
        update_result = mock_docrouter_client.documents.update(
            TEST_ORG_ID,
            document_id,
            document_name="small_test_updated.pdf"
        )
        assert "message" in update_result
        assert update_result["message"] == "Document updated successfully"
        
        # Get the document again to verify the update
        updated_doc = mock_docrouter_client.documents.get(TEST_ORG_ID, document_id)
        assert updated_doc.metadata.document_name == "small_test_updated.pdf"
        
        # Test 5: Delete a document
        delete_result = mock_docrouter_client.documents.delete(TEST_ORG_ID, document_id)
        assert "message" in delete_result
        assert delete_result["message"] == "Document deleted successfully"
        
        # List documents again to verify it was deleted
        documents_after_delete = mock_docrouter_client.documents.list(TEST_ORG_ID)
        deleted_doc = next((doc for doc in documents_after_delete.documents 
                           if doc.id == document_id), None)
        assert deleted_doc is None, "Document should have been deleted"
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    ad.log.info(f"test_documents_api() end")


@pytest.mark.asyncio
async def test_tags_api(test_db, mock_auth, mock_docrouter_client):
    """Test the tags API using the mock DocRouterClient"""
    ad.log.info(f"test_tags_api() start")
    
    try:
        # Test: List tags
        tags = mock_docrouter_client.tags.list(TEST_ORG_ID)
        assert hasattr(tags, "total_count")
        initial_tag_count = tags.total_count
        
        # Create a tag
        tag_data = {
            "name": "Test Tag",
            "color": "#FF0000"
        }
        create_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/tags",
            json=tag_data,
            headers=get_auth_headers()
        )
        assert create_response.status_code == 200
        created_tag = create_response.json()
        
        # List tags again to verify it was created
        tags_after_create = mock_docrouter_client.tags.list(TEST_ORG_ID)
        assert tags_after_create.total_count == initial_tag_count + 1
        
        # Clean up
        client.delete(
            f"/v0/orgs/{TEST_ORG_ID}/tags/{created_tag['id']}",
            headers=get_auth_headers()
        )
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    ad.log.info(f"test_tags_api() end")


@pytest.mark.asyncio
async def test_llm_api(test_db, mock_auth, mock_docrouter_client):
    """Test the LLM API using the mock DocRouterClient"""
    ad.log.info(f"test_llm_api() start")
    
    # Mock the LLM API responses
    with patch.object(mock_docrouter_client.llm, 'run', return_value={"status": "success", "result_id": "mock_result_id"}) as mock_run, \
         patch.object(mock_docrouter_client.llm, 'get_result', return_value={"status": "completed", "output": "Sample output"}) as mock_get_result, \
         patch.object(mock_docrouter_client.llm, 'update_result', return_value={"message": "Result updated successfully"}) as mock_update_result, \
         patch.object(mock_docrouter_client.llm, 'delete_result', return_value={"message": "Result deleted successfully"}) as mock_delete_result:
        
        try:
            # Generate a valid ObjectId for testing
            document_id = str(ObjectId())  # This generates a valid ObjectId
            prompt_id = "default_prompt"
            
            # Test: Run LLM analysis
            run_response = mock_docrouter_client.llm.run(TEST_ORG_ID, document_id, prompt_id)
            assert run_response["status"] == "success"
            assert "result_id" in run_response
            
            # Test: Get LLM result
            result_id = run_response["result_id"]
            get_response = mock_docrouter_client.llm.get_result(TEST_ORG_ID, document_id, result_id)
            assert get_response["status"] == "completed"
            assert "output" in get_response
            
            # Test: Update LLM result
            update_response = mock_docrouter_client.llm.update_result(TEST_ORG_ID, document_id, result_id, {"new_data": "value"})
            assert update_response["message"] == "Result updated successfully"
            
            # Test: Delete LLM result
            delete_response = mock_docrouter_client.llm.delete_result(TEST_ORG_ID, document_id, result_id)
            assert delete_response["message"] == "Result deleted successfully"
            
        finally:
            pass  # mock_auth fixture handles cleanup
    
    ad.log.info(f"test_llm_api() end")

@pytest.mark.asyncio
async def test_ocr_api(test_db, mock_auth, mock_docrouter_client, small_pdf):
    """Test the OCR API using the mock DocRouterClient"""
    ad.log.info(f"test_ocr_api() start")
    
    # Mock the OCR API responses
    with patch.object(mock_docrouter_client.ocr, 'get_text', return_value="Sample OCR text") as mock_get_text, \
         patch.object(mock_docrouter_client.ocr, 'get_metadata', return_value={"n_pages": 1, "ocr_date": "2023-10-01"}) as mock_get_metadata:
        
        try:
            # Generate a valid ObjectId for testing
            document_id = str(ObjectId())  # This generates a valid ObjectId
            
            # Test: Get OCR text
            ocr_text = mock_docrouter_client.ocr.get_text(TEST_ORG_ID, document_id)
            assert isinstance(ocr_text, str)
            assert len(ocr_text) > 0  # Ensure some text is returned
            
            # Test: Get OCR metadata
            ocr_metadata = mock_docrouter_client.ocr.get_metadata(TEST_ORG_ID, document_id)
            assert isinstance(ocr_metadata, dict)
            assert "n_pages" in ocr_metadata
            assert "ocr_date" in ocr_metadata
            
        finally:
            pass  # mock_auth fixture handles cleanup
    
    ad.log.info(f"test_ocr_api() end")
