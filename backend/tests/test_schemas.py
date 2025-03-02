import pytest
from bson import ObjectId

# Import shared test utilities
from .test_utils import (
    client, TEST_USER, TEST_ORG_ID, 
    test_db, get_auth_headers, mock_auth
)
import analytiq_data as ad

@pytest.mark.asyncio
async def test_json_schema_lifecycle(test_db, mock_auth):
    """Test the complete JSON schema lifecycle"""
    ad.log.info(f"test_json_schema_lifecycle() start")
    
    try:
        # Step 1: Create a JSON schema
        schema_data = {
            "name": "Test Invoice Schema",
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "invoice_extraction",
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "invoice_number": {
                                "type": "string",
                                "description": "The invoice identifier"
                            },
                            "date": {
                                "type": "string",
                                "format": "date-time",
                                "description": "Invoice date"
                            },
                            "total_amount": {
                                "type": "number",
                                "description": "Total invoice amount"
                            },
                            "vendor": {
                                "type": "object",
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "description": "Vendor name"
                                    },
                                    "address": {
                                        "type": "string",
                                        "description": "Vendor address"
                                    }
                                },
                                "required": ["name"]
                            }
                        },
                        "required": ["invoice_number", "date", "total_amount"]
                    },
                    "strict": True
                }
            }
        }
        
        create_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/schemas",
            json=schema_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        schema_result = create_response.json()
        assert "id" in schema_result
        assert schema_result["name"] == "Test Invoice Schema"
        assert "response_format" in schema_result
        
        schema_id = schema_result["id"]
        
        # Step 2: List schemas to verify it was created
        list_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/schemas",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert "schemas" in list_data
        
        # Find our schema in the list
        created_schema = next((schema for schema in list_data["schemas"] if schema["id"] == schema_id), None)
        assert created_schema is not None
        assert created_schema["name"] == "Test Invoice Schema"
        
        # Step 3: Get the specific schema to verify its content
        get_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/schemas/{schema_id}",
            headers=get_auth_headers()
        )
        
        assert get_response.status_code == 200
        schema_data = get_response.json()
        assert schema_data["id"] == schema_id
        assert schema_data["name"] == "Test Invoice Schema"
        assert "response_format" in schema_data
        assert schema_data["response_format"]["type"] == "json_schema"
        assert "json_schema" in schema_data["response_format"]
        assert "invoice_number" in schema_data["response_format"]["json_schema"]["schema"]["properties"]
        assert "date" in schema_data["response_format"]["json_schema"]["schema"]["properties"]
        assert "total_amount" in schema_data["response_format"]["json_schema"]["schema"]["properties"]
        
        # Step 4: Update the schema
        update_data = {
            "name": "Updated Invoice Schema",
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "invoice_extraction_updated",
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "invoice_number": {
                                "type": "string",
                                "description": "The invoice identifier"
                            },
                            "date": {
                                "type": "string",
                                "format": "date-time",
                                "description": "Invoice date"
                            },
                            "total_amount": {
                                "type": "number",
                                "description": "Total invoice amount"
                            },
                            "tax_amount": {
                                "type": "number",
                                "description": "Tax amount"
                            },
                            "vendor": {
                                "type": "object",
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "description": "Vendor name"
                                    },
                                    "address": {
                                        "type": "string",
                                        "description": "Vendor address"
                                    },
                                    "tax_id": {
                                        "type": "string",
                                        "description": "Vendor tax ID"
                                    }
                                },
                                "required": ["name"]
                            }
                        },
                        "required": ["invoice_number", "date", "total_amount"]
                    },
                    "strict": True
                }
            }
        }
        
        update_response = client.put(
            f"/v0/orgs/{TEST_ORG_ID}/schemas/{schema_id}",
            json=update_data,
            headers=get_auth_headers()
        )
        
        assert update_response.status_code == 200

        ad.log.info(f"update_response: {update_response.json()}")

        updated_schema_id = update_response.json()["id"]
        
        # Step 5: Get the schema again to verify the update
        get_updated_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/schemas/{updated_schema_id}",
            headers=get_auth_headers()
        )
        
        assert get_updated_response.status_code == 200
        updated_schema_data = get_updated_response.json()
        assert updated_schema_data["id"] == updated_schema_id
        assert updated_schema_data["name"] == "Updated Invoice Schema"
        assert "response_format" in updated_schema_data
        assert "tax_amount" in updated_schema_data["response_format"]["json_schema"]["schema"]["properties"]
        assert "tax_id" in updated_schema_data["response_format"]["json_schema"]["schema"]["properties"]["vendor"]["properties"]
        
        # Step 6: Delete the schema
        delete_response = client.delete(
            f"/v0/orgs/{TEST_ORG_ID}/schemas/{schema_id}",
            headers=get_auth_headers()
        )
        
        assert delete_response.status_code == 200
        
        # Step 7: List schemas again to verify it was deleted
        list_after_delete_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/schemas",
            headers=get_auth_headers()
        )
        
        assert list_after_delete_response.status_code == 200
        list_after_delete_data = list_after_delete_response.json()
        
        # Verify the schema is no longer in the list
        deleted_schema = next((schema for schema in list_after_delete_data["schemas"] if schema["id"] == schema_id), None)
        assert deleted_schema is None, "Schema should have been deleted"
        
        # Step 8: Verify that getting the deleted schema returns 404
        get_deleted_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/schemas/{schema_id}",
            headers=get_auth_headers()
        )
        
        assert get_deleted_response.status_code == 404
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    ad.log.info(f"test_json_schema_lifecycle() end")

