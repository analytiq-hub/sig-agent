import pytest_asyncio
import pytest
from mongomock_motor import AsyncMongoMockClient
import os
import sys

# Set up the path first, before other imports
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/..")

import analytiq_data as ad

# Use the async fixture decorator from pytest_asyncio
@pytest_asyncio.fixture
async def db():
    client = AsyncMongoMockClient()
    db = client.test_database
    await db.create_collection("collection1")
    await db.create_collection("collection2")
    return db

# Mark the test as async; pytest_asyncio will handle the async fixture
@pytest.mark.asyncio
async def test_list_collections(db):
    collections = await db.list_collection_names()
    print("Collections in the database:", collections)
    assert set(collections) == {"collection1", "collection2"}

# New test for adding and checking records
@pytest.mark.asyncio
async def test_add_and_check_record(db):
    # Create a test record
    test_record = {
        "name": "Test Item",
        "value": 42,
        "tags": ["test", "example"]
    }
    
    # Insert the record into collection1
    result = await db.collection1.insert_one(test_record)
    
    # Verify the insert was successful by checking the inserted_id
    assert result.inserted_id is not None
    
    # Retrieve the record from the database
    retrieved_record = await db.collection1.find_one({"_id": result.inserted_id})

    ad.log.info(f"Retrieved record: {retrieved_record}")
    
    # Verify the retrieved record matches what we inserted
    assert retrieved_record is not None
    assert retrieved_record["name"] == "Test Item"
    assert retrieved_record["value"] == 42
    assert "test" in retrieved_record["tags"]
    assert "example" in retrieved_record["tags"]
    
    # Count documents to verify there's exactly one record
    count = await db.collection1.count_documents({})
    assert count == 1