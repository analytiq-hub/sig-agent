"""
Simple tests for payments system in non-Stripe mode.
Tests basic workspace setup and payment plan verification.
"""

import pytest
import pytest_asyncio
import asyncio
from datetime import datetime, UTC
from bson import ObjectId

# Import payment functions
from app.routes.payments import (
    sync_payments_customer,
    get_payment_customer,
    check_payment_limits,
    save_usage_record,
    CREDIT_CONFIG,
    SPUCreditException
)

# Import database utilities
import analytiq_data as ad


@pytest_asyncio.fixture
async def individual_workspace(test_db):
    """Create a test organization and user for individual workspace testing."""
    db = test_db
    
    # Create a test user
    user_data = {
        "name": "Test User",
        "email": "test@example.com",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    }
    user_result = await db.users.insert_one(user_data)
    user_id = str(user_result.inserted_id)
    
    # Create a test organization
    org_data = {
        "name": "Test Individual Org",
        "type": "individual",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
        "members": [
            {
                "user_id": ObjectId(user_id),
                "role": "admin"
            }
        ]
    }
    org_result = await db.organizations.insert_one(org_data)
    org_id = str(org_result.inserted_id)
    
    yield {
        "org_id": org_id,
        "user_id": user_id,
        "org_data": org_data,
        "user_data": user_data
    }
    
    # Cleanup
    await db.users.delete_one({"_id": ObjectId(user_id)})
    await db.organizations.delete_one({"_id": ObjectId(org_id)})
    await db.payments_customers.delete_one({"org_id": org_id})
    await db.payments_usage_records.delete_many({"org_id": org_id})


@pytest.mark.asyncio
async def test_payments_initialization(test_db):
    """Test that payments system initializes correctly."""
    # Check that default credit config is set
    assert "granted_credits" in CREDIT_CONFIG
    assert isinstance(CREDIT_CONFIG["price_per_credit"], float)


@pytest.mark.asyncio
async def test_create_individual_workspace_payment_customer(individual_workspace, test_db):
    """Test creating a payment customer for an individual workspace."""
    org_id = individual_workspace["org_id"]
    
    # Sync payment customer (creates local record)

    customer = await sync_payments_customer(db=test_db, org_id=org_id)
    
    # Verify customer was created
    assert customer is not None
    assert customer["org_id"] == org_id
    assert customer["user_id"] == individual_workspace["user_id"]
    assert customer["user_name"] == "Test User"
    assert customer["user_email"] == "test@example.com"
    assert customer["stripe_customer_id"] is None  # No Stripe in test mode
    
    # Verify credit initialization
    assert customer["purchased_credits"] == 0
    assert customer["purchased_credits_used"] == 0
    assert customer["granted_credits"] == CREDIT_CONFIG["granted_credits"]
    assert customer["granted_credits_used"] == 0
    
    # Verify subscription fields
    assert customer["subscription_spus_used"] == 0
    assert customer["stripe_current_billing_period_start"] is None
    assert customer["stripe_current_billing_period_end"] is None


@pytest.mark.asyncio
async def test_get_payment_customer(individual_workspace, test_db):
    """Test retrieving payment customer data."""
    org_id = individual_workspace["org_id"]
    
    # Create customer first
    await sync_payments_customer(db=test_db, org_id=org_id)
    
    # Get customer
    customer = await get_payment_customer(test_db, org_id)
    
    assert customer is not None
    assert customer["org_id"] == org_id
    assert customer["granted_credits"] == CREDIT_CONFIG["granted_credits"]


