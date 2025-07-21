"""
Shared test utilities for backend tests.
This module contains common fixtures, test data, and helper functions.
"""

import pytest
import pytest_asyncio
import os
import sys
from datetime import datetime, UTC
import motor.motor_asyncio
from fastapi.testclient import TestClient
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
import uuid

# Set up the path first, before other imports
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/..")

# Now import the FastAPI app and dependencies
from docrouter_app.main import app, security, get_current_user, get_admin_user
from docrouter_app.models import User
import analytiq_data as ad

def setup_env():
    """Set up the environment variables for the tests"""
    os.environ["ENV"] = "pytest"
    os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
    os.environ["FASTAPI_SECRET"] = "test_secret_key_for_tests"

# Set test environment variables
setup_env()

# Create a test client
client = TestClient(app)

# Use a valid ObjectId format for user_id (24-character hex string)
TEST_USER_ID = "6579a94b1f1d8f5a8e9c0124"

# Common test data
TEST_USER = User(
    user_id=TEST_USER_ID,
    user_name="test@example.com",
    token_type="jwt"
)

# Use a valid ObjectId format (24-character hex string)
TEST_ORG_ID = "6579a94b1f1d8f5a8e9c0123"

@pytest_asyncio.fixture
async def test_db(unique_db_name):
    """Set up and tear down a unique test database per worker/session"""
    client = motor.motor_asyncio.AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client[unique_db_name]
    
    # Verify we're using the test database
    if not os.environ["ENV"].startswith("pytest"):
        raise ValueError(f"Test is not using the test database! ENV={os.environ['ENV']}")
    
    # Clear the database before each test
    collections = await db.list_collection_names()
    for collection in collections:
        await db.drop_collection(collection)
    
    # Create a test user in the database
    await db.users.insert_one({
        "_id": ObjectId(TEST_USER_ID),
        "email": "test@example.com",
        "name": "Test User",
        "role": "admin",
        "emailVerified": True,
        "hasPassword": True,
        "createdAt": datetime.now(UTC)
    })
    
    # Create a test organization in the database
    await db.organizations.insert_one({
        "_id": ObjectId(TEST_ORG_ID),
        "name": "Test Organization",
        "members": [{
            "user_id": TEST_USER_ID,
            "role": "admin"
        }],
        "type": "team",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    })
    
    yield db
    
    # Clean up after test - ONLY if we're using the test database
    if os.environ["ENV"].startswith("pytest"):
        collections = await db.list_collection_names()
        for collection in collections:
            await db.drop_collection(collection)
    else:
        # This should never happen, but just in case
        raise ValueError(f"Attempted to clean up non-test database! ENV={os.environ['ENV']}")

def get_auth_headers():
    """Get authentication headers for test requests"""
    return {
        "Authorization": "Bearer test_token",
        "Content-Type": "application/json"
    }

@pytest.fixture
def mock_auth():
    """Set up and tear down authentication mocking"""
    # Create proper credentials object
    mock_credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="test_token"
    )

    # Override authentication dependencies
    app.dependency_overrides = {
        security: lambda: mock_credentials,
        get_current_user: lambda: TEST_USER,
        get_admin_user: lambda: TEST_USER  # Also mock the admin user dependency
    }
    
    yield
    
    # Clean up
    app.dependency_overrides.clear() 