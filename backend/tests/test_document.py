import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
import base64
import os
import sys
from datetime import datetime, UTC
import motor.motor_asyncio
from unittest.mock import patch
from fastapi import Security
from fastapi.security import HTTPAuthorizationCredentials

# Set test environment variables before importing the application
os.environ["ENV"] = "pytest"
os.environ["MONGODB_URI"] = "mongodb://localhost:27017"

# Set up the path first, before other imports
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/..")

# Now import the FastAPI app and dependencies
from api.main import app, security, get_current_user
from api.schemas import User
import analytiq_data as ad

# Create a test client
client = TestClient(app)

# Test data
TEST_USER = User(
    user_id="test123",
    user_name="test@example.com",
    token_type="jwt"
)

TEST_ORG_ID = "test_org_123"

@pytest.fixture
def test_pdf():
    """Create a small test PDF file"""
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    return {
        "name": "test.pdf",
        "content": f"data:application/pdf;base64,{base64.b64encode(pdf_content).decode()}"
    }

@pytest_asyncio.fixture
async def test_db():
    """Set up and tear down the test database"""
    client = motor.motor_asyncio.AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client[os.environ["ENV"]]
    
    # Clear the database before each test
    collections = await db.list_collection_names()
    for collection in collections:
        await db.drop_collection(collection)
    
    yield db
    
    # Clean up after test
    collections = await db.list_collection_names()
    for collection in collections:
        await db.drop_collection(collection)

def get_auth_headers():
    """Get authentication headers for test requests"""
    return {
        "Authorization": "Bearer test_token",
        "Content-Type": "application/json"
    }

@pytest.mark.asyncio
async def test_upload_document(test_db, test_pdf):
    """Test document upload endpoint"""
    ad.log.info(f"test_upload_document() start")
    
    # Prepare test data
    upload_data = {
        "documents": [
            {
                "name": test_pdf["name"],
                "content": test_pdf["content"],
                "tag_ids": []
            }
        ]
    }

    # Create proper credentials object
    mock_credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="test_token"
    )

    # Override only authentication dependencies
    app.dependency_overrides = {
        security: lambda: mock_credentials,
        get_current_user: lambda: TEST_USER
    }
    
    try:
        # Step 1: Upload the document
        upload_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/documents",
            json=upload_data,
            headers=get_auth_headers()
        )

        # Check upload response
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert "uploaded_documents" in upload_data
        assert len(upload_data["uploaded_documents"]) == 1
        assert upload_data["uploaded_documents"][0]["document_name"] == "test.pdf"
        
        # Get the document ID from the upload response
        document_id = upload_data["uploaded_documents"][0]["document_id"]
        
        # Step 2: List documents to verify it appears in the list
        list_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert "documents" in list_data
        assert len(list_data["documents"]) > 0
        
        # Find our document in the list
        uploaded_doc = next((doc for doc in list_data["documents"] if doc["id"] == document_id), None)
        assert uploaded_doc is not None
        assert uploaded_doc["document_name"] == "test.pdf"
        assert uploaded_doc["state"] == ad.common.doc.DOCUMENT_STATE_UPLOADED
        
        # Step 3: Get the specific document to verify its content
        get_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}",
            headers=get_auth_headers()
        )
        
        assert get_response.status_code == 200
        doc_data = get_response.json()
        assert "metadata" in doc_data
        assert doc_data["metadata"]["id"] == document_id
        assert doc_data["metadata"]["document_name"] == "test.pdf"
        assert doc_data["metadata"]["state"] == ad.common.doc.DOCUMENT_STATE_UPLOADED
        assert "content" in doc_data  # Verify the PDF content is returned
        
        # Optional: For completeness, test document deletion
        delete_response = client.delete(
            f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}",
            headers=get_auth_headers()
        )
        
        assert delete_response.status_code == 200
        
        # Verify document is gone
        get_deleted_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}",
            headers=get_auth_headers()
        )
        
        assert get_deleted_response.status_code == 404

    finally:
        app.dependency_overrides.clear()

    ad.log.info(f"test_upload_document() end")

