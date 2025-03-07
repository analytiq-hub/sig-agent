import pytest
from bson import ObjectId
import os
from datetime import datetime, UTC

# Import shared test utilities
from .test_utils import (
    client, TEST_USER, TEST_USER_ID, TEST_ORG_ID, 
    test_db, get_auth_headers, mock_auth
)
import analytiq_data as ad

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

@pytest.mark.asyncio
async def test_list_users(test_db, mock_auth):
    """Test listing users endpoint"""
    ad.log.info(f"test_list_users() start")
    
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
    
    ad.log.info(f"test_list_users() end")

@pytest.mark.asyncio
async def test_user_lifecycle(test_db, mock_auth):
    """Test the complete user lifecycle (create, get, update, delete)"""
    ad.log.info(f"test_user_lifecycle() start")
    
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
        assert "emailVerified" in user_result
        assert "hasPassword" in user_result
        assert user_result["hasPassword"] is True
        
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
        assert password_update_result["hasPassword"] is True
        
        # Step 5: Update email verification status
        verification_update_data = {
            "emailVerified": True
        }
        
        verification_update_response = client.put(
            f"/v0/account/users/{user_id}",
            json=verification_update_data,
            headers=get_auth_headers()
        )
        
        assert verification_update_response.status_code == 200
        verification_update_result = verification_update_response.json()
        assert verification_update_result["emailVerified"] is True
        
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
    
    ad.log.info(f"test_user_lifecycle() end")

@pytest.mark.asyncio
async def test_email_verification(test_db, mock_auth):
    """Test email verification endpoints"""
    ad.log.info(f"test_email_verification() start")
    
    try:
        # Step 1: Create a user for testing
        user_data = {
            "email": "verify@example.com",
            "name": "Verification Test",
            "password": "securePassword123"
        }
        
        create_response = client.post(
            "/v0/account/users",
            json=user_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Step 2: Send registration verification email
        reg_verification_response = client.post(
            f"/v0/account/email/verification/register/{user_id}",
            headers=get_auth_headers()
        )
        
        assert reg_verification_response.status_code == 200
        
        # Step 3: Send verification email
        verification_response = client.post(
            f"/v0/account/email/verification/send/{user_id}",
            headers=get_auth_headers()
        )
        
        assert verification_response.status_code == 200
        
        # Step 4: Verify email with token (this will be a mock test since we don't have a real token)
        # In a real scenario, we would need to extract the token from the database
        # For now, we'll just test that the endpoint exists and returns an appropriate error for an invalid token
        
        verify_response = client.post(
            "/v0/account/email/verification/invalid_token_for_testing",
            headers=get_auth_headers()
        )
        
        # This should fail with 404 or 400 since the token is invalid
        assert verify_response.status_code in [400, 404]
        
        # Clean up
        client.delete(
            f"/v0/account/users/{user_id}",
            headers=get_auth_headers()
        )
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    ad.log.info(f"test_email_verification() end")

@pytest.mark.asyncio
async def test_invitation_lifecycle(test_db, mock_auth):
    """Test the invitation creation functionality"""
    ad.log.info(f"test_invitation_lifecycle() start")
    
    try:
        # Step 1: Create an invitation using the API
        invitation_data = {
            "email": "invited@example.com",
            "organization_id": TEST_ORG_ID
        }
        
        create_response = client.post(
            "/v0/account/email/invitations",
            json=invitation_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        invitation_result = create_response.json()
        assert "id" in invitation_result
        assert invitation_result["email"] == "invited@example.com"
        assert invitation_result["status"] == "pending"
        assert "expires" in invitation_result
        assert invitation_result["organization_id"] == TEST_ORG_ID
        
        invitation_id = invitation_result["id"]
        
        # Step 2: Test invitation acceptance (this will be a partial test)
        # In a real scenario, we would need to extract the token from the database
        # For now, we'll just test that the endpoint exists and returns an appropriate error for an invalid token
        
        accept_data = {
            "name": "Invited User",
            "password": "invitedUserPassword123"
        }
        
        # This should fail with 404 or 400 since we're using the ID as token which isn't valid
        accept_response = client.post(
            f"/v0/account/email/invitations/{invitation_id}/accept",
            json=accept_data,
            headers=get_auth_headers()
        )
        
        assert accept_response.status_code in [400, 404]
        
    finally:
        # Clean up - we'll use the database directly to ensure cleanup
        await test_db.invitations.delete_many({"email": "invited@example.com"})
    
    ad.log.info(f"test_invitation_lifecycle() end") 