import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
import os
import sys
from datetime import datetime, UTC
import motor.motor_asyncio
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId

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

# Test data - reuse from test_document.py
TEST_USER = User(
    user_id="test123",
    user_name="test@example.com",
    token_type="jwt"
)

# Use a valid ObjectId format (24-character hex string)
TEST_ORG_ID = "6579a94b1f1d8f5a8e9c0123"

@pytest_asyncio.fixture
async def test_db():
    """Set up and tear down the test database"""
    client = motor.motor_asyncio.AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client[os.environ["ENV"]]
    
    # Clear the database before each test
    collections = await db.list_collection_names()
    for collection in collections:
        await db.drop_collection(collection)
    
    # Create a test organization in the database
    await db.organizations.insert_one({
        "_id": ObjectId(TEST_ORG_ID),
        "name": "Test Organization",
        "members": [{
            "user_id": TEST_USER.user_id,
            "role": "admin"
        }],
        "type": "team",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    })
    
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
async def test_access_tokens(test_db):
    """Test the complete access token lifecycle"""
    ad.log.info(f"test_access_tokens() start")
    
    # Create proper credentials object
    mock_credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="test_token"
    )

    # Override authentication dependencies
    app.dependency_overrides = {
        security: lambda: mock_credentials,
        get_current_user: lambda: TEST_USER
    }
    
    try:
        # Step 1: Create an access token
        token_data = {
            "name": "Test API Token",
            "lifetime": 30  # 30 days
        }
        
        create_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens",
            json=token_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        token_result = create_response.json()
        assert "id" in token_result
        assert token_result["name"] == "Test API Token"
        assert token_result["lifetime"] == 30
        assert "token" in token_result  # The actual token value
        
        token_id = token_result["id"]
        
        # Step 2: List access tokens to verify it was created
        list_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert "access_tokens" in list_data
        
        # Find our token in the list
        created_token = next((token for token in list_data["access_tokens"] if token["id"] == token_id), None)
        assert created_token is not None
        assert created_token["name"] == "Test API Token"
        assert created_token["lifetime"] == 30
        
        # Step 3: Delete the access token
        delete_response = client.delete(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens/{token_id}",
            headers=get_auth_headers()
        )
        
        assert delete_response.status_code == 200
        
        # Step 4: List access tokens again to verify it was deleted
        list_after_delete_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens",
            headers=get_auth_headers()
        )
        
        assert list_after_delete_response.status_code == 200
        list_after_delete_data = list_after_delete_response.json()
        
        # Verify the token is no longer in the list
        deleted_token = next((token for token in list_after_delete_data["access_tokens"] if token["id"] == token_id), None)
        assert deleted_token is None, "Token should have been deleted"
        
    finally:
        app.dependency_overrides.clear()
    
    ad.log.info(f"test_access_tokens() end")

@pytest.mark.asyncio
async def test_account_access_tokens(test_db):
    """Test the account-level access token lifecycle"""
    ad.log.info(f"test_account_access_tokens() start")
    
    # Create proper credentials object
    mock_credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="test_token"
    )

    # Override authentication dependencies
    app.dependency_overrides = {
        security: lambda: mock_credentials,
        get_current_user: lambda: TEST_USER
    }
    
    try:
        # Step 1: Create an account-level access token
        token_data = {
            "name": "Test Account API Token",
            "lifetime": 60  # 60 days
        }
        
        create_response = client.post(
            f"/v0/account/access_tokens",
            json=token_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        token_result = create_response.json()
        assert "id" in token_result
        assert token_result["name"] == "Test Account API Token"
        assert token_result["lifetime"] == 60
        assert "token" in token_result  # The actual token value
        assert token_result["organization_id"] is None  # Should be None for account tokens
        
        token_id = token_result["id"]
        
        # Step 2: List account access tokens to verify it was created
        list_response = client.get(
            f"/v0/account/access_tokens",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert "access_tokens" in list_data
        
        # Find our token in the list
        created_token = next((token for token in list_data["access_tokens"] if token["id"] == token_id), None)
        assert created_token is not None
        assert created_token["name"] == "Test Account API Token"
        assert created_token["lifetime"] == 60
        assert created_token["organization_id"] is None
        
        # Step 3: Delete the access token
        delete_response = client.delete(
            f"/v0/account/access_tokens/{token_id}",
            headers=get_auth_headers()
        )
        
        assert delete_response.status_code == 200
        
        # Step 4: List access tokens again to verify it was deleted
        list_after_delete_response = client.get(
            f"/v0/account/access_tokens",
            headers=get_auth_headers()
        )
        
        assert list_after_delete_response.status_code == 200
        list_after_delete_data = list_after_delete_response.json()
        
        # Verify the token is no longer in the list
        deleted_token = next((token for token in list_after_delete_data["access_tokens"] if token["id"] == token_id), None)
        assert deleted_token is None, "Token should have been deleted"
        
    finally:
        app.dependency_overrides.clear()
    
    ad.log.info(f"test_account_access_tokens() end") 