@pytest.mark.asyncio
async def test_document_lifecycle(test_db, test_pdf):
    """Test the complete document lifecycle including tags"""
    ad.log.info(f"test_document_lifecycle() start")
    
    # Create proper credentials object
    mock_credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="test_token"
    )

    # Override only authentication dependencies
    app.dependency_overrides = {
        security: lambda: mock_credentials,
        get_current_user: lambda: TEST_USER
    }
    
    try:
        # Step 1: Create a tag
        tag_data = {
            "name": "Test Tag",
            "color": "#FF5733"
        }
        
        tag_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/tags",
            json=tag_data,
            headers=get_auth_headers()
        )
        
        assert tag_response.status_code == 200
        tag = tag_response.json()
        tag_id = tag["id"]
        
        # Step 2: Upload document with the tag
        upload_data = {
            "documents": [
                {
                    "name": test_pdf["name"],
                    "content": test_pdf["content"],
                    "tag_ids": [tag_id]
                }
            ]
        }

        upload_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/documents",
            json=upload_data,
            headers=get_auth_headers()
        )

        assert upload_response.status_code == 200
        upload_result = upload_response.json()
        document_id = upload_result["uploaded_documents"][0]["document_id"]
        
        # Step 3: List documents and verify tag
        list_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        uploaded_doc = next((doc for doc in list_data["documents"] if doc["id"] == document_id), None)
        assert uploaded_doc is not None
        assert tag_id in uploaded_doc["tag_ids"]
        
        # Step 4: Create a second tag
        second_tag_data = {
            "name": "Second Tag",
            "color": "#33FF57"
        }
        
        second_tag_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/tags",
            json=second_tag_data,
            headers=get_auth_headers()
        )
        
        assert second_tag_response.status_code == 200
        second_tag = second_tag_response.json()
        second_tag_id = second_tag["id"]
        
        # Step 5: Update document with new tag
        update_data = {
            "tag_ids": [second_tag_id]  # Replace the original tag
        }
        
        update_response = client.put(
            f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}",
            json=update_data,
            headers=get_auth_headers()
        )
        
        assert update_response.status_code == 200
        
        # Step 6: List documents again and verify updated tag
        list_response_after_update = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents",
            headers=get_auth_headers()
        )
        
        assert list_response_after_update.status_code == 200
        list_data_after_update = list_response_after_update.json()
        updated_doc = next((doc for doc in list_data_after_update["documents"] if doc["id"] == document_id), None)
        assert updated_doc is not None
        assert second_tag_id in updated_doc["tag_ids"]
        assert tag_id not in updated_doc["tag_ids"]
        
        # Step 7: Filter documents by tag
        filtered_list_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents?tag_ids={second_tag_id}",
            headers=get_auth_headers()
        )
        
        assert filtered_list_response.status_code == 200
        filtered_list_data = filtered_list_response.json()
        assert len(filtered_list_data["documents"]) > 0
        filtered_doc = next((doc for doc in filtered_list_data["documents"] if doc["id"] == document_id), None)
        assert filtered_doc is not None
        
        # Step 8: Get the specific document to verify its content and tags
        get_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}",
            headers=get_auth_headers()
        )
        
        assert get_response.status_code == 200
        doc_data = get_response.json()
        assert second_tag_id in doc_data["metadata"]["tag_ids"]
        
        # Step 9: Clean up - delete document
        delete_response = client.delete(
            f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}",
            headers=get_auth_headers()
        )
        
        assert delete_response.status_code == 200
        
        # Verify document is gone
        get_deleted_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}",
            headers=get_auth_headers()
        )
        
        assert get_deleted_response.status_code == 404

    finally:
        app.dependency_overrides.clear()

    ad.log.info(f"test_document_lifecycle() end")