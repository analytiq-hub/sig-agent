import pytest
from unittest.mock import patch, MagicMock, ANY
from bson import ObjectId
import os
from datetime import datetime, UTC
import re

# Import shared test utilities
from .test_utils import (
    client, TEST_USER, TEST_USER_ID, TEST_ORG_ID, 
    test_db, get_auth_headers, mock_auth
)
import analytiq_data as ad

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

# Create a mock for send_email function
@pytest.fixture
def mock_send_email():
    """Mock the send_email function to prevent actual emails during tests"""
    with patch("api.email_utils.send_email") as mock_send_email:
        mock_send_email.return_value = {
            "success": True, 
            "message": "Email mock: Message would be sent"
        }
        yield mock_send_email

@pytest.mark.asyncio
async def test_email_verification(test_db, mock_auth, mock_send_email):
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
        # Verify that send_email was called for registration verification
        assert mock_send_email.called
        
        # Reset all mocks
        mock_send_email.reset_mock()
        
        # Step 3: Send verification email
        verification_response = client.post(
            f"/v0/account/email/verification/send/{user_id}",
            headers=get_auth_headers()
        )
        
        assert verification_response.status_code == 200
        # Verify that send_email was called for email verification
        assert mock_send_email.called
        
        # Extract the verification token from the email content
        # The token is part of the verification URL in the email content
        # Inspect the mock call arguments structure
        #ad.log.info(f"Mock call args: {mock_send_email.call_args}")
        
        # Access the content parameter correctly
        # The structure is typically (args, kwargs) where args is a tuple and kwargs is a dict
        if mock_send_email.call_args:
            # Try to get content from kwargs first
            if 'content' in mock_send_email.call_args.kwargs:
                email_content = mock_send_email.call_args.kwargs['content']
            else:
                assert False, f"Could not extract email content from mock call: {mock_send_email.call_args}"
        else:
            assert False, f"Mock was called but call_args is None"
            
        # Only proceed with token extraction if we have email content
        verification_token = None
        if email_content:
            # Extract the token from the verification URL
            # Update the pattern to match the frontend URL with query parameter
            verification_url_pattern = r'href="[^"]*?token=([^"&\s]*)"'
            token_match = re.search(verification_url_pattern, email_content)
            
            if token_match:
                verification_token = token_match.group(1)
                ad.log.info(f"Extracted verification token: {verification_token}")
            else:
                assert False, f"Could not extract verification token from email content"
        
        # Step 4: Verify email with the extracted token
        verify_response = client.post(
            f"/v0/account/email/verification/{verification_token}",
            headers=get_auth_headers()
        )
        
        # This should succeed with 200 since we're using a valid token
        assert verify_response.status_code == 200
        
        # Verify that the user's email is now verified
        user_response = client.get(
            f"/v0/account/users?user_id={user_id}",
            headers=get_auth_headers()
        )
        assert user_response.status_code == 200
        user_data = user_response.json()["users"][0]
        assert user_data["emailVerified"] == True
        
        # Clean up
        client.delete(
            f"/v0/account/users/{user_id}",
            headers=get_auth_headers()
        )
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    ad.log.info(f"test_email_verification() end")

@pytest.mark.asyncio
async def test_invitation_lifecycle(test_db, mock_auth, mock_send_email):
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
        # Verify that send_email was called for invitation
        assert mock_send_email.called
        
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