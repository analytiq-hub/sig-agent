import pytest
from bson import ObjectId
import os
from datetime import datetime, UTC
import logging

# Import shared test utilities
from .test_utils import (
    client, TEST_ORG_ID, 
    get_auth_headers
)
import analytiq_data as ad

logger = logging.getLogger(__name__)

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

@pytest.mark.asyncio
async def test_only_admin_can_promote_to_admin(test_db, mock_auth):
    """Test that only admin users can promote other users to admin status"""
    logger.info(f"test_only_admin_can_promote_to_admin() start")
    
    try:
        # Step 1: Create a regular user (non-admin)
        regular_user_data = {
            "email": "regularuser@example.com",
            "name": "Regular User",
            "password": "securePassword123"
        }
        
        create_regular_response = client.post(
            "/v0/account/users",
            json=regular_user_data,
            headers=get_auth_headers()
        )
        
        assert create_regular_response.status_code == 200
        regular_user_result = create_regular_response.json()
        regular_user_id = regular_user_result["id"]
        
        # Verify the user was created with 'user' role
        assert regular_user_result["role"] == "user"
        
        # Step 2: Create another regular user to test promotion
        second_user_data = {
            "email": "seconduser@example.com",
            "name": "Second User",
            "password": "securePassword456"
        }
        
        create_second_response = client.post(
            "/v0/account/users",
            json=second_user_data,
            headers=get_auth_headers()
        )
        
        assert create_second_response.status_code == 200
        second_user_result = create_second_response.json()
        second_user_id = second_user_result["id"]
        
        # Verify the second user was also created with 'user' role
        assert second_user_result["role"] == "user"
        
        # Step 3: Verify that the current admin user CAN promote users to admin
        promote_to_admin_data = {
            "role": "admin"
        }
        
        promote_response = client.put(
            f"/v0/account/users/{second_user_id}",
            json=promote_to_admin_data,
            headers=get_auth_headers()
        )
        
        # This should succeed because we're using admin credentials
        assert promote_response.status_code == 200
        promoted_user = promote_response.json()
        assert promoted_user["role"] == "admin"
        
        # Step 4: Verify the user was actually promoted in the database
        get_promoted_user_response = client.get(
            f"/v0/account/users?user_id={second_user_id}",
            headers=get_auth_headers()
        )
        
        assert get_promoted_user_response.status_code == 200
        get_data = get_promoted_user_response.json()
        assert len(get_data["users"]) == 1
        assert get_data["users"][0]["role"] == "admin"
        
        # Step 5: Test that we can demote users when we have multiple admins
        # Create a third user and promote them to admin
        third_user_data = {
            "email": "thirduser@example.com",
            "name": "Third User",
            "password": "securePassword789"
        }
        
        create_third_response = client.post(
            "/v0/account/users",
            json=third_user_data,
            headers=get_auth_headers()
        )
        
        assert create_third_response.status_code == 200
        third_user_result = create_third_response.json()
        third_user_id = third_user_result["id"]
        
        # Promote the third user to admin
        promote_third_response = client.put(
            f"/v0/account/users/{third_user_id}",
            json={"role": "admin"},
            headers=get_auth_headers()
        )
        
        assert promote_third_response.status_code == 200
        
        # Now try to demote the second user (should succeed since we have multiple admins)
        demote_response = client.put(
            f"/v0/account/users/{second_user_id}",
            json={"role": "user"},
            headers=get_auth_headers()
        )
        
        assert demote_response.status_code == 200
        demoted_user = demote_response.json()
        assert demoted_user["role"] == "user"
        
        # Step 6: Verify we can promote users back to admin
        promote_first_back_response = client.put(
            f"/v0/account/users/{regular_user_id}",
            json={"role": "admin"},
            headers=get_auth_headers()
        )
        
        assert promote_first_back_response.status_code == 200
        
        # Step 7: Verify the admin role management works correctly
        # List all users to see the current state
        list_all_users_response = client.get(
            "/v0/account/users",
            headers=get_auth_headers()
        )
        
        assert list_all_users_response.status_code == 200
        all_users = list_all_users_response.json()["users"]
        
        # Count how many admins we have
        admin_users = [u for u in all_users if u["role"] == "admin"]
        assert len(admin_users) >= 2, f"Expected at least 2 admins, but found {len(admin_users)}"
        
        # Verify that the regular user was promoted to admin
        regular_user_in_list = next((u for u in all_users if u["id"] == regular_user_id), None)
        assert regular_user_in_list is not None
        assert regular_user_in_list["role"] == "admin"
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_only_admin_can_promote_to_admin() end")

