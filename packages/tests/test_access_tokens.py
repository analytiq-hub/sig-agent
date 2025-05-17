import pytest
from bson import ObjectId
import os
import logging

# Import shared test utilities
from .test_utils import (
    client, TEST_USER, TEST_ORG_ID, 
    test_db, get_auth_headers, mock_auth
)
import analytiq_data as ad

logger = logging.getLogger(__name__)

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

@pytest.mark.asyncio
async def test_access_tokens(test_db, mock_auth):
    """Test the complete access token lifecycle"""
    logger.info(f"test_access_tokens() start")
    
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
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_access_tokens() end")

@pytest.mark.asyncio
async def test_account_access_tokens(test_db, mock_auth):
    """Test the account-level access token lifecycle"""
    logger.info(f"test_account_access_tokens() start")
    
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
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_account_access_tokens() end") 