@pytest.mark.asyncio
async def test_payment_limits_with_granted_credits(individual_workspace, test_db):
    """Test payment limit checking with granted credits."""
    org_id = individual_workspace["org_id"]
    
    # Create customer first
    await sync_payments_customer(db=test_db, org_id=org_id)
    
    # Test with small SPU request (should be allowed)
    can_use_10_spus = await check_payment_limits(org_id, 10)
    assert can_use_10_spus is True
    
    # Test with exact granted credits amount
    granted_credits = CREDIT_CONFIG["granted_credits"]
    can_use_all_granted = await check_payment_limits(org_id, granted_credits)
    assert can_use_all_granted is True
    
    # Test with more than granted credits (should raise SPUCreditException for individual plan)
    with pytest.raises(SPUCreditException) as exc_info:
        await check_payment_limits(org_id, granted_credits + 1)
    
    # Verify exception details
    exception = exc_info.value
    assert exception.org_id == org_id
    assert exception.required_spus == granted_credits + 1
    assert exception.available_spus == granted_credits


@pytest.mark.asyncio
async def test_save_usage_record(individual_workspace, test_db):
    """Test saving usage records."""
    org_id = individual_workspace["org_id"]
    
    # Save a usage record
    usage_record = await save_usage_record(
        db=test_db,
        org_id=org_id,
        spus=25,
        operation="llm",
        source="test"
    )
    
    # Verify record was saved
    assert usage_record["org_id"] == org_id
    assert usage_record["spus"] == 25
    assert usage_record["operation"] == "llm"
    assert usage_record["source"] == "test"
    assert isinstance(usage_record["timestamp"], datetime)


@pytest.mark.asyncio
async def test_individual_workspace_plan_setup(individual_workspace, test_db):
    """Test that an individual workspace is set up correctly for payments."""
    org_id = individual_workspace["org_id"]
    
    # Create payment customer
    customer = await sync_payments_customer(db=test_db, org_id=org_id)
    
    # Verify individual workspace characteristics:
    # 1. Has granted credits for getting started
    assert customer["granted_credits"] == CREDIT_CONFIG["granted_credits"]
    assert customer["granted_credits_used"] == 0
    
    # 2. No purchased credits initially
    assert customer["purchased_credits"] == 0
    assert customer["purchased_credits_used"] == 0
    
    # 3. No active subscription initially
    assert customer.get("subscription_type") is None
    assert customer["subscription_spus_used"] == 0
    
    # 4. Can use granted credits for small workloads
    can_process_documents = await check_payment_limits(org_id, 50)
    assert can_process_documents is True
    
    # 5. Cannot exceed granted credits without payment (should raise SPUCreditException)
    with pytest.raises(SPUCreditException):
        await check_payment_limits(org_id, CREDIT_CONFIG["granted_credits"] + 1)


@pytest.mark.asyncio
async def test_workspace_without_payment_customer_fails(test_db):
    """Test that payment limits fail for non-existent customer."""
    fake_org_id = str(ObjectId())

    with pytest.raises(ValueError, match="No customer found"):
        await check_payment_limits(fake_org_id, 10)


