import pytest
from tests.test_utils import client, get_token_headers

@pytest.mark.asyncio
async def test_prompt_permissions(org_and_users, test_db, setup_test_models):
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]
    member = org_and_users["member"]
    outsider = org_and_users["outsider"]

    # Use a model that is enabled in your test DB
    model = "gpt-4o-mini"

    # Admin can create prompt
    prompt_data = {
        "name": "Test Prompt",
        "content": "Extract field1 from the document",
        "model": model,
        "tag_ids": []
    }
    resp = client.post(f"/v0/orgs/{org_id}/prompts", json=prompt_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to create prompt, got {resp.status_code}: {resp.text}"
    prompt_revid = resp.json()["prompt_revid"]
    prompt_id = resp.json()["prompt_id"]

    # Member can create prompt
    member_prompt_data = {
        "name": "Member Prompt",
        "content": "Extract field2 from the document",
        "model": model,
        "tag_ids": []
    }
    resp = client.post(f"/v0/orgs/{org_id}/prompts", json=member_prompt_data, headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to create prompt, got {resp.status_code}: {resp.text}"
    member_prompt_revid = resp.json()["prompt_revid"]
    member_prompt_id = resp.json()["prompt_id"]

    # Outsider cannot create prompt
    outsider_prompt_data = {
        "name": "Outsider Prompt",
        "content": "Extract field3 from the document",
        "model": model,
        "tag_ids": []
    }
    resp = client.post(f"/v0/orgs/{org_id}/prompts", json=outsider_prompt_data, headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to create prompt, got {resp.status_code}: {resp.text}"

    # Admin can list prompts
    resp = client.get(f"/v0/orgs/{org_id}/prompts", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to list prompts, got {resp.status_code}: {resp.text}"

    # Member can list prompts
    resp = client.get(f"/v0/orgs/{org_id}/prompts", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to list prompts, got {resp.status_code}: {resp.text}"

    # Outsider cannot list prompts
    resp = client.get(f"/v0/orgs/{org_id}/prompts", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to list prompts, got {resp.status_code}: {resp.text}"

    # Admin can get prompt (by revid)
    resp = client.get(f"/v0/orgs/{org_id}/prompts/{prompt_revid}", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to get prompt, got {resp.status_code}: {resp.text}"

    # Member can get prompt (by revid)
    resp = client.get(f"/v0/orgs/{org_id}/prompts/{prompt_revid}", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to get prompt, got {resp.status_code}: {resp.text}"

    # Outsider cannot get prompt
    resp = client.get(f"/v0/orgs/{org_id}/prompts/{prompt_revid}", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to get prompt, got {resp.status_code}: {resp.text}"

    # Admin can update prompt (by prompt_id)
    update_prompt_data = {
        "name": "Updated Test Prompt",
        "content": "Extract field1 and field2 from the document",
        "model": model,
        "tag_ids": []
    }
    resp = client.put(f"/v0/orgs/{org_id}/prompts/{prompt_id}", json=update_prompt_data, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to update prompt, got {resp.status_code}: {resp.text}"

    # Member can update prompt (by prompt_id)
    member_update_data = {
        "name": "Updated Member Prompt",
        "content": "Extract field2 and field3 from the document",
        "model": model,
        "tag_ids": []
    }
    resp = client.put(f"/v0/orgs/{org_id}/prompts/{member_prompt_id}", json=member_update_data, headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to update prompt, got {resp.status_code}: {resp.text}"

    # Outsider cannot update prompt
    outsider_update_data = {
        "name": "Outsider Update Attempt",
        "content": "Extract field4 from the document",
        "model": model,
        "tag_ids": []
    }
    resp = client.put(f"/v0/orgs/{org_id}/prompts/{prompt_id}", json=outsider_update_data, headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to update prompt, got {resp.status_code}: {resp.text}"

    # Admin can delete prompt (by prompt_id)
    resp = client.delete(f"/v0/orgs/{org_id}/prompts/{prompt_id}", headers=get_token_headers(admin["token"]))
    assert resp.status_code == 200, f"Admin should be able to delete prompt, got {resp.status_code}: {resp.text}"

    # Member can delete prompt (by prompt_id)
    resp = client.delete(f"/v0/orgs/{org_id}/prompts/{member_prompt_id}", headers=get_token_headers(member["token"]))
    assert resp.status_code == 200, f"Member should be able to delete prompt, got {resp.status_code}: {resp.text}"

    # Outsider cannot delete prompt
    resp = client.delete(f"/v0/orgs/{org_id}/prompts/{prompt_id}", headers=get_token_headers(outsider["token"]))
    assert resp.status_code in (401, 403), f"Outsider should NOT be able to delete prompt, got {resp.status_code}: {resp.text}" 