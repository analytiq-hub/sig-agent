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
        collections = await test_db.list_collection_names()
        ad.log.info(f"Collections in the database: {collections}")

        # List all documents in the docs collection
        docs = await test_db["docs"].find().to_list(length=None)
        ad.log.info(f"Documents in the docs collection: {docs}")

        # Verify document was saved in test database
        doc = await test_db["docs"].find_one({
            "organization_id": TEST_ORG_ID,
            "user_file_name": "test.pdf"
        })
        assert doc is not None
        assert doc["state"] == ad.common.doc.DOCUMENT_STATE_UPLOADED

        # Verify file was saved
        file = await test_db["files.files"].find_one({
            "filename": doc["mongo_file_name"]
        })
        ad.log.info(f"File in the files.files collection: {file}")
        assert file is not None

    finally:
        app.dependency_overrides.clear()

    ad.log.info(f"test_upload_document() end")