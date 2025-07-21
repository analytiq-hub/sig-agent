import pytest
import os
import sys
import uuid
import pytest_asyncio
from datetime import datetime, UTC
import motor.motor_asyncio
from bson import ObjectId
from fastapi.testclient import TestClient
from fastapi.security import HTTPAuthorizationCredentials
from filelock import FileLock

# Set up the path first, before other imports
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/..")

# Now import the FastAPI app and dependencies
from docrouter_app.main import app, security, get_current_user, get_admin_user
from docrouter_app.models import User
import analytiq_data as ad

from tests.test_utils import (
    TEST_USER_ID,
    TEST_ORG_ID,
    TEST_USER
)

# Define pytest configuration
pytest_plugins = ["pytest_asyncio"]

# Set default asyncio fixture scope
def pytest_addoption(parser):
    parser.addini(
        "asyncio_default_fixture_loop_scope",
        help="default scope for asyncio fixtures",
        default="function",
    )

@pytest_asyncio.fixture(scope="session")
def unique_db_name():
    # Use xdist worker id if available, else use a UUID
    worker_id = os.environ.get("PYTEST_XDIST_WORKER")
    if worker_id:
        db_name = f"pytest_{worker_id}"
    else:
        db_name = f"pytest_{uuid.uuid4()}"

    os.environ["ENV"] = db_name
    return db_name

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

@pytest_asyncio.fixture
async def org_and_users(test_db):
    """
    Create an organization, an admin, a member, and a non-member user, and generate tokens for each.
    Returns a dict with user/org info and tokens.
    """
    from docrouter_app.main import app
    import secrets

    # Create users
    admin_id = str(ObjectId())
    member_id = str(ObjectId())
    outsider_id = str(ObjectId())

    await test_db.users.insert_many([
        {
            "_id": ObjectId(admin_id),
            "email": "admin@example.com",
            "name": "Org Admin",
            "role": "admin",
            "emailVerified": True,
            "hasPassword": True,
            "createdAt": datetime.now(UTC)
        },
        {
            "_id": ObjectId(member_id),
            "email": "member@example.com",
            "name": "Org Member",
            "role": "user",
            "emailVerified": True,
            "hasPassword": True,
            "createdAt": datetime.now(UTC)
        },
        {
            "_id": ObjectId(outsider_id),
            "email": "outsider@example.com",
            "name": "Not In Org",
            "role": "user",
            "emailVerified": True,
            "hasPassword": True,
            "createdAt": datetime.now(UTC)
        }
    ])

    # Create org with admin and member
    org_id = str(ObjectId())
    await test_db.organizations.insert_one({
        "_id": ObjectId(org_id),
        "name": "Test Org For Auth",
        "members": [
            {"user_id": admin_id, "role": "admin"},
            {"user_id": member_id, "role": "user"}
        ],
        "type": "team",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    })

    # Helper to create a token for a user (org-level)
    async def create_token(user_id, org_id, name):
        token = secrets.token_urlsafe(32)
        encrypted = ad.crypto.encrypt_token(token)
        token_doc = {
            "user_id": user_id,
            "organization_id": org_id,
            "name": name,
            "token": encrypted,
            "created_at": datetime.now(UTC),
            "lifetime": 30
        }
        await test_db.access_tokens.insert_one(token_doc)
        return token

    admin_token = await create_token(admin_id, org_id, "admin-token")
    member_token = await create_token(member_id, org_id, "member-token")
    outsider_token = await create_token(outsider_id, org_id, "outsider-token")

    return {
        "org_id": org_id,
        "admin": {"id": admin_id, "token": admin_token},
        "member": {"id": member_id, "token": member_token},
        "outsider": {"id": outsider_id, "token": outsider_token}
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