@pytest.mark.asyncio
async def test_usage_range_per_operation(org_and_users, test_db):
    """Test the per_operation parameter in get_usage_range endpoint."""
    from datetime import timedelta
    from app.routes.payments import SPU_USAGE_OPERATIONS
    from fastapi.testclient import TestClient
    from app.main import app

    org_id = org_and_users["org_id"]
    admin_token = org_and_users["admin"]["token"]

    # Create test client
    client = TestClient(app)

    # Insert test usage records with different operations across 2 days
    base_time = datetime.now(UTC) - timedelta(days=2)

    test_records = [
        # Day 1: llm operations
        {"org_id": org_id, "spus": 10, "operation": "llm", "timestamp": base_time, "source": "test"},
        {"org_id": org_id, "spus": 20, "operation": "llm", "timestamp": base_time + timedelta(hours=1), "source": "test"},
        # Day 1: claude_log operation
        {"org_id": org_id, "spus": 5, "operation": "claude_log", "timestamp": base_time + timedelta(hours=2), "source": "test"},

        # Day 2: llm operation
        {"org_id": org_id, "spus": 15, "operation": "llm", "timestamp": base_time + timedelta(days=1), "source": "test"},
        # Day 2: telemetry_trace operation
        {"org_id": org_id, "spus": 8, "operation": "telemetry_trace", "timestamp": base_time + timedelta(days=1, hours=1), "source": "test"},
    ]

    await test_db.payments_usage_records.insert_many(test_records)

    # Test 1: Query WITHOUT per_operation (should aggregate all operations per day)
    response1 = client.get(
        f"/v0/orgs/{org_id}/payments/usage/range",
        params={
            "start_date": base_time.isoformat(),
            "end_date": (base_time + timedelta(days=3)).isoformat(),
            "per_operation": False,
            "timezone": "UTC"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response1.status_code == 200, f"Expected 200, got {response1.status_code}: {response1.text}"
    data1 = response1.json()

    # Should have 2 data points (one per day)
    assert len(data1['data_points']) == 2, f"Expected 2 data points, got {len(data1['data_points'])}"

    # Day 1 should have 35 SPUs total (10+20+5)
    assert data1['data_points'][0]['spus'] == 35, f"Day 1 expected 35 SPUs, got {data1['data_points'][0]['spus']}"

    # Day 2 should have 23 SPUs total (15+8)
    assert data1['data_points'][1]['spus'] == 23, f"Day 2 expected 23 SPUs, got {data1['data_points'][1]['spus']}"

    # Total should be 58
    assert data1['total_spus'] == 58, f"Expected 58 total SPUs, got {data1['total_spus']}"

    # Operation should be None when per_operation=False
    assert data1['data_points'][0]['operation'] is None, "Operation should be None when per_operation=False"
    assert data1['data_points'][1]['operation'] is None, "Operation should be None when per_operation=False"

    # Test 2: Query WITH per_operation (should break down by operation per day)
    response2 = client.get(
        f"/v0/orgs/{org_id}/payments/usage/range",
        params={
            "start_date": base_time.isoformat(),
            "end_date": (base_time + timedelta(days=3)).isoformat(),
            "per_operation": True,
            "timezone": "UTC"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response2.status_code == 200, f"Expected 200, got {response2.status_code}: {response2.text}"
    data2 = response2.json()

    # Should have 4 data points (breakdown by operation)
    assert len(data2['data_points']) == 4, f"Expected 4 data points with per_operation, got {len(data2['data_points'])}"

    # Total should still be 58
    assert data2['total_spus'] == 58, f"Expected 58 total SPUs, got {data2['total_spus']}"

    # Verify each breakdown (sorted by date then operation)
    # Day 1, claude_log: 5 SPUs
    assert data2['data_points'][0]['operation'] == 'claude_log', f"Expected claude_log, got {data2['data_points'][0]['operation']}"
    assert data2['data_points'][0]['spus'] == 5

    # Day 1, llm: 30 SPUs (10+20)
    assert data2['data_points'][1]['operation'] == 'llm', f"Expected llm, got {data2['data_points'][1]['operation']}"
    assert data2['data_points'][1]['spus'] == 30

    # Day 2, llm: 15 SPUs
    assert data2['data_points'][2]['operation'] == 'llm', f"Expected llm, got {data2['data_points'][2]['operation']}"
    assert data2['data_points'][2]['spus'] == 15

    # Day 2, telemetry_trace: 8 SPUs
    assert data2['data_points'][3]['operation'] == 'telemetry_trace', f"Expected telemetry_trace, got {data2['data_points'][3]['operation']}"
    assert data2['data_points'][3]['spus'] == 8

    # Verify all operations are valid
    for data_point in data2['data_points']:
        operation = data_point.get('operation')
        assert operation in SPU_USAGE_OPERATIONS, f"Invalid operation: {operation}"


@pytest.mark.asyncio
async def test_usage_range_with_timezone(org_and_users, test_db):
    """Test the timezone parameter in get_usage_range endpoint."""
    from datetime import timedelta
    from fastapi.testclient import TestClient
    from app.main import app

    org_id = org_and_users["org_id"]
    admin_token = org_and_users["admin"]["token"]

    # Create test client
    client = TestClient(app)

    # Insert test usage records at specific UTC times that cross date boundaries
    # We'll use a time that's 23:00 UTC on one day
    base_time_utc = datetime(2025, 1, 15, 23, 0, 0, tzinfo=UTC)  # 23:00 UTC on Jan 15

    test_records = [
        # Record at 23:00 UTC (Jan 15)
        {"org_id": org_id, "spus": 100, "operation": "llm", "timestamp": base_time_utc, "source": "test"},
        # Record at 01:00 UTC next day (Jan 16)
        {"org_id": org_id, "spus": 200, "operation": "llm", "timestamp": base_time_utc + timedelta(hours=2), "source": "test"},
    ]

    await test_db.payments_usage_records.insert_many(test_records)

    # Test 1: Query with UTC timezone (default)
    response_utc = client.get(
        f"/v0/orgs/{org_id}/payments/usage/range",
        params={
            "start_date": (base_time_utc - timedelta(days=1)).isoformat(),
            "end_date": (base_time_utc + timedelta(days=2)).isoformat(),
            "per_operation": False,
            "timezone": "UTC"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response_utc.status_code == 200, f"Expected 200, got {response_utc.status_code}: {response_utc.text}"
    data_utc = response_utc.json()

    # In UTC, should have 2 data points (one for Jan 15, one for Jan 16)
    assert len(data_utc['data_points']) == 2, f"Expected 2 data points in UTC, got {len(data_utc['data_points'])}"
    assert data_utc['total_spus'] == 300

    # Test 2: Query with America/Los_Angeles timezone (UTC-8)
    # 23:00 UTC = 15:00 PST (same day)
    # 01:00 UTC next day = 17:00 PST (same day)
    response_pst = client.get(
        f"/v0/orgs/{org_id}/payments/usage/range",
        params={
            "start_date": (base_time_utc - timedelta(days=1)).isoformat(),
            "end_date": (base_time_utc + timedelta(days=2)).isoformat(),
            "per_operation": False,
            "timezone": "America/Los_Angeles"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response_pst.status_code == 200, f"Expected 200, got {response_pst.status_code}: {response_pst.text}"
    data_pst = response_pst.json()

    # In PST, both records should be on Jan 15, so only 1 data point
    assert len(data_pst['data_points']) == 1, f"Expected 1 data point in PST, got {len(data_pst['data_points'])}"
    assert data_pst['data_points'][0]['spus'] == 300, "Both records should be aggregated on Jan 15 PST"
    assert data_pst['total_spus'] == 300

    # Test 3: Query with Europe/Paris timezone (UTC+1)
    # 23:00 UTC = 00:00 CET next day (Jan 16)
    # 01:00 UTC next day = 02:00 CET (Jan 16)
    response_cet = client.get(
        f"/v0/orgs/{org_id}/payments/usage/range",
        params={
            "start_date": (base_time_utc - timedelta(days=1)).isoformat(),
            "end_date": (base_time_utc + timedelta(days=2)).isoformat(),
            "per_operation": False,
            "timezone": "Europe/Paris"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response_cet.status_code == 200, f"Expected 200, got {response_cet.status_code}: {response_cet.text}"
    data_cet = response_cet.json()

    # In CET, both records should be on Jan 16, so only 1 data point
    assert len(data_cet['data_points']) == 1, f"Expected 1 data point in CET, got {len(data_cet['data_points'])}"
    assert data_cet['data_points'][0]['spus'] == 300, "Both records should be aggregated on Jan 16 CET"
    assert data_cet['total_spus'] == 300


if __name__ == "__main__":
    # Run tests directly
    asyncio.run(pytest.main([__file__, "-v"]))