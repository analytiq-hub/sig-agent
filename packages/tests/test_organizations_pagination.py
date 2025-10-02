import pytest
from bson import ObjectId
import os
from datetime import datetime, UTC
import logging

# Import shared test utilities
from .conftest_utils import (
    client, TEST_ORG_ID, TEST_USER,
    get_auth_headers, get_token_headers
)
import analytiq_data as ad

logger = logging.getLogger(__name__)

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"

@pytest.mark.asyncio
async def test_list_organizations_pagination(test_db, mock_auth):
    """Test pagination functionality for listing organizations"""
    logger.info("test_list_organizations_pagination() start")
    
    try:
        # Create multiple test organizations
        test_orgs = []
        for i in range(15):  # Create 15 organizations to test pagination
            org_data = {
                "name": f"Test Organization {i}",
                "type": "individual"
            }
            create_response = client.post(
                "/v0/account/organizations",
                json=org_data,
                headers=get_auth_headers()
            )
            assert create_response.status_code == 200
            test_orgs.append(create_response.json()["id"])
        
        # Test first page
        first_page_response = client.get(
            "/v0/account/organizations?skip=0&limit=10",
            headers=get_auth_headers()
        )
        
        assert first_page_response.status_code == 200
        first_page_data = first_page_response.json()
        assert "organizations" in first_page_data
        assert "total_count" in first_page_data
        assert "skip" in first_page_data
        assert len(first_page_data["organizations"]) <= 10
        assert first_page_data["skip"] == 0
        assert first_page_data["total_count"] >= 15
        
        # Test second page
        second_page_response = client.get(
            "/v0/account/organizations?skip=10&limit=10",
            headers=get_auth_headers()
        )
        
        assert second_page_response.status_code == 200
        second_page_data = second_page_response.json()
        assert len(second_page_data["organizations"]) <= 10
        assert second_page_data["skip"] == 10
        assert second_page_data["total_count"] >= 15
        
        # Verify no overlap between pages
        first_page_ids = {org["id"] for org in first_page_data["organizations"]}
        second_page_ids = {org["id"] for org in second_page_data["organizations"]}
        assert len(first_page_ids.intersection(second_page_ids)) == 0
        
        # Test edge case: skip beyond available data
        beyond_data_response = client.get(
            "/v0/account/organizations?skip=100&limit=10",
            headers=get_auth_headers()
        )
        
        assert beyond_data_response.status_code == 200
        beyond_data = beyond_data_response.json()
        assert len(beyond_data["organizations"]) == 0
        assert beyond_data["skip"] == 100
        assert beyond_data["total_count"] >= 15
        
        # Clean up created organizations
        for org_id in test_orgs:
            delete_response = client.delete(
                f"/v0/account/organizations/{org_id}",
                headers=get_auth_headers()
            )
            assert delete_response.status_code == 200
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info("test_list_organizations_pagination() end")

