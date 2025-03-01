import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
import base64
import os
import sys
from datetime import datetime, UTC
import mongomock
import mongomock_motor
import motor.motor_asyncio
from unittest.mock import patch
from fastapi import Security
from fastapi.security import HTTPAuthorizationCredentials

# Set up the path first, before other imports
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/..")

# Import the FastAPI app and dependencies
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
async def mock_db():
    """Create a mock MongoDB client"""
    mock_client = mongomock_motor.AsyncMongoMockClient()
    db = mock_client.test
    
    # Create required collections
    collections = ["docs", "files.files", "files.chunks", "tags"]
    for collection in collections:
        await db.create_collection(collection)

    # Return the database as a coroutine
    return db

@pytest.fixture
def mock_analytiq_client(mock_db):
    """Mock the AnalytiqClient"""
    class MockAnalytiqClient:
        def __init__(self, db):
            self.env = "test"
            self.name = "test"
            self.mongodb_async = db
            self.mongodb = None

    return MockAnalytiqClient(mock_db)

def get_auth_headers():
    """Get authentication headers for test requests"""
    return {
        "Authorization": "Bearer test_token",
        "Content-Type": "application/json"
    }

@pytest.mark.asyncio
async def test_db_connection(mock_db):
    """Test database connection"""
    assert mock_db is not None

    # List all collections in the database
    collections = await mock_db.list_collection_names()
    print(collections)

@pytest.mark.asyncio
async def test_upload_document(mock_db, mock_analytiq_client, test_pdf):
    """Test document upload endpoint"""
    
    # No need to await mock_db, it's already resolved
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

    # Override dependencies
    app.dependency_overrides = {
        security: lambda: mock_credentials,
        get_current_user: lambda: TEST_USER,
        ad.common.get_async_db: mock_db,
        ad.common.get_analytiq_client: lambda: mock_analytiq_client
    }
    
    try:
        # Make request to upload endpoint
        response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/documents",
            json=upload_data,
            headers=get_auth_headers()
        )

        # Check response
        assert response.status_code == 200
        data = response.json()
        assert "uploaded_documents" in data
        assert len(data["uploaded_documents"]) == 1
        assert data["uploaded_documents"][0]["document_name"] == "test.pdf"

        # List all collections in the database
        collections = await mock_db.list_collection_names()
        print(f"Collections in the database: {collections}")

        # List all documents in the docs collection
        docs = await mock_db["docs"].find().to_list(length=None)
        print(f"Documents in the docs collection: {docs}")

        # Verify document was saved in mock database
        doc = await mock_db["docs"].find_one({  # Use mock_db directly
            "organization_id": TEST_ORG_ID,
            "user_file_name": "test.pdf"
        })
        assert doc is not None
        assert doc["state"] == ad.common.doc.DOCUMENT_STATE_UPLOADED

        # Verify file was saved
        file = await mock_db["files.files"].find_one({  # Use mock_db directly
            "filename": doc["mongo_file_name"]
        })
        assert file is not None

    finally:
        app.dependency_overrides.clear()