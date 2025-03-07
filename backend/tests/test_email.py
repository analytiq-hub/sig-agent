import pytest
from unittest.mock import patch, MagicMock, ANY
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

# Create a mock for send_email function
@pytest.fixture
def mock_send_email():
    """Mock the send_email function to prevent actual emails during tests"""
    # Based on our investigation, we need to patch the correct location
    # Let's try a more direct approach - patch the boto3 client itself
    with patch("boto3.client") as mock_boto3_client:
        # Create a mock SES client
        mock_ses_client = MagicMock()
        # Configure boto3.client to return our mock SES client when called with 'ses'
        mock_boto3_client.return_value = mock_ses_client
        # Configure the send_email method on the mock SES client
        mock_ses_client.send_email.return_value = {
            "MessageId": "mock-message-id",
            "ResponseMetadata": {"RequestId": "mock-request-id"}
        }
        
        # Also patch the send_email function in email_utils
        with patch("api.email_utils.send_email") as mock_send_email:
            mock_send_email.return_value = {
                "success": True, 
                "message": "Email mock: Message would be sent"
            }
            
            # Create a combined mock that checks both places
            combined_mock = MagicMock()
            combined_mock.called = False
            
            # Define a method to check if either mock was called
            def was_called():
                return mock_ses_client.send_email.called or mock_send_email.called
            
            # Define a method to get call args from whichever mock was called
            def get_call_args():
                if mock_ses_client.send_email.called:
                    return mock_ses_client.send_email.call_args
                if mock_send_email.called:
                    return mock_send_email.call_args
                return None
            
            # Add these methods to our combined mock
            combined_mock.was_called = was_called
            combined_mock.get_call_args = get_call_args
            combined_mock.ses_client_mock = mock_ses_client.send_email
            combined_mock.send_email_mock = mock_send_email
            
            yield combined_mock

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
        assert mock_send_email.was_called(), "Email sending function was not called for registration verification"
        
        # Log which method was called
        if mock_send_email.ses_client_mock.called:
            ad.log.info("Direct SES client was used for registration email")
        if mock_send_email.send_email_mock.called:
            ad.log.info("send_email function was used for registration email")
        
        # Reset all mocks
        mock_send_email.ses_client_mock.reset_mock()
        mock_send_email.send_email_mock.reset_mock()
        
        # Step 3: Send verification email
        verification_response = client.post(
            f"/v0/account/email/verification/send/{user_id}",
            headers=get_auth_headers()
        )
        
        assert verification_response.status_code == 200
        # Verify that send_email was called for email verification
        assert mock_send_email.was_called(), "Email sending function was not called for email verification"
        
        # Log which method was called
        if mock_send_email.ses_client_mock.called:
            ad.log.info("Direct SES client was used for verification email")
        if mock_send_email.send_email_mock.called:
            ad.log.info("send_email function was used for verification email")
        
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
        assert mock_send_email.was_called(), "Email sending function was not called for invitation"
        
        # Log which method was called
        if mock_send_email.ses_client_mock.called:
            ad.log.info("Direct SES client was used for invitation email")
            ad.log.info(f"SES client call args: {mock_send_email.ses_client_mock.call_args}")
        if mock_send_email.send_email_mock.called:
            ad.log.info("send_email function was used for invitation email")
            ad.log.info(f"send_email call args: {mock_send_email.send_email_mock.call_args}")
        
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