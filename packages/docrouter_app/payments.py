import os
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Body, BackgroundTasks
from pydantic import BaseModel, Field
import stripe
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId
import asyncio

import analytiq_data as ad

from docrouter_app.auth import (
    get_current_user,
    is_org_admin,
    is_sys_admin
)
from docrouter_app.models import User

import asyncio
import stripe
from functools import partial
from typing import Any, Dict, List, Optional

class StripeAsync:
    @staticmethod
    async def _run_in_threadpool(func, *args, **kwargs):
        """Run a Stripe API call in a thread pool to make it non-blocking"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    @staticmethod
    async def customer_create(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Customer.create, *args, **kwargs)

    @staticmethod
    async def customer_modify(customer_id: str, *args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Customer.modify, customer_id, *args, **kwargs)

    @staticmethod
    async def customer_list(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Customer.list, *args, **kwargs)

    @staticmethod
    async def customer_search(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Customer.search, *args, **kwargs)

    @staticmethod
    async def customer_delete(customer_id: str) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Customer.delete, customer_id)

    @staticmethod
    async def subscription_create(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Subscription.create, *args, **kwargs)

    @staticmethod
    async def subscription_modify(subscription_id: str, *args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Subscription.modify, subscription_id, *args, **kwargs)

    @staticmethod
    async def subscription_list(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Subscription.list, *args, **kwargs)

    @staticmethod
    async def subscription_delete(subscription_id: str) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.Subscription.delete, subscription_id)

    @staticmethod
    async def setup_intent_create(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.SetupIntent.create, *args, **kwargs)

    @staticmethod
    async def billing_portal_session_create(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(stripe.billing_portal.Session.create, *args, **kwargs)

    @staticmethod
    async def webhook_construct_event(payload: bytes, sig_header: str, secret: str) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(
            stripe.Webhook.construct_event,
            payload,
            sig_header,
            secret
        )

    @staticmethod
    async def billing_meter_event_list(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(
            stripe.billing.Meter.list_events,
            *args,
            **kwargs
        )

    @staticmethod
    async def billing_meter_event_summary_list(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(
            stripe.billing.Meter.list_event_summaries,
            *args,
            **kwargs
        )

    @staticmethod
    async def usage_record_create(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(
            stripe.billing.MeterEvent.create,
            *args,
            **kwargs
        )

# Configure logger
logger = logging.getLogger(__name__)

# Initialize FastAPI router
payments_router = APIRouter(prefix="/v0/account/payments", tags=["payments"])

stripe_webhook_secret = None

# MongoDB configuration
MONGO_URI = None
ENV = None

# Initialize MongoDB client
client = None
db = None

# Define Stripe-specific collections with prefix
stripe_customers = None
stripe_events = None

# Stripe configuration constants
FREE_TIER_LIMIT = 50  # Number of free SPUs
TIER_CONFIG = {}
STRIPE_METER_ID = None

# Pydantic models for request/response validation
class SetupIntentCreate(BaseModel):
    customer_id: str

class SubscriptionCreate(BaseModel):
    customer_id: str
    price_id: Optional[str] = None

class UsageRecord(BaseModel):
    org_id: str  # Changed from user_id to org_id
    spus: int = Field(default=0)  # New field for SPU tracking
    operation: str
    source: str = "backend"

class PortalSessionCreate(BaseModel):
    org_id: str

class PortalSessionResponse(BaseModel):
    url: str

class SubscriptionPlan(BaseModel):
    plan_id: str
    name: str
    price_id: str
    price: float
    currency: str = "usd"
    interval: str = "month"
    features: List[str]
    included_usage: int
    overage_price: float

class SubscriptionPlanResponse(BaseModel):
    plans: List[SubscriptionPlan]
    current_plan: Optional[str] = None
    has_payment_method: bool = False
    subscription_status: Optional[str] = None
    cancel_at_period_end: bool = False
    current_period_end: Optional[int] = None  # Unix timestamp

class ChangePlanRequest(BaseModel):
    org_id: str
    plan_id: str

class SubscriptionHistory(BaseModel):
    user_id: str
    stripe_customer_id: str
    subscription_id: str
    subscription_item_id: str
    price_id: str
    subscription_type: str
    status: str
    start_date: datetime
    end_date: Optional[datetime] = None
    usage_during_period: int = 0
    created_at: datetime
    updated_at: datetime

# Add this new function near the top of the file with other helper functions
def get_subscription_type_from_price_id(price_id: str) -> str:
    """
    Determine the subscription type (individual, team, enterprise) based on the price_id
    
    Args:
        price_id: The Stripe price ID to look up
        
    Returns:
        str: The subscription type (individual, team, enterprise) or None if not found
    """
    for tier, tier_price_id in TIER_CONFIG.items():
        if tier_price_id["price_id"] == price_id:
            return tier
    return None

async def init_payments_env():
    global MONGO_URI, ENV
    global TIER_CONFIG
    global NEXTAUTH_URL
    global STRIPE_METER_ID
    global client, db
    global stripe_customers, stripe_events
    global stripe_webhook_secret

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    ENV = os.getenv("ENV", "dev")
    
    # Single shared meter for all SPU consumption
    STRIPE_METER_ID = os.getenv("STRIPE_METER_ID", "")

    TIER_CONFIG = {
        "individual": {
            "price_id": os.getenv("STRIPE_PRICE_ID_INDIVIDUAL", ""),
            "base_price": 9.99,
            "included_usage": 100,  # Included SPUs
            "overage_price": 0.01,  # Price per SPU after limit
        },
        "team": {
            "price_id": os.getenv("STRIPE_PRICE_ID_TEAM", ""),
            "base_price": 29.99,
            "included_usage": 500,  # Included SPUs
            "overage_price": 0.02,  # Price per SPU after limit
        },
        "enterprise": {
            "price_id": os.getenv("STRIPE_PRICE_ID_ENTERPRISE", ""),
            "base_price": 99.99,
            "included_usage": 2000,  # Included SPUs
            "overage_price": 0.05,  # Price per SPU after limit
        }
    }
    NEXTAUTH_URL = os.getenv("NEXTAUTH_URL", "http://localhost:3000")

    client = AsyncIOMotorClient(MONGO_URI)
    db = client[ENV]

    stripe_customers = db.stripe_customers
    stripe_events = db.stripe_events
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

async def init_payments():
    await init_payments_env()

    logger.info("Stripe initialized")

    await sync_all_payments_customers()
    logger.info("Stripe customers synced")

async def sync_all_payments_customers() -> Tuple[int, int, List[str]]:
    """
    Synchronize all organizations in the database with Stripe by creating customer records
    in parallel batches of 10 customers at a time.
    
    Returns:
        Tuple containing (total_users, successful_syncs, error_messages)
    """
    if not stripe.api_key:
        # No-op if Stripe is not configured
        logger.warning("Stripe API key not configured - sync_all_payments_customers aborted")
        return 0, 0, ["Stripe API key not configured"]

    logger.info("Starting sync of all customers with Stripe")
    
    try:
        # Get all users from the database
        orgs = await db["organizations"].find().to_list(length=None)
        total_orgs = len(orgs)
        successful = 0
        errors = []
        
        # Process users in batches of 10
        batch_size = 10
        for i in range(0, total_orgs, batch_size):
            batch = orgs[i:i + batch_size]
            
            # Create tasks for each user in the batch
            tasks = []
            org_map = {}  # Map to store task index to org mapping
            for idx, org in enumerate(batch):
                try:
                    org_id = str(org.get("_id"))
                    
                    # Create task for syncing customer
                    task = sync_payments_customer(org_id=org_id)
                    tasks.append(task)
                    org_map[idx] = org  # Store org reference with task index
                
                except Exception as e:
                    error_msg = f"Error preparing sync for organization {org_id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            # Execute batch of tasks in parallel
            if tasks:
                try:
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    
                    # Process results
                    for idx, result in enumerate(results):
                        if isinstance(result, Exception):
                            org = org_map.get(idx)
                            error_msg = f"Error syncing customer for org {org.get('name', 'unknown')}: {str(result)}"
                            logger.error(error_msg)
                            errors.append(error_msg)
                        elif result:
                            successful += 1
                        else:
                            errors.append("Failed to create/get customer")
                
                except Exception as e:
                    error_msg = f"Error processing batch: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            logger.info(f"Processed batch {i//batch_size + 1}/{(total_orgs + batch_size - 1)//batch_size}")
        
        logger.info(f"{successful}/{total_orgs} customers synchronized with Stripe")
        return total_orgs, successful, errors
    
    except Exception as e:
        logger.error(f"Error during customer sync with Stripe: {e}")
        return 0, 0, [f"Global error: {str(e)}"]

async def get_payments_customer(org_id: str) -> Dict[str, Any]:
    """
    Get the Stripe customer for the given org_id
    """
    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    stripe_customer_list = await StripeAsync.customer_search(query=f"metadata['org_id']:'{org_id}'")
        
    if stripe_customer_list and stripe_customer_list.data:
        if len(stripe_customer_list.data) > 1:
            logger.warning(f"Multiple Stripe customers found for org_id: {org_id}")
        
        return stripe_customer_list.data[0]
    else:
        logger.info(f"No Stripe customers found for org_id: {org_id}")
        return None

# Helper functions
async def sync_payments_customer(org_id: str) -> Dict[str, Any]:
    """Create or retrieve a Stripe customer for the given user"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    # Get the org_name from the org_id
    org = await db["organizations"].find_one({"_id": ObjectId(org_id)})
    org_name = org.get("name")

    # Get the first admin member
    user_id = None
    members = org.get("members", [])
    for member in members:
        if member.get("role") == "admin":
            user_id = str(member.get("user_id"))
            break
    
    if not user_id:
        logger.error(f"No admin member found for org_id: {org_id}")
        return None

    # Get the user_name from the user_id
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        logger.error(f"No user found for user_id: {user_id} in org_id: {org_id}")
        return None
    
    user_name = user.get("name")
    user_email = user.get("email")

    customer_metadata = {
        "org_id": org_id,
        "org_name": org_name,
        "user_id": user_id,
        "updated_at": datetime.utcnow().isoformat()
    }

    if not user_name:
        logger.error(f"No user_name found for user_id: {user_id}")
        return None

    if not user_email:
        logger.error(f"No email found for user_id: {user_id}")
        return None

    
    logger.info(f"Sync stripe customer for org_id: {org_id} user_id: {user_id} email: {user_email} name: {user_name} org_name: {org_name}")

    try:
        # Check if customer already exists in our DB
        customer = await stripe_customers.find_one({"org_id": org_id})
    
        # Search for customers in Stripe with the given org_id
        stripe_customer = await get_payments_customer(org_id)

        if stripe_customer:            
            # Get the metadata from the Stripe customer
            stripe_customer_metadata = stripe_customer.metadata

            update_customer = False
            if stripe_customer.name != user_name or stripe_customer.email != user_email:
                update_customer = True

            for key in ["org_id", "org_name", "user_id"]:
                if stripe_customer_metadata.get(key) != customer_metadata.get(key):
                    update_customer = True
                    break

            if update_customer:
                # Update the customer in Stripe with additional metadata
                await StripeAsync.customer_modify(
                    stripe_customer.id,
                    name=user_name,
                    email=user_email,
                    metadata=customer_metadata
                )
                logger.info(f"Updated Stripe customer {stripe_customer.id} email {user_email} user_name {user_name} metadata {customer_metadata}")
        else:
            # Create new customer in Stripe
            stripe_customer = await StripeAsync.customer_create(
                name=user_name,
                email=user_email,
                metadata=customer_metadata
            )
            logger.info(f"Created new Stripe customer {stripe_customer.id} email {user_email} user_name {user_name} metadata {customer_metadata}")
        
        # Ensure the customer is subscribed by default to the plan matching the org type
        org_type = org.get("type")
        await set_subscription_type(stripe_customer.id, org_type)

        if customer:
            # Check if the customer_id changed
            if customer.get("stripe_customer_id") != stripe_customer.id:
                logger.info(f"Stripe customer_id changed from {customer.get('stripe_customer_id')} to {stripe_customer.id}")
                
                # Delete the old customer
                await stripe_customers.delete_one({"org_id": org_id})
                customer = None
        
        if customer:
            # Update the customer document with the new subscription and usage data
            await stripe_customers.update_one(
                {"org_id": org_id},
                {"$set": {
                    "name": user_name,
                    "user_id": user_id,
                    "user_name": user_name,
                    "user_email": user_email,
                    "has_payment_method": payment_method_exists(stripe_customer),
                    "updated_at": datetime.utcnow()
                }}
            )
            customer = await stripe_customers.find_one({"user_id": user_id})
            logger.info(f"Updated customer for user_id: {user_id}")
        else:
            logger.info(f"Customer {user_id} not found in MongoDB, creating")
        
            # Store in our database
            customer = {
                "org_id": org_id,
                "user_id": user_id,
                "stripe_customer_id": stripe_customer.id,
                "user_name": user_name,
                "user_email": user_email,
                "has_payment_method": payment_method_exists(stripe_customer),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            await stripe_customers.insert_one(customer)

        return customer
    
    except Exception as e:
        logger.error(f"Error in sync_payments_customer: {e}")
        raise e

async def record_usage(org_id: str, spus: int, operation: str, source: str = "backend", spu_consumed: int = None) -> Dict[str, Any]:
    """Record usage for an organization and report to Stripe if on paid tier"""

    logger.info(f"record_usage called with org_id: {org_id}, spus: {spus}, operation: {operation}, source: {source}")

    if not stripe.api_key:
        logger.warning("Stripe API key not configured - record_usage aborted")
        return None

    # Get the stripe customer
    stripe_customer = await get_payments_customer(org_id)
    if not stripe_customer:
        raise ValueError(f"No customer found for org_id: {org_id}")

    logger.info(f"Stripe customer found for org_id: {org_id}: {stripe_customer.id}")

    # Get current subscription
    subscription = await get_subscription(stripe_customer.id)

    if not subscription or not subscription.get("status") == "active":
        logger.info(f"No active subscription found for org_id: {org_id}")
        return None
    
    # Organization has an active subscription - report usage to Stripe
    subscription_item_id = subscription["items"]["data"][0]["id"]

    logger.info(f"Subscription item id found for org_id: {org_id}: {subscription_item_id}")
    
    try:
        # Report usage to Stripe's metered billing (using SPU instead of pages)
        await StripeAsync.usage_record_create(
            event_name="docrouterspu",
            payload={
                "value": spus,
                "stripe_customer_id": stripe_customer.id,
            }
        )
        logger.info(f"Reported {spus} SPUs to Stripe for org {org_id}")
    except Exception as e:
        logger.error(f"Failed to report usage to Stripe: {e}")
        # Continue with local tracking as fallback
    
    # Always store usage locally for analytics
    usage_record = {
        "org_id": org_id,
        "stripe_customer_id": stripe_customer.id,
        "spus": spus,
        "operation": operation,
        "source": source,
        "timestamp": datetime.utcnow(),
        "reported_to_stripe": bool(subscription and subscription.get("status") == "active")
    }
    
    return usage_record

async def check_usage_limits(org_id: str) -> Dict[str, Any]:
    """Check if organization has hit usage limits and needs to upgrade"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    logger.info(f"Checking usage limits for org_id: {org_id}")

    customer = await stripe_customers.find_one({"org_id": org_id})
    if not customer:
        raise ValueError(f"No customer found for org_id: {org_id}")
    
    if customer["usage_tier"] == "free" and customer["current_month_usage"] >= FREE_TIER_LIMIT:
        return {
            "limit_reached": True,
            "current_usage": customer["current_month_usage"],
            "limit": FREE_TIER_LIMIT,
            "needs_upgrade": True
        }
    
    return {
        "limit_reached": False,
        "current_usage": customer["current_month_usage"],
        "remaining": FREE_TIER_LIMIT - customer["current_month_usage"] if customer["usage_tier"] == "free" else "unlimited",
        "needs_upgrade": False
    }

async def delete_payments_customer(org_id: str, force: bool = False) -> Dict[str, Any]:
    """
    Mark a Stripe customer as deleted without actually removing them from Stripe
    
    Args:
        org_id: The org ID of the Stripe customer to mark as deleted
        
    Returns:
        Dictionary with status information about the operation
    """

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    logger.info(f"Marking Stripe customer as deleted for org_id: {org_id}")
    
    try:
        # Find Stripe customer
        stripe_customer = await stripe_customers.find_one({"org_id": org_id})
        if not stripe_customer:
            logger.warning(f"No Stripe customer found for org_id: {org_id}")
            return {"success": False, "reason": "Customer not found"}
            
        if not force:
            # Delete the Stripe subscription
            stripe_subscription = await get_subscription(stripe_customer["stripe_customer_id"])
            if stripe_subscription:
                await StripeAsync.subscription_delete(stripe_subscription.id)

            # In Stripe, we typically don't delete customers but mark them as deleted
            await StripeAsync.customer_modify(
                stripe_customer["stripe_customer_id"],
                metadata={"deleted": "true", "deleted_at": datetime.utcnow().isoformat()}
            )
        
            # Update our database record
            await stripe_customers.update_one(
                {"org_id": org_id},
                {"$set": {"deleted": True, "deleted_at": datetime.utcnow()}}
            )
        else:
            # Delete the Stripe customer
            await StripeAsync.customer_delete(stripe_customer["stripe_customer_id"])
        
            # Delete the Stripe customer from our database
            await stripe_customers.delete_one({"org_id": org_id})
        
        return {
            "success": True, 
            "customer_id": stripe_customer["stripe_customer_id"],
            "deleted_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error handling Stripe customer deletion: {e}")
        return {"success": False, "error": str(e)}

def payment_method_exists(stripe_customer: Dict[str, Any]) -> bool:
    """
    Check if customer has a payment method
    """
    # Check if the customer has a default payment method
        
    if stripe_customer.get("invoice_settings", {}).get("default_payment_method"):
        return True
    else:
        return False

async def get_subscription(customer_id: str) -> Dict[str, Any]:
    """Get a subscription for a customer"""
    stripe_subscription_list = await StripeAsync.subscription_list(customer=customer_id)
    if not stripe_subscription_list or not stripe_subscription_list.get("data"):
        return None

    n_subscriptions =  len(stripe_subscription_list.get("data"))
    if n_subscriptions > 1:
        raise ValueError(f"{n_subscriptions} subscriptions found for customer_id: {customer_id}")
    elif n_subscriptions == 0:
        return None
    
    return stripe_subscription_list.get("data")[0]

def get_subscription_type(subscription: Dict[str, Any]) -> str:
    """Get the subscription type for a subscription"""
    price_id = subscription.get("items").get("data")[0].get("price").get("id")
    return get_subscription_type_from_price_id(price_id)
    

async def set_subscription_type(customer_id: str, subscription_type: str):
    """Enable a subscription for a customer"""

    if subscription_type not in TIER_CONFIG.keys():
        raise ValueError(f"Invalid subscription type: {subscription_type}, not in {TIER_CONFIG.keys()}")

    price_id = TIER_CONFIG[subscription_type]["price_id"]

    # Get the current subscription type
    subscription = await get_subscription(customer_id)
    if subscription:
        current_subscription_type = get_subscription_type(subscription)
        if current_subscription_type == subscription_type:
            logger.info(f"Subscription type already set to {subscription_type} for customer_id: {customer_id}")
            return True

        # Delete the current subscription
        await StripeAsync.subscription_delete(subscription.id)

    price_id = TIER_CONFIG[subscription_type]["price_id"]

    # Create a new subscription
    subscription = await StripeAsync.subscription_create(
        customer=customer_id,
        items=[{
            'price': price_id,
        }],
        payment_behavior='default_incomplete',
        expand=['latest_invoice.payment_intent'],
    )

    if subscription:
        return True
    else:
        return False

@payments_router.post("/customer-portal")
async def customer_portal(
    data: PortalSessionCreate,
) -> PortalSessionResponse:
    """Generate a Stripe Customer Portal link"""

    logger.info(f"Generating Stripe customer portal for org_id: {data.org_id}")

    try:
        customer = await stripe_customers.find_one({"org_id": data.org_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        logger.info(f"Stripe customer found for org_id: {data.org_id}: {customer['stripe_customer_id']}")
        session = await StripeAsync.billing_portal_session_create(
            customer=customer["stripe_customer_id"],
            return_url=f"{NEXTAUTH_URL}/settings/organizations/{data.org_id}",
        )
        logger.info(f"Stripe customer portal URL: {session.url}")
        return PortalSessionResponse(url=session.url)
    except Exception as e:
        logger.error(f"Error generating Stripe customer portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/webhook", status_code=200)
async def webhook_received(
    request: Request,
):
    """Handle Stripe webhook events"""

    try:
        event = await StripeAsync.webhook_construct_event(
            await request.body(),
            request.headers.get("stripe-signature"),
            stripe_webhook_secret
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    logger.info(f"Stripe webhook event received: {event['type']}")

    # Store event in database for audit
    event_doc = {
        "stripe_event_id": event["id"],
        "type": event["type"],
        "data": event["data"],
        "created": datetime.fromtimestamp(event["created"]),
        "processed": False,
        "created_at": datetime.utcnow()
    }
    await stripe_events.insert_one(event_doc)
    
    # Process different event types
    if event["type"] == "customer.subscription.created" or event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        await handle_subscription_updated(subscription)
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await handle_subscription_deleted(subscription)
    
    # Mark event as processed
    await stripe_events.update_one(
        {"stripe_event_id": event["id"]},
        {"$set": {"processed": True, "processed_at": datetime.utcnow()}}
    )
    
    return {"status": "success"}

@payments_router.post("/record-usage")
async def api_record_usage(
    usage: UsageRecord,
    current_user: User = Depends(get_current_user)
):
    """Record usage for an organization"""

    logger.info(f"api_record_usage called with org_id: {usage.org_id}, spus: {usage.spus}, operation: {usage.operation}, source: {usage.source}")

    try:
        result = await record_usage(
            usage.org_id,
            usage.spus,
            usage.operation,
            usage.source,
        )
        limits = await check_usage_limits(usage.org_id)
        return {"success": True, "usage": result, "limits": limits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions for webhook handlers
async def handle_subscription_updated(subscription: Dict[str, Any]):
    """Handle subscription created or updated event"""
    logger.info(f"Handling subscription updated event for subscription_id: {subscription['id']}")
    try:
        # Find the customer
        customer = await stripe_customers.find_one({"stripe_customer_id": subscription["customer"]})
        if not customer:
            logger.warning(f"Received subscription update for unknown customer: {subscription['customer']}")
            return

        # Get subscription details
        subscription_item_id = subscription["items"]["data"][0]["id"] if "items" in subscription and "data" in subscription["items"] else None
        price_id = subscription["items"]["data"][0]["price"]["id"] if "items" in subscription and "data" in subscription["items"] else None
        subscription_type = get_subscription_type_from_price_id(price_id)

        # Check if this is a new subscription or an update
        existing_history = None # TODO: Get subscription history from Stripe

        if existing_history:
            # TODO: Update existing subscription history
            pass
        else:
            # Create new subscription history entry
            new_history = {
                "user_id": customer["user_id"],
                "stripe_customer_id": subscription["customer"],
                "subscription_id": subscription["id"],
                "subscription_item_id": subscription_item_id,
                "price_id": price_id,
                "subscription_type": subscription_type,
                "status": subscription["status"],
                "start_date": datetime.fromtimestamp(subscription["current_period_start"]),
                "end_date": None,  # Will be set when subscription ends
                "usage_during_period": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

        # Update customer's current subscription info
        await stripe_customers.update_one(
            {"stripe_customer_id": subscription["customer"]},
            {
                "$set": {
                    "current_subscription": {
                        "subscription_id": subscription["id"],
                        "subscription_type": subscription_type,
                        "status": subscription["status"],
                        "price_id": price_id,
                        "current_period_start": datetime.fromtimestamp(subscription["current_period_start"]),
                        "current_period_end": datetime.fromtimestamp(subscription["current_period_end"])
                    },
                    "updated_at": datetime.utcnow()
                }
            }
        )

    except Exception as e:
        logger.error(f"Error processing subscription update: {e}")

async def handle_subscription_deleted(subscription: Dict[str, Any]):
    """Handle subscription deleted event"""
    logger.info(f"Handling subscription deleted event for subscription_id: {subscription['id']}")
    try:
        # Update customer's current subscription info
        await stripe_customers.update_one(
            {"stripe_customer_id": subscription["customer"]},
            {
                "$set": {
                    "current_subscription": None,
                    "updated_at": datetime.utcnow()
                }
            }
        )

    except Exception as e:
        logger.error(f"Error processing subscription deletion: {e}")

async def delete_all_payments_customers(dryrun: bool = True) -> Dict[str, Any]:
    """
    Permanently delete all customers from Stripe
    
    WARNING: This is a destructive operation that cannot be undone. It will:
    1. Delete all customers from Stripe
    2. Remove all customer records from the local database
    3. Delete all related subscriptions and usage records
    
    Args:
        confirm: Safety flag that must be set to True to perform deletion
        
    Returns:
        Dictionary with status information about the operation
    """
    
    logger.warning("Starting deletion of ALL Stripe customers")
    
    deleted_count = 0
    failed_count = 0
    error_messages = []
    
    try:
        # First get all customers from Stripe
        has_more = True
        starting_after = None
        batch_size = 10
        
        while has_more:
            # Fetch customers in batches
            params = {"limit": batch_size}
            if starting_after:
                params["starting_after"] = starting_after
                
            customers = await StripeAsync.customer_list(**params)

            tasks = []
            
            # Process each customer in the batch
            for customer in customers.data:
                # First cancel any active subscriptions
                subscriptions = await StripeAsync.subscription_list(customer=customer.id)
                for subscription in subscriptions.data:
                    if not dryrun:
                        tasks.append(StripeAsync.subscription_delete(subscription.id))
                        logger.info(f"Deleting subscription {subscription.id} for customer {customer.id}")
                    else:
                        logger.info(f"Would have deleted subscription {subscription.id} for customer {customer.id}")
            
            await asyncio.gather(*tasks)

            tasks = []
             # Process each customer in the batch
            for customer in customers.data:
                # Delete the customer
                if not dryrun:
                    tasks.append(StripeAsync.customer_delete(customer.id))
                    deleted_count += 1
                    logger.info(f"Deleted Stripe customer: {customer.id}")
                else:
                    logger.info(f"Would have deleted Stripe customer: {customer.id}")
               

            await asyncio.gather(*tasks)
            
            # Check if there are more customers to process
            has_more = customers.has_more
            if has_more and customers.data:
                starting_after = customers.data[-1].id
        
        # Now clean up our local database
        try:
            if not dryrun:
                # Delete all local records
                await stripe_customers.delete_many({"org_id": {"$exists": True}})
                logger.info("Deleted all local Stripe customer records")
            else:
                logger.info("Would have deleted all local Stripe customer records")
        except Exception as e:
            error_msg = f"Error cleaning up local database: {str(e)}"
            logger.error(error_msg)
            error_messages.append(error_msg)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "errors": error_messages,
            "warning": "All Stripe customers have been permanently deleted."
        }
        
    except Exception as e:
        logger.error(f"Error during bulk deletion: {e}")
        return {"success": False, "error": str(e)}

@payments_router.get("/plans/{org_id}")
async def get_subscription_plans(
    org_id: str = None,
    current_user: User = Depends(get_current_user)
) -> SubscriptionPlanResponse:
    """Get available subscription plans and user's current plan"""

    logger.info(f"Getting subscription plans for org_id: {org_id} user_id: {current_user.user_id}")

    # Is the current user an org admin? Or a system admin?
    if not await is_org_admin(org_id=org_id, user_id=current_user.user_id) and not await is_sys_admin(user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied, user {current_user.user_id} is not an org admin for org_id {org_id}, or a sys admin"
        )

    # Get the customer
    customer = await stripe_customers.find_one({"org_id": org_id})
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer not found for org_id: {org_id}")
    
    # Define the available plans with metered usage details
    plans = [
        SubscriptionPlan(
            plan_id="individual",
            name="Individual",
            price_id=TIER_CONFIG["individual"]["price_id"],
            price=TIER_CONFIG["individual"]["base_price"],
            included_usage=TIER_CONFIG["individual"]["included_usage"],
            overage_price=TIER_CONFIG["individual"]["overage_price"],
            features=[
                "Basic document processing"
            ]
        ),
        SubscriptionPlan(
            plan_id="team",
            name="Team",
            price_id=TIER_CONFIG["team"]["price_id"],
            price=TIER_CONFIG["team"]["base_price"],
            included_usage=TIER_CONFIG["team"]["included_usage"],
            overage_price=TIER_CONFIG["team"]["overage_price"],
            features=[
                "Advanced document processing"
            ]
        ),
        SubscriptionPlan(
            plan_id="enterprise",
            name="Enterprise",
            price_id=TIER_CONFIG["enterprise"]["price_id"],
            price=TIER_CONFIG["enterprise"]["base_price"],
            included_usage=TIER_CONFIG["enterprise"]["included_usage"],
            overage_price=TIER_CONFIG["enterprise"]["overage_price"],
            features=[
                "Custom document processing"
            ]
        )
    ]

    # Get the customer
    stripe_customer = await get_payments_customer(org_id)
    if not stripe_customer:
        raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {org_id}")

    has_payment_method = payment_method_exists(stripe_customer)

    # Get the subscription
    subscription = await get_subscription(stripe_customer.id)
    current_subscription_type = None
    subscription_status = None
    cancel_at_period_end = False
    current_period_end = None
    
    if not subscription:
        # No subscription found
        current_subscription_type = None
        subscription_status = "no_subscription"
    else:
        current_subscription_type = get_subscription_type(subscription)
        subscription_status = subscription.status
        
        # Check if subscription is set to cancel at period end
        cancel_at_period_end = subscription.get('cancel_at_period_end', False)
        current_period_end = subscription.get('current_period_end')
        
        # If subscription is active but set to cancel at period end, show as "cancelling"
        if subscription_status == 'active' and cancel_at_period_end:
            subscription_status = 'cancelling'
    
    return SubscriptionPlanResponse(
        plans=plans, 
        current_plan=current_subscription_type,
        has_payment_method=has_payment_method,
        subscription_status=subscription_status,
        cancel_at_period_end=cancel_at_period_end,
        current_period_end=current_period_end
    )

async def reactivate_subscription(customer_id: str) -> bool:
    """Reactivate a subscription that is set to cancel at period end"""
    
    if not stripe.api_key:
        logger.warning("Stripe API key not configured - reactivate_subscription aborted")
        return False

    try:
        # Get the current subscription
        subscription = await get_subscription(customer_id)
        if not subscription:
            logger.error(f"No subscription found for customer_id: {customer_id}")
            return False
        
        # Check if subscription is set to cancel at period end
        if not subscription.get('cancel_at_period_end', False):
            logger.info(f"Subscription for customer_id: {customer_id} is not set to cancel at period end")
            return True  # Already active
        
        # Reactivate the subscription by removing cancel_at_period_end
        await StripeAsync.subscription_modify(
            subscription.id,
            cancel_at_period_end=False
        )
        
        logger.info(f"Reactivated subscription {subscription.id} for customer_id: {customer_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error reactivating subscription: {e}")
        return False

@payments_router.post("/change-plan")
async def change_subscription_plan(
    data: ChangePlanRequest,
    current_user: User = Depends(get_current_user)
):
    """Change user's subscription plan"""
    logger.info(f"Changing subscription plan for org_id: {data.org_id} to plan_id: {data.plan_id}")

    # Is the current user an org admin? Or a system admin?
    if not await is_org_admin(org_id=data.org_id, user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Org admin access required for org_id: {data.org_id} user_id: {current_user.user_id}"
        )

    try:
        # Get the customer
        stripe_customer = await get_payments_customer(data.org_id)
        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {data.org_id}")

        # Get current subscription to check if it's cancelling
        subscription = await get_subscription(stripe_customer.id)
        is_reactivating = False
        
        if subscription and subscription.get('cancel_at_period_end', False):
            # If subscription is cancelling and user selects the same plan, reactivate it
            current_plan_type = get_subscription_type(subscription)
            if current_plan_type == data.plan_id:
                is_reactivating = True
                success = await reactivate_subscription(stripe_customer.id)
                if success:
                    return {"status": "success", "message": "Subscription reactivated successfully"}
                else:
                    raise HTTPException(status_code=500, detail="Failed to reactivate subscription")

        # Otherwise, proceed with normal plan change
        ret = await set_subscription_type(stripe_customer.id, data.plan_id)
        if not ret:
            raise HTTPException(status_code=500, detail=f"Failed to set subscription type for org_id: {data.org_id}")

        return {"status": "success", "message": "Subscription plan updated successfully"}

    except Exception as e:
        logger.error(f"Error changing subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.get("/subscription-history/{user_id}")
async def get_subscription_history(
    user_id: str,
):
    """Get subscription history for a user"""

    try:
        history = None # TODO: Get subscription history from Stripe
        
        return {
            "subscription_history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def sync_organization_subscription(org_id: str, organization_type: str) -> bool:
    """
    Sync organization type with subscription type in Stripe
    """
    if not stripe.api_key:
        logger.info(f"Stripe not configured - skipping subscription sync for org {org_id}")
        return True

    try:
        # Organization type is now the same as subscription type
        subscription_type = organization_type

        # Get the Stripe customer
        stripe_customer = await get_payments_customer(org_id)
        if not stripe_customer:
            logger.warning(f"No Stripe customer found for org {org_id}")
            return False

        # Set the subscription type in Stripe
        success = await set_subscription_type(stripe_customer.id, subscription_type)
        if success:
            logger.info(f"Synced org {org_id} type {organization_type} to subscription {subscription_type}")
        
        return success

    except Exception as e:
        logger.error(f"Error syncing organization subscription: {e}")
        return False

async def get_organization_subscription_status(org_id: str) -> dict:
    """
    Get the current subscription status for an organization
    """
    if not stripe.api_key:
        return {
            "stripe_enabled": False,
            "subscription_type": None,
            "has_payment_method": False,
            "status": "no_stripe"
        }

    try:
        stripe_customer = await get_payments_customer(org_id)
        if not stripe_customer:
            return {
                "stripe_enabled": True,
                "subscription_type": None,
                "has_payment_method": False,
                "status": "no_customer"
            }

        subscription = await get_subscription(stripe_customer.id)
        if not subscription:
            return {
                "stripe_enabled": True,
                "subscription_type": None,
                "has_payment_method": payment_method_exists(stripe_customer),
                "status": "no_subscription"
            }

        subscription_type = get_subscription_type(subscription)
        return {
            "stripe_enabled": True,
            "subscription_type": subscription_type,
            "has_payment_method": payment_method_exists(stripe_customer),
            "status": subscription.status
        }

    except Exception as e:
        logger.error(f"Error getting subscription status: {e}")
        return {
            "stripe_enabled": True,
            "subscription_type": None,
            "has_payment_method": False,
            "status": "error"
        }

@payments_router.get("/subscription-status/{org_id}")
async def get_subscription_status(
    org_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get subscription status for an organization"""
    
    # Check if user has access to this organization
    if not await is_org_admin(org_id=org_id, user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Org admin access required for org_id: {org_id}"
        )

    return await get_organization_subscription_status(org_id)

@payments_router.post("/reactivate-subscription")
async def reactivate_subscription_endpoint(
    data: PortalSessionCreate,
    current_user: User = Depends(get_current_user)
):
    """Reactivate a subscription that is set to cancel at period end"""
    
    logger.info(f"Reactivating subscription for org_id: {data.org_id}")

    # Is the current user an org admin? Or a system admin?
    if not await is_org_admin(org_id=data.org_id, user_id=current_user.user_id) and not await is_sys_admin(user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Org admin access required for org_id: {data.org_id}"
        )

    try:
        # Get the customer
        stripe_customer = await get_payments_customer(data.org_id)
        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {data.org_id}")

        success = await reactivate_subscription(stripe_customer.id)
        if success:
            return {"status": "success", "message": "Subscription reactivated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to reactivate subscription")

    except Exception as e:
        logger.error(f"Error reactivating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/cancel-subscription")
async def cancel_subscription_endpoint(
    data: PortalSessionCreate,
    current_user: User = Depends(get_current_user)
):
    """Cancel a subscription at the end of the current period"""
    
    logger.info(f"Cancelling subscription for org_id: {data.org_id}")

    # Is the current user an org admin? Or a system admin?
    if not await is_org_admin(org_id=data.org_id, user_id=current_user.user_id) and not await is_sys_admin(user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Org admin access required for org_id: {data.org_id}"
        )

    try:
        # Get the customer
        stripe_customer = await get_payments_customer(data.org_id)
        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {data.org_id}")

        # Get the current subscription
        subscription = await get_subscription(stripe_customer.id)
        if not subscription:
            raise HTTPException(status_code=404, detail=f"No active subscription found for org_id: {data.org_id}")

        # Cancel the subscription at period end
        await StripeAsync.subscription_modify(
            subscription.id,
            cancel_at_period_end=True
        )
        
        logger.info(f"Cancelled subscription {subscription.id} for customer_id: {stripe_customer.id}")
        return {"status": "success", "message": "Subscription cancelled successfully"}

    except Exception as e:
        logger.error(f"Error cancelling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_stripe_usage(org_id: str, start_time: Optional[int] = None, end_time: Optional[int] = None) -> Dict[str, Any]:
    """
    Get usage information from Stripe for a specified timeframe
    
    Args:
        org_id: Organization ID
        start_time: Unix timestamp for start of period (optional, defaults to current billing period start)
        end_time: Unix timestamp for end of period (optional, defaults to current billing period end)
    """
    
    if not stripe.api_key:
        return None
    
    try:
        stripe_customer = await get_payments_customer(org_id)
        if not stripe_customer:
            return None
            
        subscription = await get_subscription(stripe_customer.id)
        if not subscription or subscription.get("status") != "active":
            return None
            
        subscription_item = subscription["items"]["data"][0]
        subscription_item_id = subscription_item["id"]
        
        # Get current period boundaries
        current_period_start = subscription_item.get("current_period_start")
        current_period_end = subscription_item.get("current_period_end")

        # Convert to datetime
        current_period_start = datetime.fromtimestamp(current_period_start)
        current_period_end = datetime.fromtimestamp(current_period_end)

        logger.info(f"Current period start: {current_period_start.isoformat()}")
        logger.info(f"Current period end: {current_period_end.isoformat()}")
        
        # Use provided timeframe or default to current billing period
        period_start = start_time if start_time is not None else current_period_start
        period_end = end_time if end_time is not None else current_period_end
        
        # Get the meter ID from the subscription item's price
        subscription_type = get_subscription_type(subscription)
        
        # Get usage summary for the specified period using billing meter events
        usage_summary = await StripeAsync.billing_meter_event_summary_list(
            STRIPE_METER_ID,
            customer=stripe_customer.id,
            start_time=period_start,
            end_time=period_end
        )

        logger.info(f"Usage summary: {usage_summary}")
        
        # Extract total usage from the summary
        total_usage = 0
        if usage_summary and usage_summary.get("data"):
            for summary in usage_summary["data"]:
                total_usage += summary.get("aggregated_value", 0)
        
        # Get plan configuration
        plan_config = TIER_CONFIG.get(subscription_type, {})
        included_usage = plan_config.get("included_usage", 0)
        
        # For custom timeframes, we need to calculate prorated included usage
        if start_time is not None and end_time is not None:
            # Calculate what portion of the billing period this timeframe represents
            billing_period_duration = current_period_end - current_period_start
            timeframe_duration = end_time - start_time
            
            # Prorate the included usage based on the timeframe
            if billing_period_duration > 0:
                proration_factor = timeframe_duration / billing_period_duration
                included_usage = int(included_usage * proration_factor)
        
        return {
            "total_usage": total_usage,
            "included_usage": included_usage,
            "overage_usage": max(0, total_usage - included_usage),
            "remaining_included": max(0, included_usage - total_usage),
            "current_period_start": current_period_start,
            "current_period_end": current_period_end,
            "period_start": period_start,
            "period_end": period_end,
            "subscription_type": subscription_type,
            "usage_unit": "spu"
        }
        
    except Exception as e:
        logger.error(f"Error getting Stripe usage: {e}")
        return None

@payments_router.get("/usage/{org_id}")
async def get_current_usage(
    org_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current usage information for an organization"""
    
    # Check if user has access to this organization
    if not await is_org_admin(org_id=org_id, user_id=current_user.user_id) and not await is_sys_admin(user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Org admin access required for org_id: {org_id}"
        )

    try:
        # Get usage from Stripe
        stripe_usage = await get_stripe_usage(org_id)
        if not stripe_usage:
            raise HTTPException(status_code=404, detail=f"No Stripe usage found for org_id: {org_id}")

        logger.info(f"Stripe usage: {stripe_usage}")
        
        return {
            "usage_source": "stripe",
            "data": stripe_usage
        }
        
    except Exception as e:
        logger.error(f"Error getting usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))