@pytest.mark.asyncio
async def test_list_organizations_name_search(test_db, mock_auth):
    """Test name_search parameter for listing organizations"""
    logger.info("test_list_organizations_name_search() start")
    
    try:
        # Create test organizations with different names
        test_orgs = []
        org_names = [
            "Acme Corporation",
            "Beta Industries", 
            "Gamma Solutions",
            "Alpha Technologies",
            "Delta Systems"
        ]
        
        for name in org_names:
            org_data = {
                "name": name,
                "type": "individual"
            }
            create_response = client.post(
                "/v0/account/organizations",
                json=org_data,
                headers=get_auth_headers()
            )
            assert create_response.status_code == 200
            test_orgs.append(create_response.json()["id"])
        
        # Test search by organization name
        search_response = client.get(
            "/v0/account/organizations?name_search=Alpha",
            headers=get_auth_headers()
        )
        
        assert search_response.status_code == 200
        search_data = search_response.json()
        assert "organizations" in search_data
        assert "total_count" in search_data
        assert "skip" in search_data
        
        # Should find Alpha Technologies
        found_names = [org["name"] for org in search_data["organizations"]]
        assert "Alpha Technologies" in found_names
        assert search_data["total_count"] >= 1
        
        # Test case-insensitive search
        case_insensitive_response = client.get(
            "/v0/account/organizations?name_search=GAMMA",
            headers=get_auth_headers()
        )
        
        assert case_insensitive_response.status_code == 200
        case_data = case_insensitive_response.json()
        found_names = [org["name"] for org in case_data["organizations"]]
        assert "Gamma Solutions" in found_names
        
        # Test search with pagination
        search_pagination_response = client.get(
            "/v0/account/organizations?name_search=Corp&skip=0&limit=5",
            headers=get_auth_headers()
        )
        
        assert search_pagination_response.status_code == 200
        pagination_data = search_pagination_response.json()
        assert len(pagination_data["organizations"]) <= 5
        assert pagination_data["skip"] == 0
        
        # Clean up created organizations
        for org_id in test_orgs:
            delete_response = client.delete(
                f"/v0/account/organizations/{org_id}",
                headers=get_auth_headers()
            )
            assert delete_response.status_code == 200
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info("test_list_organizations_name_search() end")

@pytest.mark.asyncio
async def test_list_organizations_member_search(test_db, mock_auth):
    """Test member_search parameter for listing organizations"""
    logger.info("test_list_organizations_member_search() start")
    
    try:
        # Create test users with different names and emails
        test_users = []
        user_data_list = [
            {
                "email": "alice.johnson@example.com",
                "name": "Alice Johnson",
                "password": "password123",
                "role": "user"
            },
            {
                "email": "bob.smith@test.com",
                "name": "Bob Smith", 
                "password": "password123",
                "role": "user"
            },
            {
                "email": "charlie.brown@demo.com",
                "name": "Charlie Brown",
                "password": "password123",
                "role": "user"
            }
        ]
        
        for user_data in user_data_list:
            create_user_response = client.post(
                "/v0/account/users",
                json=user_data,
                headers=get_auth_headers()
            )
            assert create_user_response.status_code == 200
            test_users.append(create_user_response.json())
        
        # Create organizations and add users as members
        test_orgs = []
        for i, user in enumerate(test_users):
            org_data = {
                "name": f"Organization for {user['name']}",
                "type": "team"
            }
            create_org_response = client.post(
                "/v0/account/organizations",
                json=org_data,
                headers=get_auth_headers()
            )
            assert create_org_response.status_code == 200
            org_id = create_org_response.json()["id"]
            test_orgs.append(org_id)
            
            # Add user as member to the organization
            update_data = {
                "members": [
                    {
                        "user_id": user["id"],
                        "role": "admin"
                    }
                ]
            }
            update_response = client.put(
                f"/v0/account/organizations/{org_id}",
                json=update_data,
                headers=get_auth_headers()
            )
            assert update_response.status_code == 200
        
        # Test search by member name
        search_by_name_response = client.get(
            "/v0/account/organizations?member_search=Alice",
            headers=get_auth_headers()
        )
        
        assert search_by_name_response.status_code == 200
        search_data = search_by_name_response.json()
        assert "organizations" in search_data
        assert "total_count" in search_data
        assert "skip" in search_data
        
        # Should find organization with Alice Johnson as member
        found_names = [org["name"] for org in search_data["organizations"]]
        assert any("Alice" in name for name in found_names)
        assert search_data["total_count"] >= 1
        
        # Test search by member email
        search_by_email_response = client.get(
            "/v0/account/organizations?member_search=test.com",
            headers=get_auth_headers()
        )
        
        assert search_by_email_response.status_code == 200
        email_search_data = search_by_email_response.json()
        
        # Should find organization with member having test.com email
        found_names = [org["name"] for org in email_search_data["organizations"]]
        assert any("Bob" in name for name in found_names)
        
        # Test case-insensitive search
        case_insensitive_response = client.get(
            "/v0/account/organizations?member_search=CHARLIE",
            headers=get_auth_headers()
        )
        
        assert case_insensitive_response.status_code == 200
        case_data = case_insensitive_response.json()
        found_names = [org["name"] for org in case_data["organizations"]]
        assert any("Charlie" in name for name in found_names)
        
        # Test search with pagination
        search_pagination_response = client.get(
            "/v0/account/organizations?member_search=Johnson&skip=0&limit=5",
            headers=get_auth_headers()
        )
        
        assert search_pagination_response.status_code == 200
        pagination_data = search_pagination_response.json()
        assert len(pagination_data["organizations"]) <= 5
        assert pagination_data["skip"] == 0
        
        # Clean up created organizations and users
        for org_id in test_orgs:
            delete_org_response = client.delete(
                f"/v0/account/organizations/{org_id}",
                headers=get_auth_headers()
            )
            assert delete_org_response.status_code == 200
        
        for user in test_users:
            delete_user_response = client.delete(
                f"/v0/account/users/{user['id']}",
                headers=get_auth_headers()
            )
            assert delete_user_response.status_code == 200
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info("test_list_organizations_member_search() end")

