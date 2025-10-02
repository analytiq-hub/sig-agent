import pytest
from bson import ObjectId
import os
from datetime import datetime, UTC
import logging

# Import shared test utilities
from .conftest_utils import (
    client, TEST_ORG_ID, 
    get_auth_headers
)
import analytiq_data as ad

logger = logging.getLogger(__name__)

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

@pytest.mark.asyncio
async def test_list_users(test_db, mock_auth):
    """Test listing users endpoint"""
    logger.info(f"test_list_users() start")
    
    try:
        # List users
        list_response = client.get(
            "/v0/account/users",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert "users" in list_data
        assert "total_count" in list_data
        assert "skip" in list_data
        
        # Test with organization_id filter
        list_with_org_response = client.get(
            f"/v0/account/users?organization_id={TEST_ORG_ID}",
            headers=get_auth_headers()
        )
        
        assert list_with_org_response.status_code == 200
        
        # Test with pagination
        list_with_pagination_response = client.get(
            "/v0/account/users?skip=0&limit=5",
            headers=get_auth_headers()
        )
        
        assert list_with_pagination_response.status_code == 200
        pagination_data = list_with_pagination_response.json()
        assert len(pagination_data["users"]) <= 5
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_list_users() end")

@pytest.mark.asyncio
async def test_user_lifecycle(test_db, mock_auth):
    """Test the complete user lifecycle (create, get, update, delete)"""
    logger.info(f"test_user_lifecycle() start")
    
    try:
        # Step 1: Create a user
        user_data = {
            "email": "testuser@example.com",
            "name": "Test User",
            "password": "securePassword123"
        }
        
        create_response = client.post(
            "/v0/account/users",
            json=user_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        user_result = create_response.json()
        assert "id" in user_result
        assert user_result["email"] == "testuser@example.com"
        assert user_result["name"] == "Test User"
        assert "role" in user_result
        assert "email_verified" in user_result
        assert "has_password" in user_result
        assert user_result["has_password"] is True
        
        user_id = user_result["id"]
        
        # Step 2: Get the specific user
        get_response = client.get(
            f"/v0/account/users?user_id={user_id}",
            headers=get_auth_headers()
        )
        
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert "users" in get_data
        assert len(get_data["users"]) == 1
        assert get_data["users"][0]["id"] == user_id
        assert get_data["users"][0]["email"] == "testuser@example.com"
        
        # Step 3: Update the user
        update_data = {
            "name": "Updated Test User",
            "role": "admin"
        }
        
        update_response = client.put(
            f"/v0/account/users/{user_id}",
            json=update_data,
            headers=get_auth_headers()
        )
        
        assert update_response.status_code == 200
        update_result = update_response.json()
        assert update_result["name"] == "Updated Test User"
        assert update_result["role"] == "admin"
        
        # Step 4: Update user password
        password_update_data = {
            "password": "newSecurePassword456"
        }
        
        password_update_response = client.put(
            f"/v0/account/users/{user_id}",
            json=password_update_data,
            headers=get_auth_headers()
        )
        
        assert password_update_response.status_code == 200
        password_update_result = password_update_response.json()
        assert password_update_result["has_password"] is True
        
        # Step 5: Update email verification status
        verification_update_data = {
            "email_verified": True
        }

        verification_update_response = client.put(
            f"/v0/account/users/{user_id}",
            json=verification_update_data,
            headers=get_auth_headers()
        )

        assert verification_update_response.status_code == 200
        verification_update_result = verification_update_response.json()
        assert verification_update_result["email_verified"] is True
        
        # Step 6: Delete the user
        delete_response = client.delete(
            f"/v0/account/users/{user_id}",
            headers=get_auth_headers()
        )
        
        assert delete_response.status_code == 200
        
        # Step 7: Verify user is deleted by trying to get it
        # The API returns 404 when trying to get a deleted user by ID
        get_deleted_response = client.get(
            f"/v0/account/users?user_id={user_id}",
            headers=get_auth_headers()
        )
        
        # Update assertion to expect 404 Not Found
        assert get_deleted_response.status_code == 404
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_user_lifecycle() end")

@pytest.mark.asyncio
async def test_list_users_search_functionality(test_db, mock_auth):
    """Test the new search_name parameter for listing users"""
    logger.info(f"test_list_users_search_functionality() start")
    
    try:
        # Create test users with different names and emails
        test_users = [
            {
                "email": "john.doe@example.com",
                "name": "John Doe",
                "password": "password123",
                "role": "user"
            },
            {
                "email": "jane.smith@example.com", 
                "name": "Jane Smith",
                "password": "password123",
                "role": "user"
            },
            {
                "email": "bob.johnson@test.com",
                "name": "Bob Johnson", 
                "password": "password123",
                "role": "user"
            }
        ]
        
        created_user_ids = []
        for user_data in test_users:
            create_response = client.post(
                "/v0/account/users",
                json=user_data,
                headers=get_auth_headers()
            )
            assert create_response.status_code == 200
            created_user_ids.append(create_response.json()["id"])
        
        # Test search by name
        search_by_name_response = client.get(
            "/v0/account/users?search_name=John",
            headers=get_auth_headers()
        )
        
        assert search_by_name_response.status_code == 200
        search_data = search_by_name_response.json()
        assert "users" in search_data
        assert "total_count" in search_data
        assert "skip" in search_data
        
        # Should find both John Doe and Bob Johnson
        found_names = [user["name"] for user in search_data["users"]]
        assert "John Doe" in found_names
        assert "Bob Johnson" in found_names
        assert search_data["total_count"] >= 2
        
        # Test search by email
        search_by_email_response = client.get(
            "/v0/account/users?search_name=example.com",
            headers=get_auth_headers()
        )
        
        assert search_by_email_response.status_code == 200
        email_search_data = search_by_email_response.json()
        
        # Should find users with example.com in email
        found_emails = [user["email"] for user in email_search_data["users"]]
        assert any("example.com" in email for email in found_emails)
        
        # Test case-insensitive search
        case_insensitive_response = client.get(
            "/v0/account/users?search_name=JANE",
            headers=get_auth_headers()
        )
        
        assert case_insensitive_response.status_code == 200
        case_data = case_insensitive_response.json()
        found_names = [user["name"] for user in case_data["users"]]
        assert "Jane Smith" in found_names
        
        # Test search with pagination
        search_pagination_response = client.get(
            "/v0/account/users?search_name=John&skip=0&limit=1",
            headers=get_auth_headers()
        )
        
        assert search_pagination_response.status_code == 200
        pagination_data = search_pagination_response.json()
        assert len(pagination_data["users"]) <= 1
        assert pagination_data["skip"] == 0
        assert pagination_data["total_count"] >= 2  # Should find multiple Johns
        
        # Clean up created users
        for user_id in created_user_ids:
            delete_response = client.delete(
                f"/v0/account/users/{user_id}",
                headers=get_auth_headers()
            )
            assert delete_response.status_code == 200
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_list_users_search_functionality() end")

@pytest.mark.asyncio
async def test_list_users_pagination(test_db, mock_auth):
    """Test pagination functionality for listing users"""
    logger.info(f"test_list_users_pagination() start")
    
    try:
        # Create multiple test users
        test_users = []
        for i in range(15):  # Create 15 users to test pagination
            user_data = {
                "email": f"pagination.user{i}@example.com",
                "name": f"Pagination User {i}",
                "password": "password123",
                "role": "user"
            }
            create_response = client.post(
                "/v0/account/users",
                json=user_data,
                headers=get_auth_headers()
            )
            assert create_response.status_code == 200
            test_users.append(create_response.json()["id"])
        
        # Test first page
        first_page_response = client.get(
            "/v0/account/users?skip=0&limit=10",
            headers=get_auth_headers()
        )
        
        assert first_page_response.status_code == 200
        first_page_data = first_page_response.json()
        assert len(first_page_data["users"]) <= 10
        assert first_page_data["skip"] == 0
        assert first_page_data["total_count"] >= 15
        
        # Test second page
        second_page_response = client.get(
            "/v0/account/users?skip=10&limit=10",
            headers=get_auth_headers()
        )
        
        assert second_page_response.status_code == 200
        second_page_data = second_page_response.json()
        assert len(second_page_data["users"]) <= 10
        assert second_page_data["skip"] == 10
        assert second_page_data["total_count"] >= 15
        
        # Verify no overlap between pages
        first_page_ids = {user["id"] for user in first_page_data["users"]}
        second_page_ids = {user["id"] for user in second_page_data["users"]}
        assert len(first_page_ids.intersection(second_page_ids)) == 0
        
        # Test edge case: skip beyond available data
        beyond_data_response = client.get(
            "/v0/account/users?skip=100&limit=10",
            headers=get_auth_headers()
        )
        
        assert beyond_data_response.status_code == 200
        beyond_data = beyond_data_response.json()
        assert len(beyond_data["users"]) == 0
        assert beyond_data["skip"] == 100
        assert beyond_data["total_count"] >= 15
        
        # Clean up created users
        for user_id in test_users:
            delete_response = client.delete(
                f"/v0/account/users/{user_id}",
                headers=get_auth_headers()
            )
            assert delete_response.status_code == 200
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_list_users_pagination() end")