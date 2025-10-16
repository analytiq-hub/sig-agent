import pytest
from tests.conftest_utils import client, get_token_headers

import logging
logger = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_schema_permissions(org_and_users, test_db):
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]
    member = org_and_users["member"]
    outsider = org_and_users["outsider"]

    # Test schema creation permissions
    schema_data = {
        "name": "Test Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "test_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field1": {
                            "type": "string",
                            "description": "Test field 1"
                        }
                    },
                    "required": ["field1"]
                },
                "strict": True
            }
        }
    }

    # Admin can create schema
    resp = client.post(f"/v0/orgs/{org_id}/schemas", json=schema_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to create schema, got {resp.status_code}: {resp.text}"
    schema_revid = resp.json()["schema_revid"]
    schema_id = resp.json()["schema_id"]

    # Member can create schema
    member_schema_data = {
        "name": "Member Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "member_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field2": {
                            "type": "string",
                            "description": "Test field 2"
                        }
                    },
                    "required": ["field2"]
                },
                "strict": True
            }
        }
    }
    resp = client.post(f"/v0/orgs/{org_id}/schemas", json=member_schema_data, headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to create schema, got {resp.status_code}: {resp.text}"
    member_schema_revid = resp.json()["schema_revid"]
    member_schema_id = resp.json()["schema_id"]

    # Outsider cannot create schema
    outsider_schema_data = {
        "name": "Outsider Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "outsider_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field3": {
                            "type": "string",
                            "description": "Test field 3"
                        }
                    },
                    "required": ["field3"]
                },
                "strict": True
            }
        }
    }
    resp = client.post(f"/v0/orgs/{org_id}/schemas", json=outsider_schema_data, headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to create schema, got {resp.status_code}: {resp.text}"

    # Test schema listing permissions
    # Admin can list schemas
    resp = client.get(f"/v0/orgs/{org_id}/schemas", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to list schemas, got {resp.status_code}: {resp.text}"

    # Member can list schemas
    resp = client.get(f"/v0/orgs/{org_id}/schemas", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to list schemas, got {resp.status_code}: {resp.text}"

    # Outsider cannot list schemas
    resp = client.get(f"/v0/orgs/{org_id}/schemas", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to list schemas, got {resp.status_code}: {resp.text}"

    # Test schema retrieval permissions
    # Admin can get schema
    resp = client.get(f"/v0/orgs/{org_id}/schemas/{schema_revid}", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to get schema, got {resp.status_code}: {resp.text}"

    # Member can get schema
    resp = client.get(f"/v0/orgs/{org_id}/schemas/{schema_revid}", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to get schema, got {resp.status_code}: {resp.text}"

    # Outsider cannot get schema
    resp = client.get(f"/v0/orgs/{org_id}/schemas/{schema_revid}", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to get schema, got {resp.status_code}: {resp.text}"

    # Test schema update permissions
    update_schema_data = {
        "name": "Updated Test Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "update_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field1": {
                            "type": "string",
                            "description": "Updated field 1"
                        },
                        "field2": {
                            "type": "number",
                            "description": "Updated field 2"
                        }
                    },
                    "required": ["field1", "field2"]
                },
                "strict": True
            }
        }
    }

    # Admin can update schema
    resp = client.put(f"/v0/orgs/{org_id}/schemas/{schema_id}", json=update_schema_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to update schema, got {resp.status_code}: {resp.text}"

    # Member can update schema
    member_update_data = {
        "name": "Updated Member Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "member_update_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field2": {
                            "type": "string",
                            "description": "Updated member field 2"
                        },
                        "field3": {
                            "type": "boolean",
                            "description": "Updated member field 3"
                        }
                    },
                    "required": ["field2", "field3"]
                },
                "strict": True
            }
        }
    }
    resp = client.put(f"/v0/orgs/{org_id}/schemas/{member_schema_id}", json=member_update_data, headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to update schema, got {resp.status_code}: {resp.text}"

    # Outsider cannot update schema
    outsider_update_data = {
        "name": "Outsider Update Attempt",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "outsider_update_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field4": {
                            "type": "string",
                            "description": "Outsider field 4"
                        }
                    },
                    "required": ["field4"]
                },
                "strict": True
            }
        }
    }
    resp = client.put(f"/v0/orgs/{org_id}/schemas/{schema_revid}", json=outsider_update_data, headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to update schema, got {resp.status_code}: {resp.text}"

    # Test schema validation permissions
    validation_data = {
        "data": {
            "field1": "test value",
            "field2": 42
        }
    }

    # Admin can validate against schema
    resp = client.post(f"/v0/orgs/{org_id}/schemas/{schema_revid}/validate", json=validation_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code in (200, 400)  # 200 if valid, 400 if invalid

    # Member can validate against schema
    resp = client.post(f"/v0/orgs/{org_id}/schemas/{schema_revid}/validate", json=validation_data, headers=get_token_headers(member["token"]))
    assert resp.status_code in (200, 400)

    # Outsider cannot validate against schema
    resp = client.post(f"/v0/orgs/{org_id}/schemas/{schema_revid}/validate", json=validation_data, headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to validate against schema, got {resp.status_code}: {resp.text}"

    # Test schema deletion permissions
    # Create a schema for deletion testing
    delete_test_schema_data = {
        "name": "Delete Test Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "delete_test_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field5": {
                            "type": "string",
                            "description": "Delete test field 5"
                        }
                    },
                    "required": ["field5"]
                },
                "strict": True
            }
        }
    }
    resp = client.post(f"/v0/orgs/{org_id}/schemas", json=delete_test_schema_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to create schema, got {resp.status_code}: {resp.text}"
    delete_schema_revid = resp.json()["schema_revid"]
    delete_schema_id = resp.json()["schema_id"]

    # Admin can delete schema
    resp = client.delete(f"/v0/orgs/{org_id}/schemas/{delete_schema_id}", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to delete schema, got {resp.status_code}: {resp.text}"

    # Create another schema for member deletion test
    member_delete_schema_data = {
        "name": "Member Delete Test Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "member_delete_schema",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "field6": {
                            "type": "string",
                            "description": "Member delete test field 6"
                        }
                    },
                    "required": ["field6"]
                },
                "strict": True
            }
        }
    }
    resp = client.post(f"/v0/orgs/{org_id}/schemas", json=member_delete_schema_data, headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to create schema, got {resp.status_code}: {resp.text}"
    member_delete_schema_revid = resp.json()["schema_revid"]
    member_delete_schema_id = resp.json()["schema_id"]

    # Member can delete schema
    resp = client.delete(f"/v0/orgs/{org_id}/schemas/{member_delete_schema_id}", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to delete schema, got {resp.status_code}: {resp.text}"

    # Outsider cannot delete schema
    resp = client.delete(f"/v0/orgs/{org_id}/schemas/{schema_revid}", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403) 