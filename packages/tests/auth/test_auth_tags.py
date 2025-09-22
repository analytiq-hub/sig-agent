import pytest
from tests.conftest_utils import client, get_token_headers
import logging

logger = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_tag_permissions(org_and_users, test_db):
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]
    member = org_and_users["member"]
    outsider = org_and_users["outsider"]

    # --- CREATE ---
    admin_tag_data = {
        "name": "admin-test-tag",
        "color": "#FF0000",
        "description": "Test tag for permissions"
    }

    resp = client.post(f"/v0/orgs/{org_id}/tags", json=admin_tag_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to create tag, got {resp.status_code}: {resp.text}"
    logger.info(f"Admin created tag: {resp.json()}")
    admin_tag_id = resp.json()["id"]

    member_tag_data = {
        "name": "member-test-tag",
        "color": "#00FF00",
        "description": "Test tag for permissions"
    }

    # Create a new tag
    resp = client.post(f"/v0/orgs/{org_id}/tags", json=member_tag_data, headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to create tag, got {resp.status_code}: {resp.text}"
    member_tag_id = resp.json()["id"]

    resp = client.post(f"/v0/orgs/{org_id}/tags", json=member_tag_data, headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to create tag, got {resp.status_code}: {resp.text}"

    # --- LIST ---
    resp = client.get(f"/v0/orgs/{org_id}/tags", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to list tags, got {resp.status_code}: {resp.text}"

    resp = client.get(f"/v0/orgs/{org_id}/tags", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to list tags, got {resp.status_code}: {resp.text}"

    resp = client.get(f"/v0/orgs/{org_id}/tags", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to list tags, got {resp.status_code}: {resp.text}"

    # --- UPDATE ---
    admin_update_data = {
        "name": "updated-admin-tag",
        "color": "#00FF00",
        "description": "Updated test tag"
    }
    resp = client.put(f"/v0/orgs/{org_id}/tags/{admin_tag_id}", json=admin_update_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to update tag, got {resp.status_code}: {resp.text}"

    member_update_data = {
        "name": "updated-member-tag",
        "color": "#00FF00",
        "description": "Updated test tag"
    }
    resp = client.put(f"/v0/orgs/{org_id}/tags/{member_tag_id}", json=member_update_data, headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to update tag, got {resp.status_code}: {resp.text}"

    resp = client.put(f"/v0/orgs/{org_id}/tags/{admin_tag_id}", json=admin_update_data, headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403, 404), f"Outsider should NOT be able to update tag, got {resp.status_code}: {resp.text}"

    # --- DELETE ---
    resp = client.delete(f"/v0/orgs/{org_id}/tags/{admin_tag_id}", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to delete tag, got {resp.status_code}: {resp.text}"

    resp = client.delete(f"/v0/orgs/{org_id}/tags/{member_tag_id}", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to delete tag, got {resp.status_code}: {resp.text}"

    resp = client.delete(f"/v0/orgs/{org_id}/tags/{admin_tag_id}", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403, 404), f"Outsider should NOT be able to delete tag, got {resp.status_code}: {resp.text}"

    resp = client.delete(f"/v0/orgs/{org_id}/tags/{member_tag_id}", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403, 404), f"Outsider should NOT be able to delete tag, got {resp.status_code}: {resp.text}" 