# @pytest.mark.asyncio
# async def test_schema_validation(test_db, mock_auth):
#     """Test schema validation functionality"""
#     ad.log.info(f"test_schema_validation() start")
    
#     try:
#         # Step 1: Create a simple JSON schema for validation testing
#         schema_data = {
#             "name": "Simple Test Schema",
#             "response_format": {
#                 "type": "json_schema",
#                 "json_schema": {
#                     "name": "validation_test",
#                     "schema": {
#                         "type": "object",
#                         "additionalProperties": False,
#                         "properties": {
#                             "name": {
#                                 "type": "string",
#                                 "minLength": 3
#                             },
#                             "age": {
#                                 "type": "integer",
#                                 "minimum": 18
#                             },
#                             "email": {
#                                 "type": "string",
#                                 "format": "email"
#                             }
#                         },
#                         "required": ["name", "age", "email"]
#                     },
#                     "strict": True
#                 }
#             }
#         }
        
#         create_response = client.post(
#             f"/v0/orgs/{TEST_ORG_ID}/schemas",
#             json=schema_data,
#             headers=get_auth_headers()
#         )
        
#         assert create_response.status_code == 200
#         schema_result = create_response.json()
#         schema_id = schema_result["id"]
        
#         # Step 2: Test validation with valid data
#         valid_data = {
#             "data": {
#                 "name": "John Doe",
#                 "age": 25,
#                 "email": "john.doe@example.com"
#             }
#         }
        
#         valid_validation_response = client.post(
#             f"/v0/orgs/{TEST_ORG_ID}/schemas/{schema_id}/validate",
#             json=valid_data,
#             headers=get_auth_headers()
#         )
        
#         assert valid_validation_response.status_code == 200
#         valid_result = valid_validation_response.json()
#         assert valid_result["valid"] is True
#         assert "errors" not in valid_result or len(valid_result["errors"]) == 0
        
#         # Step 3: Test validation with invalid data
#         invalid_data = {
#             "data": {
#                 "name": "Jo",  # Too short
#                 "age": 16,     # Below minimum
#                 "email": "not-an-email"  # Invalid email format
#             }
#         }
        
#         invalid_validation_response = client.post(
#             f"/v0/orgs/{TEST_ORG_ID}/schemas/{schema_id}/validate",
#             json=invalid_data,
#             headers=get_auth_headers()
#         )
        
#         assert invalid_validation_response.status_code == 200
#         invalid_result = invalid_validation_response.json()
#         assert invalid_result["valid"] is False
#         assert "errors" in invalid_result
#         assert len(invalid_result["errors"]) > 0
        
#         # Clean up
#         client.delete(
#             f"/v0/orgs/{TEST_ORG_ID}/schemas/{schema_id}",
#             headers=get_auth_headers()
#         )
        
#     finally:
#         pass  # mock_auth fixture handles cleanup
    
#     ad.log.info(f"test_schema_validation() end") 