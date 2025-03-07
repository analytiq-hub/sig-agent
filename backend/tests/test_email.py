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
        
        # Extract the registration verification token from the email content
        if mock_send_email.call_args:
            # Try to get content from kwargs first
            if 'content' in mock_send_email.call_args.kwargs:
                reg_email_content = mock_send_email.call_args.kwargs['content']
            else:
                assert False, f"Could not extract email content from mock call: {mock_send_email.call_args}"
        else:
            assert False, f"Mock was called but call_args is None"
        
        # Extract the token from the verification URL
        verification_url_pattern = r'href="[^"]*?token=([^"&\s]*)"'
        reg_token_match = re.search(verification_url_pattern, reg_email_content)
        
        if reg_token_match:
            reg_verification_token = reg_token_match.group(1)
            ad.log.info(f"Extracted registration verification token: {reg_verification_token}")
            
            # Verify email with the extracted registration token
            reg_verify_response = client.post(
                f"/v0/account/email/verification/{reg_verification_token}",
                headers=get_auth_headers()
            )
            
            # This should succeed with 200 since we're using a valid token
            assert reg_verify_response.status_code == 200
            
            # Verify that the user's email is now verified
            user_check_response = client.get(
                f"/v0/account/users?user_id={user_id}",
                headers=get_auth_headers()
            )
            assert user_check_response.status_code == 200
            user_check_data = user_check_response.json()["users"][0]
            assert user_check_data["emailVerified"] == True
        else:
            assert False, f"Could not extract verification token from registration email content"
        
        # Reset all mocks
        mock_send_email.reset_mock()
        
        # Step 3: Create a second user for testing the regular verification flow
        # Since the first user is already verified, we need a new unverified user
        second_user_data = {
            "email": "verify2@example.com",
            "name": "Verification Test 2",
            "password": "securePassword123"
        }
        
        second_create_response = client.post(
            "/v0/account/users",
            json=second_user_data,
            headers=get_auth_headers()
        )
        
        assert second_create_response.status_code == 200
        second_user_id = second_create_response.json()["id"]
        
        # Send verification email to the second user
        verification_response = client.post(
            f"/v0/account/email/verification/send/{second_user_id}",
            headers=get_auth_headers()
        )
        
        assert verification_response.status_code == 200
        # Verify that send_email was called for email verification
        assert mock_send_email.called
        
        # Extract the verification token from the email content
        if mock_send_email.call_args:
            # Try to get content from kwargs first
            if 'content' in mock_send_email.call_args.kwargs:
                email_content = mock_send_email.call_args.kwargs['content']
            else:
                assert False, f"Could not extract email content from mock call: {mock_send_email.call_args}"
        else:
            assert False, f"Mock was called but call_args is None"
            
        # Extract the token from the verification URL
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
            f"/v0/account/users?user_id={second_user_id}",
            headers=get_auth_headers()
        )
        assert user_response.status_code == 200
        user_data = user_response.json()["users"][0]
        assert user_data["emailVerified"] == True
        
        # Clean up both users
        client.delete(
            f"/v0/account/users/{user_id}",
            headers=get_auth_headers()
        )
        
        client.delete(
            f"/v0/account/users/{second_user_id}",
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
            "organization_id": TEST_ORG_ID,
            "role": "user"  # Add role field to fix the KeyError
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
        
        # Step 2: Test listing invitations
        list_response = client.get(
            "/v0/account/email/invitations",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        invitations = list_response.json()["invitations"]
        assert len(invitations) > 0
        
        # Find our invitation in the list
        found_invitation = next((inv for inv in invitations if inv["id"] == invitation_id), None)
        assert found_invitation is not None
        assert found_invitation["email"] == "invited@example.com"
        assert found_invitation["status"] == "pending"
        
        # Extract the invitation token from the email content
        if mock_send_email.call_args:
            # Try to get content from kwargs first
            if 'content' in mock_send_email.call_args.kwargs:
                email_content = mock_send_email.call_args.kwargs['content']
            else:
                assert False, f"Could not extract email content from mock call: {mock_send_email.call_args}"
        else:
            assert False, f"Mock was called but call_args is None"
        
        # Extract the token from the invitation URL
        invitation_url_pattern = r'href="[^"]*?token=([^"&\s]*)"'
        token_match = re.search(invitation_url_pattern, email_content)
        
        if token_match:
            invitation_token = token_match.group(1)
            ad.log.info(f"Extracted invitation token: {invitation_token}")
        else:
            assert False, f"Could not extract invitation token from email content"
        
        # Step 3: Test getting invitation by token
        get_invitation_response = client.get(
            f"/v0/account/email/invitations/{invitation_token}",
            headers=get_auth_headers()
        )
        
        assert get_invitation_response.status_code == 200
        invitation_by_token = get_invitation_response.json()
        assert invitation_by_token["email"] == "invited@example.com"
        assert invitation_by_token["status"] == "pending"
        assert invitation_by_token["organization_id"] == TEST_ORG_ID
        
        # Step 4: Test invitation acceptance with the real token
        accept_data = {
            "name": "Invited User",
            "password": "invitedUserPassword123"
        }
        
        accept_response = client.post(
            f"/v0/account/email/invitations/{invitation_token}/accept",
            json=accept_data,
            headers=get_auth_headers()
        )
        
        # This should succeed with 200 since we're using a valid token
        assert accept_response.status_code == 200
        
        # Verify that a new user was created with the invitation data
        user_response = client.get(
            "/v0/account/users",
            params={"skip": 0, "limit": 100},
            headers=get_auth_headers()
        )
        
        assert user_response.status_code == 200
        users = user_response.json()["users"]
        
        # Find the newly created user
        invited_user = next((user for user in users if user["email"] == "invited@example.com"), None)
        assert invited_user is not None
        assert invited_user["name"] == "Invited User"
        assert invited_user["emailVerified"] == True  # Email should be pre-verified for invited users
        
        # Verify that the invitation status is now "accepted"
        get_invitation_after_accept = client.get(
            f"/v0/account/email/invitations/{invitation_token}",
            headers=get_auth_headers()
        )
        
        # The invitation might be deleted after acceptance or marked as accepted
        if get_invitation_after_accept.status_code == 200:
            invitation_after_accept = get_invitation_after_accept.json()
            assert invitation_after_accept["status"] == "accepted"
        
        # Clean up - delete the created user
        if invited_user:
            client.delete(
                f"/v0/account/users/{invited_user['id']}",
                headers=get_auth_headers()
            )
        
    finally:
        # Clean up - we'll use the database directly to ensure cleanup
        await test_db.invitations.delete_many({"email": "invited@example.com"})
    
    ad.log.info(f"test_invitation_lifecycle() end") 