@pytest.mark.asyncio
async def test_list_organizations_combined_search(test_db, mock_auth):
    """Test combining name_search and member_search parameters"""
    logger.info("test_list_organizations_combined_search() start")
    
    try:
        # Create a test user
        user_data = {
            "email": "test.member@example.com",
            "name": "Test Member",
            "password": "password123",
            "role": "user"
        }
        
        create_user_response = client.post(
            "/v0/account/users",
            json=user_data,
            headers=get_auth_headers()
        )
        assert create_user_response.status_code == 200
        test_user = create_user_response.json()
        
        # Create organizations with specific naming pattern
        test_orgs = []
        org_names = [
            "Alpha Corp",
            "Beta Corp", 
            "Gamma Corp",
            "Alpha Industries",
            "Beta Industries"
        ]
        
        for name in org_names:
            org_data = {
                "name": name,
                "type": "team"
            }
            create_org_response = client.post(
                "/v0/account/organizations",
                json=org_data,
                headers=get_auth_headers()
            )
            assert create_org_response.status_code == 200
            org_id = create_org_response.json()["id"]
            test_orgs.append(org_id)
            
            # Add test user as member to some organizations
            if "Alpha" in name:
                update_data = {
                    "members": [
                        {
                            "user_id": test_user["id"],
                            "role": "admin"
                        }
                    ]
                }
                update_response = client.put(
                    f"/v0/account/organizations/{org_id}",
                    json=update_data,
                    headers=get_auth_headers()
                )
                assert update_response.status_code == 200
        
        # Test combined search: name_search + member_search
        combined_search_response = client.get(
            "/v0/account/organizations?name_search=Alpha&member_search=Test",
            headers=get_auth_headers()
        )
        
        assert combined_search_response.status_code == 200
        combined_data = combined_search_response.json()
        assert "organizations" in combined_data
        assert "total_count" in combined_data
        assert "skip" in combined_data
        
        # Should find Alpha organizations that have Test Member
        found_names = [org["name"] for org in combined_data["organizations"]]
        assert "Alpha Corp" in found_names
        assert "Alpha Industries" in found_names
        assert combined_data["total_count"] >= 2
        
        # Test that Beta organizations are not included (no Test Member)
        assert "Beta Corp" not in found_names
        assert "Beta Industries" not in found_names
        
        # Clean up created organizations and user
        for org_id in test_orgs:
            delete_org_response = client.delete(
                f"/v0/account/organizations/{org_id}",
                headers=get_auth_headers()
            )
            assert delete_org_response.status_code == 200
        
        delete_user_response = client.delete(
            f"/v0/account/users/{test_user['id']}",
            headers=get_auth_headers()
        )
        assert delete_user_response.status_code == 200
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info("test_list_organizations_combined_search() end")