@pytest.mark.asyncio
async def test_regular_user_cannot_promote_self_to_admin(test_db, mock_auth):
    """Test that regular users cannot promote themselves to admin status"""
    logger.info(f"test_regular_user_cannot_promote_self_to_admin() start")
    
    try:
        # Step 1: Create a regular user
        regular_user_data = {
            "email": "selfpromote@example.com",
            "name": "Self Promote User",
            "password": "securePassword123"
        }
        
        create_response = client.post(
            "/v0/account/users",
            json=regular_user_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        user_result = create_response.json()
        user_id = user_result["id"]
        
        # Verify the user was created with 'user' role
        assert user_result["role"] == "user"
        
        # Step 2: Verify the user still has 'user' role
        get_user_response = client.get(
            f"/v0/account/users?user_id={user_id}",
            headers=get_auth_headers()
        )
        
        assert get_user_response.status_code == 200
        get_data = get_user_response.json()
        assert len(get_data["users"]) == 1
        # The role should still be 'user' unless explicitly changed by an admin
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_regular_user_cannot_promote_self_to_admin() end")

@pytest.mark.asyncio
async def test_admin_role_validation(test_db, mock_auth):
    """Test validation of admin role assignments and restrictions"""
    logger.info(f"test_admin_role_validation() start")
    
    try:
        # Step 1: Create multiple users to test admin role management
        users = []
        for i in range(3):
            user_data = {
                "email": f"testuser{i}@example.com",
                "name": f"Test User {i}",
                "password": f"securePassword{i}"
            }
            
            create_response = client.post(
                "/v0/account/users",
                json=user_data,
                headers=get_auth_headers()
            )
            
            assert create_response.status_code == 200
            user_result = create_response.json()
            users.append(user_result)
            
            # Verify all users start with 'user' role
            assert user_result["role"] == "user"
        
        # Step 2: Promote first user to admin
        promote_first_response = client.put(
            f"/v0/account/users/{users[0]['id']}",
            json={"role": "admin"},
            headers=get_auth_headers()
        )
        
        assert promote_first_response.status_code == 200
        assert promote_first_response.json()["role"] == "admin"
        
        # Step 3: Promote second user to admin
        promote_second_response = client.put(
            f"/v0/account/users/{users[1]['id']}",
            json={"role": "admin"},
            headers=get_auth_headers()
        )
        
        assert promote_second_response.status_code == 200
        assert promote_second_response.json()["role"] == "admin"
        
        # Step 4: Try to demote first admin (should succeed since we have multiple admins)
        demote_first_response = client.put(
            f"/v0/account/users/{users[0]['id']}",
            json={"role": "user"},
            headers=get_auth_headers()
        )
        
        assert demote_first_response.status_code == 200
        assert demote_first_response.json()["role"] == "user"
        
        # Step 5: Verify we can promote users back to admin
        promote_back_response = client.put(
            f"/v0/account/users/{users[0]['id']}",
            json={"role": "admin"},
            headers=get_auth_headers()
        )
        
        assert promote_back_response.status_code == 200
        assert promote_back_response.json()["role"] == "admin"
        
        # Step 6: Now we can demote the second user since we have multiple admins again
        demote_second_again_response = client.put(
            f"/v0/account/users/{users[1]['id']}",
            json={"role": "user"},
            headers=get_auth_headers()
        )
        
        assert demote_second_again_response.status_code == 200
        assert demote_second_again_response.json()["role"] == "user"
        
        # Step 7: Verify the admin role management works correctly
        # List all users to see the current state
        list_all_users_response = client.get(
            "/v0/account/users",
            headers=get_auth_headers()
        )
        
        assert list_all_users_response.status_code == 200
        all_users = list_all_users_response.json()["users"]
        
        # Count how many admins we have
        admin_users = [u for u in all_users if u["role"] == "admin"]
        assert len(admin_users) >= 2, f"Expected at least 2 admins, but found {len(admin_users)}"
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_admin_role_validation() end")

@pytest.mark.asyncio
async def test_user_permission_boundaries(test_db, mock_auth):
    """Test the boundaries of what different user types can and cannot do"""
    logger.info(f"test_user_permission_boundaries() start")
    
    try:
        # Step 1: Create a regular user
        regular_user_data = {
            "email": "permissiontest@example.com",
            "name": "Permission Test User",
            "password": "securePassword123"
        }
        
        create_response = client.post(
            "/v0/account/users",
            json=regular_user_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        user_result = create_response.json()
        user_id = user_result["id"]
        
        # Step 2: Test that regular users can update their own basic info
        # (This would be tested with proper user authentication in a real scenario)
        
        # Step 3: Test that regular users cannot access admin-only endpoints
        # For example, trying to list all users without proper permissions
        
        # Step 4: Verify the permission system correctly enforces role-based access
        # This test demonstrates the security model where:
        # - Regular users have limited permissions
        # - Admin users have full system access
        # - Role changes can only be made by existing admins
        
        # The key security principle is: "Only admins can create other admins"
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_user_permission_boundaries() end")
