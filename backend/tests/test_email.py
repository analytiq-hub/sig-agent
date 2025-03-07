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