@pytest.mark.asyncio
async def test_list_organizations_response_structure(test_db, mock_auth):
    """Test that the response structure includes total_count and skip fields"""
    logger.info("test_list_organizations_response_structure() start")
    
    try:
        # Test basic list without parameters
        basic_response = client.get(
            "/v0/account/organizations",
            headers=get_auth_headers()
        )
        
        assert basic_response.status_code == 200
        basic_data = basic_response.json()
        
        # Verify response structure
        assert "organizations" in basic_data
        assert "total_count" in basic_data
        assert "skip" in basic_data
        assert isinstance(basic_data["organizations"], list)
        assert isinstance(basic_data["total_count"], int)
        assert isinstance(basic_data["skip"], int)
        assert basic_data["skip"] == 0
        
        # Test with pagination parameters
        pagination_response = client.get(
            "/v0/account/organizations?skip=5&limit=3",
            headers=get_auth_headers()
        )
        
        assert pagination_response.status_code == 200
        pagination_data = pagination_response.json()
        
        # Verify pagination response structure
        assert "organizations" in pagination_data
        assert "total_count" in pagination_data
        assert "skip" in pagination_data
        assert pagination_data["skip"] == 5
        assert len(pagination_data["organizations"]) <= 3
        
        # Test with search parameters
        search_response = client.get(
            "/v0/account/organizations?name_search=Test&member_search=User",
            headers=get_auth_headers()
        )
        
        assert search_response.status_code == 200
        search_data = search_response.json()
        
        # Verify search response structure
        assert "organizations" in search_data
        assert "total_count" in search_data
        assert "skip" in search_data
        assert isinstance(search_data["total_count"], int)
        assert isinstance(search_data["skip"], int)
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info("test_list_organizations_response_structure() end")

@pytest.mark.asyncio
async def test_organization_update_members_only(test_db, mock_auth):
    """Test that we can update organization members without changing the type"""
    logger.info("test_organization_update_members_only() start")
    
    try:
        # Create a test user
        user_data = {
            "email": "member.only@example.com",
            "name": "Member Only",
            "password": "password123",
            "role": "user"
        }
        
        create_user_response = client.post(
            "/v0/account/users",
            json=user_data,
            headers=get_auth_headers()
        )
        assert create_user_response.status_code == 200
        test_user = create_user_response.json()
        
        # Create a team organization
        org_data = {
            "name": "Team Organization",
            "type": "team"
        }
        create_org_response = client.post(
            "/v0/account/organizations",
            json=org_data,
            headers=get_auth_headers()
        )
        assert create_org_response.status_code == 200
        org_id = create_org_response.json()["id"]
        original_type = create_org_response.json()["type"]
        assert original_type == "team"
        
        # Update only the members (without specifying type)
        update_data = {
            "members": [
                {
                    "user_id": test_user["id"],
                    "role": "admin"
                }
            ]
        }
        update_response = client.put(
            f"/v0/account/organizations/{org_id}",
            json=update_data,
            headers=get_auth_headers()
        )
        
        assert update_response.status_code == 200
        updated_org = update_response.json()
        
        # Verify the type didn't change
        assert updated_org["type"] == "team"
        assert updated_org["type"] == original_type
        
        # Verify the member was added
        assert len(updated_org["members"]) == 1
        assert updated_org["members"][0]["user_id"] == test_user["id"]
        assert updated_org["members"][0]["role"] == "admin"
        
        # Clean up
        delete_org_response = client.delete(
            f"/v0/account/organizations/{org_id}",
            headers=get_auth_headers()
        )
        assert delete_org_response.status_code == 200
        
        delete_user_response = client.delete(
            f"/v0/account/users/{test_user['id']}",
            headers=get_auth_headers()
        )
        assert delete_user_response.status_code == 200
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info("test_organization_update_members_only() end")
