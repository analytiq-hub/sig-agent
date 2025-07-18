import os
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Body, BackgroundTasks
from pydantic import BaseModel, Field
import stripe
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId
import asyncio

import analytiq_data as ad

from docrouter_app.auth import (
    get_current_user,
    is_organization_admin,
    is_system_admin,
    is_organization_member
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
    async def meter_event_create(*args, **kwargs) -> Dict[str, Any]:
        """Create a meter event using the new Stripe metered billing system"""
        return await StripeAsync._run_in_threadpool(
            stripe.billing.MeterEvent.create,
            *args,
            **kwargs
        )

    @staticmethod
    async def subscription_item_list(*args, **kwargs) -> Dict[str, Any]:
        return await StripeAsync._run_in_threadpool(
            stripe.SubscriptionItem.list,
            *args,
            **kwargs
        )

# Configure logger
logger = logging.getLogger(__name__)

# Initialize FastAPI router
payments_router = APIRouter(prefix="/v0/payments", tags=["payments"])

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
stripe_usage_records = None
stripe_billing_periods = None

# Pydantic models for request/response validation
class UsageRecord(BaseModel):
    spus: int = Field(default=0)  # New field for SPU tracking
    operation: str
    source: str = "backend"

class PortalSessionResponse(BaseModel):
    url: str

class SubscriptionPlan(BaseModel):
    plan_id: str
    name: str
    base_price: float
    metered_price: float
    features: List[str]
    currency: str = "usd"
    interval: str = "month"

class SubscriptionResponse(BaseModel):
    plans: List[SubscriptionPlan]
    current_plan: Optional[str] = None
    has_payment_method: bool = False
    subscription_status: Optional[str] = None
    cancel_at_period_end: bool = False
    current_period_end: Optional[int] = None  # Unix timestamp

class UsageData(BaseModel):
    metered_usage: int
    remaining_included: int
    subscription_type: str
    usage_unit: str
    purchased_credits: int
    purchased_credits_used: int
    purchased_credits_remaining: int
    admin_credits: int
    admin_credits_used: int
    admin_credits_remaining: int
    period_start: Optional[int] = None  # Unix timestamp
    period_end: Optional[int] = None    # Unix timestamp

class UsageResponse(BaseModel):
    usage_source: str  # "stripe", "local", or "none"
    data: UsageData

class CreditUpdate(BaseModel):
    amount: int

class PurchaseCreditsRequest(BaseModel):
    credits: int = Field(ge=10, le=10000)  # Minimum 10, maximum 10000 credits
    success_url: str
    cancel_url: str

class PurchaseCreditsResponse(BaseModel):
    checkout_url: str
    session_id: str

class CheckoutSessionRequest(BaseModel):
    plan_id: str

# Replace the multiple packages with a single credit configuration
CREDIT_CONFIG = {
    "default_spu_credits": 100,
    "price_per_credit": 0.015,  # $0.015 per credit
    "currency": "usd",
    "min_cost": 5.0,  # Minimum purchase amount in USD
    "max_cost": 100.0,  # Maximum purchase amount in USD
}

# Add this new function to fetch pricing from Stripe
async def get_tier_config(org_id: str = None) -> Dict[str, Any]:
    """
    Fetch tier configuration dynamically from Stripe prices
    """
    if not stripe.api_key:
        logger.warning("Stripe API key not configured - using fallback tier config")
        return {}

    try:
        # Get all prices for our product
        prices = await StripeAsync._run_in_threadpool(
            stripe.Price.list,
            active=True,
            expand=['data.product']
        )
        
        dynamic_config = {}
        product_id = None  # Track the main product ID
        
        for tier in ["individual", "team", "enterprise"]:
            dynamic_config[tier] = {
                'base_price_id': None,
                'metered_price_id': None,
                'base_price': 0.0,
                'metered_price': 0.0,
            }
        
            for price in prices.data:
                metadata = price.metadata
                tier_list = metadata.get('tier', "").split(",")
                # Strip whitespace from each tier
                tier_list2 = [tier.strip() for tier in tier_list]
                if tier not in tier_list2:
                    continue
                
                price_type = metadata.get('price_type')
                
                if not price_type:
                    continue
                
                price_amount = price.unit_amount / 100  # Convert from cents
                
                if price_type == 'base':
                    # Only update if this is a lower price or if no price is set yet
                    if (dynamic_config[tier]['base_price'] == 0.0 or 
                        price_amount < dynamic_config[tier]['base_price']):
                        dynamic_config[tier]['base_price_id'] = price.id
                        dynamic_config[tier]['base_price'] = price_amount
                elif price_type == 'metered':
                    # Only update if this is a lower price or if no price is set yet
                    if (dynamic_config[tier]['metered_price'] == 0.0 or 
                        price_amount < dynamic_config[tier]['metered_price']):
                        dynamic_config[tier]['metered_price_id'] = price.id
                        dynamic_config[tier]['metered_price'] = price_amount
            
        # Get the main product ID from the first price
        if prices.data:
            product_id = prices.data[0].product.id
        
        dynamic_config['product_id'] = product_id
        return dynamic_config
        
    except Exception as e:
        logger.error(f"Error fetching dynamic tier config: {e}")
        logger.warning("Falling back to static tier config")
        return {}

# Modify the init_payments_env function
async def init_payments_env():
    global MONGO_URI, ENV
    global NEXTAUTH_URL
    global client, db
    global stripe_customers, stripe_events, stripe_usage_records, stripe_billing_periods
    global stripe_webhook_secret

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    ENV = os.getenv("ENV", "dev")
    NEXTAUTH_URL = os.getenv("NEXTAUTH_URL", "http://localhost:3000")

    client = AsyncIOMotorClient(MONGO_URI)
    db = client[ENV]

    stripe_customers = db.stripe_customers
    stripe_events = db.stripe_events
    stripe_usage_records = db.stripe_usage_records
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
async def init_payments():
    await init_payments_env()

    logger.info("Stripe initialized")

    await sync_all_customers()
    logger.info("Stripe customers synced")
    
    # Start background billing task
    asyncio.create_task(billing_background_task())
    logger.info("Background billing task started")

async def sync_all_customers() -> Tuple[int, int, List[str]]:
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
    user_description = f"{org_name} org admin"

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
            if stripe_customer.name != user_name or stripe_customer.email != user_email or stripe_customer.description != user_description:
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
                    description=user_description,
                    metadata=customer_metadata
                )
                logger.info(f"Updated Stripe customer {stripe_customer.id} email {user_email} user_name {user_name} metadata {customer_metadata}")
        else:
            # Create new customer in Stripe
            stripe_customer = await StripeAsync.customer_create(
                name=user_name,
                email=user_email,
                description=user_description,
                metadata=customer_metadata
            )
            logger.info(f"Created new Stripe customer {stripe_customer.id} email {user_email} user_name {user_name} metadata {customer_metadata}")
        
        # Don't automatically subscribe new customers - let them choose
        # Only sync subscription if they already have one
        org_type = org.get("type")
        existing_subscription = await get_subscription(stripe_customer.id)
        if existing_subscription:
            await set_subscription_type(org_id, stripe_customer.id, org_type)

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

        # Ensure credits are initialized for a stripe_customer
        await ensure_subscription_credits(customer)

        return customer
    
    except Exception as e:
        logger.error(f"Error in sync_payments_customer: {e}")
        raise e

async def save_usage_record(org_id: str, spus: int, operation: str, source: str = "backend") -> Dict[str, Any]:
    """Record usage for an organization locally"""
    
    logger.info(f"save_usage_record() called with org_id: {org_id}, spus: {spus}, operation: {operation}, source: {source}")

    # Store usage record (no Stripe dependencies)
    usage_record = {
        "org_id": org_id,
        "spus": spus,
        "operation": operation,
        "source": source,
        "timestamp": datetime.utcnow(),
        "reported_to_stripe": False
    }
    
    await stripe_usage_records.insert_one(usage_record)
    return usage_record

async def process_all_billing():
    """Process billing periods and create usage records in Stripe directly from usage records"""
    
    logger.info(f"Starting billing processing")
    
    if not stripe.api_key:
        logger.warning("Stripe API key not configured - billing processing aborted")
        return
    
    try:
        # Get all active subscriptions
        stripe_customers_list = await stripe_customers.find({"deleted": {"$ne": True}}).to_list(length=None)
        
        for customer in stripe_customers_list:
            org_id = customer["org_id"]
            try:
                await process_org_billing(org_id)
            except Exception as e:
                logger.error(f"Error processing billing for org {org_id}: {e}")
                continue
        
        logger.info("Billing period processing completed")
        
    except Exception as e:
        logger.error(f"Error in billing period processing: {e}")

async def process_org_billing(org_id: str): 
    """Process billing for a single organization"""

    if not stripe.api_key:
        logger.warning("Stripe API key not configured - billing processing aborted")
        return
    
    # Get customer and subscription
    stripe_customer = await get_payments_customer(org_id)
    if not stripe_customer:
        return
        
    subscription = await get_subscription(stripe_customer.id)
    if not subscription or subscription.get("status") != "active":
        return
    
    subscription_item = subscription["items"]["data"][1]  # Overage item
    subscription_item_id = subscription_item["id"]
    
    # Get current billing period boundaries
    current_period_start = datetime.fromtimestamp(subscription_item.get("current_period_start"))
    current_period_end = datetime.fromtimestamp(subscription_item.get("current_period_end"))
    
    # Aggregate unreported usage for this billing period
    usage_pipeline = [
        {
            "$match": {
                "org_id": org_id,
                "timestamp": {"$gte": current_period_start, "$lte": current_period_end},
                "reported_to_stripe": False
            }
        },
        {
            "$group": {
                "_id": None,
                "total_usage": {"$sum": "$spus"},
                "usage_count": {"$sum": 1}
            }
        }
    ]
    
    usage_result = await stripe_usage_records.aggregate(usage_pipeline).to_list(length=1)
    
    if not usage_result or usage_result[0]["total_usage"] == 0:
        logger.info(f"No unreported usage found for org {org_id} in period {current_period_start} to {current_period_end}")
        return
    
    total_usage = usage_result[0]["total_usage"]
    usage_count = usage_result[0]["usage_count"]
    
    logger.info(f"Processing {total_usage} SPUs from {usage_count} usage records for org {org_id}")
    
    try:
        # Report usage to Stripe using the new metered billing system
        await StripeAsync.meter_event_create(
            event_name="docrouterspu",
            payload={
                "stripe_customer_id": stripe_customer.id,
                "value": total_usage
            },
            timestamp=int(datetime.now().timestamp())
        )
        
        # Mark usage records as reported
        await stripe_usage_records.update_many(
            {
                "org_id": org_id,
                "timestamp": {"$gte": current_period_start, "$lte": current_period_end},
                "reported_to_stripe": False
            },
            {"$set": {"reported_to_stripe": True, "reported_at": datetime.utcnow()}}
        )
        
        logger.info(f"Successfully reported {total_usage} SPUs to Stripe for org {org_id}")
        
    except Exception as e:
        logger.error(f"Error reporting usage to Stripe for org {org_id}: {e}")
        raise

async def check_subscription_limits(org_id: str) -> Dict[str, Any]:
    """Check if organization has hit usage limits and needs to upgrade"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    logger.info(f"Checking usage limits for org_id: {org_id}")

    customer = await stripe_customers.find_one({"org_id": org_id})
    if not customer:
        raise ValueError(f"No customer found for org_id: {org_id}")
    
    # Ensure credits are initialized
    await ensure_subscription_credits(customer)
    
    # Get separate credit information
    purchased_credits = customer.get("purchased_credits", 0)
    purchased_used = customer.get("purchased_credits_used", 0)
    purchased_remaining = max(purchased_credits - purchased_used, 0)
    
    admin_credits = customer.get("admin_credits", CREDIT_CONFIG["default_spu_credits"])
    admin_used = customer.get("admin_credits_used", 0)
    admin_remaining = max(admin_credits - admin_used, 0)
    
    # Total credits
    total_credits = purchased_credits + admin_credits
    total_used = purchased_used + admin_used
    total_remaining = purchased_remaining + admin_remaining
    
    # Check if they have an active subscription
    stripe_customer = await get_payments_customer(org_id)
    subscription = None
    if stripe_customer:
        subscription = await get_subscription(stripe_customer.id)
    
    has_active_subscription = subscription and subscription.get("status") == "active"
    has_payment_method = stripe_customer and payment_method_exists(stripe_customer) if stripe_customer else False
    
    # If they have credits remaining, they can continue
    if total_remaining > 0:
        return {
            "limit_reached": False,
            "current_usage": total_used,
            "credits_remaining": total_remaining,
            "needs_upgrade": False,
            "can_use_credits": True
        }
    
    # If they have an active subscription with payment method, they can continue
    if has_active_subscription and has_payment_method:
        return {
            "limit_reached": False,
            "current_usage": total_used,
            "credits_remaining": 0,
            "needs_upgrade": False,
            "can_use_credits": False
        }
    
    # No credits and no active subscription - they need to upgrade
    return {
        "limit_reached": True,
        "current_usage": total_used,
        "credits_remaining": 0,
        "needs_upgrade": True,
        "can_use_credits": False
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
    """Get the subscription type from subscription metadata"""
    # First try to get from metadata
    subscription_type = subscription.get("metadata", {}).get("subscription_type")
    if subscription_type:
        return subscription_type


async def set_subscription_type(org_id: str, customer_id: str, subscription_type: str):
    """Enable a subscription for a customer with proper proration"""

    tier_config = await get_tier_config(org_id)
    
    if subscription_type not in tier_config.keys():
        raise ValueError(f"Invalid subscription type: {subscription_type}")

    base_price_id = tier_config[subscription_type]["base_price_id"]
    metered_price_id = tier_config[subscription_type]["metered_price_id"]

    # Get the current subscription
    subscription = await get_subscription(customer_id)
    
    if subscription:
        update_subscription = False
        subscription_items = subscription.get("items", {}).get("data", [])
        
        # Check if we need to update the subscription
        current_subscription_type = get_subscription_type(subscription)
        if current_subscription_type != subscription_type:
            update_subscription = True
        
        # Check if the subscription items match the expected configuration
        if len(subscription_items) != 2:
            update_subscription = True
        else:
            current_base_price_id = subscription_items[0].get("price", {}).get("id")
            current_metered_price_id = subscription_items[1].get("price", {}).get("id")

            if current_base_price_id != base_price_id or current_metered_price_id != metered_price_id:
                update_subscription = True

        if update_subscription:
            logger.info(f"Updating subscription to {subscription_type} base_price_id {base_price_id} metered_price_id {metered_price_id}")

            # Build the items array for subscription modification
            items = []
            
            # If we have existing subscription items, we need to update them by ID
            if len(subscription_items) >= 1:
                # Update the first item (base price)
                items.append({
                    'id': subscription_items[0]['id'],
                    'price': base_price_id,
                })
                
                # If we have a second item, update it (metered price)
                if len(subscription_items) >= 2:
                    items.append({
                        'id': subscription_items[1]['id'],
                        'price': metered_price_id,
                    })
                else:
                    # Add the metered price item
                    items.append({
                        'price': metered_price_id,
                    })
            else:
                # No existing items, add both new items
                items = [
                    {'price': base_price_id},
                    {'price': metered_price_id},
                ]

            # Modify existing subscription with proration and metadata
            await StripeAsync.subscription_modify(
                subscription.id,
                items=items,
                proration_behavior='create_prorations',  # This handles the proration
                metadata={'subscription_type': subscription_type}  # Add metadata
            )
    else:
        # Create new subscription for customers without one
        await StripeAsync.subscription_create(
            customer=customer_id,
            items=[{'price': base_price_id}, {'price': metered_price_id}],
            payment_behavior='default_incomplete',
            expand=['latest_invoice.payment_intent'],
            metadata={'subscription_type': subscription_type}  # Add metadata
        )

    return True

@payments_router.post("/{organization_id}/customer-portal")
async def customer_portal(
    organization_id: str,
    current_user: User = Depends(get_current_user)
) -> PortalSessionResponse:
    """Generate a Stripe Customer Portal link"""

    logger.info(f"Generating Stripe customer portal for org_id: {organization_id}")

    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_member = await is_organization_member(organization_id, current_user.user_id)

    if not is_sys_admin and not is_org_member:
        raise HTTPException(status_code=403, detail="You are not authorized to generate a customer portal")

    try:
        customer = await stripe_customers.find_one({"org_id": organization_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        logger.info(f"Stripe customer found for org_id: {organization_id}: {customer['stripe_customer_id']}")
        session = await StripeAsync.billing_portal_session_create(
            customer=customer["stripe_customer_id"],
            return_url=f"{NEXTAUTH_URL}/settings/organizations/{organization_id}/subscription",
        )
        logger.info(f"Stripe customer portal URL: {session.url}")
        return PortalSessionResponse(url=session.url)
    except Exception as e:
        logger.error(f"Error generating Stripe customer portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/{organization_id}/checkout-session")
async def create_checkout_session(
    organization_id: str,
    request: CheckoutSessionRequest,
    current_user: User = Depends(get_current_user)
) -> PortalSessionResponse:
    """Create a Stripe Checkout session for subscription setup"""

    plan_id = request.plan_id
    logger.info(f"Creating Stripe checkout session for org_id: {organization_id}, plan: {plan_id}")

    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_member = await is_organization_member(organization_id, current_user.user_id)

    if not is_sys_admin and not is_org_member:
        raise HTTPException(status_code=403, detail="You are not authorized to create a checkout session")

    try:
        # Get the customer
        customer = await stripe_customers.find_one({"org_id": organization_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get tier configuration
        tier_config = await get_tier_config(organization_id)
        if plan_id not in tier_config:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_id}")
        
        # Get price IDs for the plan
        base_price_id = tier_config[plan_id]["base_price_id"]
        metered_price_id = tier_config[plan_id]["metered_price_id"]
        
        if not base_price_id or not metered_price_id:
            raise HTTPException(status_code=500, detail=f"Price configuration not found for plan: {plan_id}")
        
        # Create checkout session
        session = await StripeAsync._run_in_threadpool(
            stripe.checkout.Session.create,
            customer=customer["stripe_customer_id"],
            payment_method_types=['card'],
            line_items=[
                {
                    'price': base_price_id,
                    'quantity': 1,
                },
                {
                    'price': metered_price_id,
                    # Remove quantity for metered usage
                }
            ],
            mode='subscription',
            success_url=f"{NEXTAUTH_URL}/settings/organizations/{organization_id}/subscription?success=true",
            cancel_url=f"{NEXTAUTH_URL}/settings/organizations/{organization_id}/subscription?canceled=true",
            metadata={
                'org_id': organization_id,
                'plan_id': plan_id,
                'user_id': current_user.user_id
            },
            subscription_data={
                'metadata': {
                    'subscription_type': plan_id,
                    'org_id': organization_id
                }
            }
        )
        
        logger.info(f"Created Stripe checkout session: {session.id}, URL: {session.url}")
        return PortalSessionResponse(url=session.url)
        
    except Exception as e:
        logger.error(f"Error creating Stripe checkout session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/{organization_id}/usage")
async def record_usage(
    organization_id: str,
    usage: UsageRecord,
    current_user: User = Depends(get_current_user)
):
    """Record usage for an organization"""

    logger.info(f"api_record_usage called with org_id: {organization_id}, spus: {usage.spus}, operation: {usage.operation}, source: {usage.source}")

    # Check if the current user is a member of the organization
    if not await is_organization_member(org_id=organization_id, user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied, user {current_user.user_id} is not a member of organization {organization_id}"
        )

    try:
        result = await record_subscription_usage(
            organization_id,
            usage.spus,
        )
        limits = await check_subscription_limits(organization_id)
        return {"success": True, "usage": result, "limits": limits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions for webhook handlers
async def handle_subscription_updated(subscription: Dict[str, Any]):
    """Handle subscription created or updated event"""
    logger.info(f"Handling subscription updated event for subscription_id {subscription['id']}: no-op")

async def handle_subscription_deleted(subscription: Dict[str, Any]):
    """Handle subscription deleted event"""
    logger.info(f"Handling subscription deleted event for subscription_id: {subscription['id']}: no-op")

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

@payments_router.get("/{organization_id}/subscription")
async def get_subscription_info(
    organization_id: str = None,
    current_user: User = Depends(get_current_user)
) -> SubscriptionResponse:
    """Get available subscription plans and user's current plan"""

    logger.info(f"Getting subscription plans for org_id: {organization_id} user_id: {current_user.user_id}")

    # Is the current user an org admin? Or a system admin?
    if not await is_organization_admin(org_id=organization_id, user_id=current_user.user_id) and not await is_system_admin(user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied, user {current_user.user_id} is not an org admin for org_id {organization_id}, or a sys admin"
        )

    # Get the customer
    customer = await stripe_customers.find_one({"org_id": organization_id})
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer not found for org_id: {organization_id}")
    
    tier_config = await get_tier_config(organization_id)
    
    # Define the available plans with metered usage details
    plans = [
        SubscriptionPlan(
            plan_id="individual",
            name="Individual",
            base_price=tier_config["individual"]["base_price"],
            metered_price=tier_config["individual"]["metered_price"],
            features=[
                "Basic document processing"
            ]
        ),
        SubscriptionPlan(
            plan_id="team",
            name="Team",
            base_price=tier_config["team"]["base_price"],
            metered_price=tier_config["team"]["metered_price"],
            features=[
                "Advanced document processing"
            ]
        ),
        SubscriptionPlan(
            plan_id="enterprise",
            name="Enterprise",
            base_price=tier_config["enterprise"]["base_price"],
            metered_price=tier_config["enterprise"]["metered_price"],
            features=[
                "Custom document processing"
            ]
        )
    ]

    # Get the customer
    stripe_customer = await get_payments_customer(organization_id)

    if not stripe_customer:
        raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {organization_id}")

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
        # Only return subscription type if customer has a payment method
        if has_payment_method:
            current_subscription_type = get_subscription_type(subscription)
        else:
            current_subscription_type = None
            
        subscription_status = subscription.status
        
        # Check if subscription is set to cancel at period end
        cancel_at_period_end = subscription.get('cancel_at_period_end', False)
        current_period_end = subscription.get('current_period_end')
        
        # If subscription is active but set to cancel at period end, show as "cancelling"
        if subscription_status == 'active' and cancel_at_period_end:
            subscription_status = 'cancelling'
    
    return SubscriptionResponse(
        plans=plans, 
        current_plan=current_subscription_type,
        has_payment_method=has_payment_method,
        subscription_status=subscription_status,
        cancel_at_period_end=cancel_at_period_end,
        current_period_end=current_period_end
    )

async def handle_activate_subscription(org_id: str, org_type: str, customer_id: str) -> bool:
    """Activate a subscription"""
    
    if not stripe.api_key:
        logger.warning("Stripe API key not configured - handle_activate_subscription aborted")
        return False

    try:
        # Get the current subscription
        subscription = await get_subscription(customer_id)
        if subscription:       
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

        else:
            # Sync the subscription type with the organization type
            await sync_subscription(org_id, org_type)
            
            logger.info(f"Created new subscription for customer_id: {customer_id}")

        return True
        
    except Exception as e:
        logger.error(f"Error reactivating subscription: {e}")
        return False

async def sync_subscription(org_id: str, org_type: str) -> bool:
    """
    Sync organization type with subscription type in Stripe
    """
    if not stripe.api_key:
        logger.info(f"Stripe not configured - skipping subscription sync for org {org_id}")
        return True

    try:
        # Organization type is now the same as subscription type
        subscription_type = org_type

        # Get the Stripe customer
        stripe_customer = await get_payments_customer(org_id)
        if not stripe_customer:
            logger.warning(f"No Stripe customer found for org {org_id}")
            return False

        # Set the subscription type in Stripe (this will now include metadata)
        success = await set_subscription_type(org_id, stripe_customer.id, subscription_type)
        if success:
            logger.info(f"Synced org {org_id} type {org_type} to subscription {subscription_type}")
        
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

        # Only return subscription type if customer has a payment method
        has_payment_method = payment_method_exists(stripe_customer)
        if has_payment_method:
            subscription_type = get_subscription_type(subscription)
        else:
            subscription_type = None
            
        return {
            "stripe_enabled": True,
            "subscription_type": subscription_type,
            "has_payment_method": has_payment_method,
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

@payments_router.put("/{organization_id}/subscription")
async def activate_subscription(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Activate a subscription"""
    
    logger.info(f"Reactivating subscription for org_id: {organization_id}")

    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_admin = await is_organization_admin(org_id=organization_id, user_id=current_user.user_id)

    if not is_sys_admin and not is_org_admin:
        raise HTTPException(status_code=403, detail="You are not authorized to reactivate a subscription")

    org = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization not found: {organization_id}")

    org_type = org.get("type", "individual")

    try:
        # Get the customer
        stripe_customer = await get_payments_customer(organization_id)
        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {organization_id}")

        success = await handle_activate_subscription(organization_id, org_type, stripe_customer.id)
        if success:
            return {"status": "success", "message": "Subscription reactivated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to reactivate subscription")

    except Exception as e:
        logger.error(f"Error reactivating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.delete("/{organization_id}/subscription")
async def deactivate_subscription(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel a subscription at the end of the current period"""
    
    logger.info(f"Cancelling subscription for org_id: {organization_id}")

    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_admin = await is_organization_admin(org_id=organization_id, user_id=current_user.user_id)

    if not is_sys_admin and not is_org_admin:
        raise HTTPException(status_code=403, detail="You are not authorized to cancel a subscription")

    try:
        # Get the customer
        stripe_customer = await get_payments_customer(organization_id)
        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {organization_id}")

        # Get the current subscription
        subscription = await get_subscription(stripe_customer.id)
        if not subscription:
            raise HTTPException(status_code=404, detail=f"No active subscription found for org_id: {organization_id}")

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
    Get usage information from local database for a specified timeframe
    
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
        
        # Get current period boundaries
        current_period_start = subscription_item.get("current_period_start")
        current_period_end = subscription_item.get("current_period_end")

        # Convert to datetime
        current_period_start = datetime.fromtimestamp(current_period_start)
        current_period_end = datetime.fromtimestamp(current_period_end)

        logger.info(f"Current period start: {current_period_start.isoformat()}")
        logger.info(f"Current period end: {current_period_end.isoformat()}")
        
        # Use provided timeframe or default to current billing period
        period_start = datetime.fromtimestamp(start_time) if start_time is not None else current_period_start
        period_end = datetime.fromtimestamp(end_time) if end_time is not None else current_period_end
        
        subscription_type = get_subscription_type(subscription)
        
        # Get usage from local database for the current subscription only
        # If subscription changed mid-period, only show usage for the latest subscription
        usage_pipeline = [
            {
                "$match": {
                    "org_id": org_id,
                    "operation": "paid_usage",
                    "timestamp": {
                            "$gte": datetime.fromtimestamp(period_start),
                            "$lte": datetime.fromtimestamp(period_end)
                        }
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$spus"}}}
            ]
        
        usage_result = await stripe_usage_records.aggregate(usage_pipeline).to_list(length=1)
        total_usage = usage_result[0]["total_usage"] if usage_result else 0
        
        return {
            "total_usage": total_usage,
            "metered_usage": total_usage,  # All usage is metered
            "period_start": int(period_start.timestamp()),
            "period_end": int(period_end.timestamp()),
            "subscription_type": subscription_type,
            "usage_unit": "spu"
        }
        
    except Exception as e:
        logger.error(f"Error getting Stripe usage: {e}")
        return None

@payments_router.get("/{organization_id}/usage")
async def get_current_usage(
    organization_id: str,
    current_user: User = Depends(get_current_user)
) -> UsageResponse:
    # Check if user has access to this organization
    if not await is_organization_admin(org_id=organization_id, user_id=current_user.user_id) and not await is_system_admin(user_id=current_user.user_id):
        raise HTTPException(
            status_code=403,
            detail=f"Org admin access required for org_id: {organization_id}"
        )

    try:
        stripe_customer = await stripe_customers.find_one({"org_id": organization_id})
        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"No stripe_customer found for org_id: {organization_id}")
        
        await ensure_subscription_credits(stripe_customer)
        
        # Get separate credit information
        purchased_credits = stripe_customer.get("purchased_credits", 0)
        purchased_used = stripe_customer.get("purchased_credits_used", 0)
        purchased_remaining = max(purchased_credits - purchased_used, 0)
        
        admin_credits = stripe_customer.get("admin_credits", CREDIT_CONFIG["default_spu_credits"])
        admin_used = stripe_customer.get("admin_credits_used", 0)
        admin_remaining = max(admin_credits - admin_used, 0)
        
        # --- NEW: Get period_start and period_end from Stripe subscription ---
        period_start = None
        period_end = None
        subscription_type = "individual"
        usage_unit = "spu"
        try:
            stripe_api_customer = await get_payments_customer(organization_id)
            if stripe_api_customer:
                subscription = await get_subscription(stripe_api_customer.id)
                if subscription:
                    # Use the first subscription item for period boundaries
                    if subscription["items"]["data"]:
                        item = subscription["items"]["data"][0]
                        period_start = item.get("current_period_start")
                        period_end = item.get("current_period_end")
                    # Get subscription type if available
                    subscription_type = get_subscription_type(subscription) or subscription_type
        except Exception as e:
            logger.warning(f"Could not fetch subscription period: {e}")

        # --- Only count paid usage for the current period ---
        metered_usage = 0
        if period_start and period_end:
            agg = await stripe_usage_records.aggregate([
                {
                    "$match": {
                        "org_id": organization_id,
                        "operation": "paid_usage",
                        "timestamp": {
                            "$gte": datetime.fromtimestamp(period_start),
                            "$lte": datetime.fromtimestamp(period_end)
                        }
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$spus"}}}
            ]).to_list(1)
            if agg and agg[0].get("total"):
                metered_usage = agg[0]["total"]
        else:
            # fallback: all paid usage (should be rare)
            agg = await stripe_usage_records.aggregate([
                {"$match": {"org_id": organization_id, "operation": "paid_usage"}},
                {"$group": {"_id": None, "total": {"$sum": "$spus"}}}
            ]).to_list(1)
            if agg and agg[0].get("total"):
                metered_usage = agg[0]["total"]

        return UsageResponse(
            usage_source="stripe",
            data=UsageData(
                metered_usage=metered_usage,
                remaining_included=0,
                subscription_type=subscription_type,
                usage_unit=usage_unit,
                purchased_credits=purchased_credits,
                purchased_credits_used=purchased_used,
                purchased_credits_remaining=purchased_remaining,
                admin_credits=admin_credits,
                admin_credits_used=admin_used,
                admin_credits_remaining=admin_remaining,
                period_start=period_start,
                period_end=period_end,
            )
        )
        
    except Exception as e:
        logger.error(f"Error getting usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def billing_background_task():
    """Background task that runs billing processing every hour"""
    while True:
        try:
            await process_all_billing()
        except Exception as e:
            logger.error(f"Error in background billing task: {e}")
        
        # Sleep for 1 hour
        await asyncio.sleep(3600)  # 3600 seconds = 1 hour

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
    elif event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        # Check if this is a subscription checkout or credit purchase
        if session.get("mode") == "subscription":
            await handle_checkout_session_completed(session)
        else:
            # Handle credit purchase
            await credit_customer_account_from_session(session)
    
    # Mark event as processed
    await stripe_events.update_one(
        {"stripe_event_id": event["id"]},
        {"$set": {"processed": True, "processed_at": datetime.utcnow()}}
    )
    
    return {"status": "success"}

# Ensure credits are initialized for a stripe_customer
async def ensure_subscription_credits(stripe_customer_doc):
    update = {}
    # Add new fields for separate tracking
    if "purchased_credits" not in stripe_customer_doc:
        update["purchased_credits"] = 0
    if "purchased_credits_used" not in stripe_customer_doc:
        update["purchased_credits_used"] = 0
    if "admin_credits" not in stripe_customer_doc:
        update["admin_credits"] = CREDIT_CONFIG["default_spu_credits"]
    if "admin_credits_used" not in stripe_customer_doc:
        update["admin_credits_used"] = 0
    if update:
        await stripe_customers.update_one(
            {"_id": stripe_customer_doc["_id"]},
            {"$set": update}
        )

async def record_subscription_usage(org_id: str, spus: int):
    stripe_customer = await stripe_customers.find_one({"org_id": org_id})
    if not stripe_customer:
        raise Exception("No stripe_customer for org")
    await ensure_subscription_credits(stripe_customer)
    
    # Get available credits
    purchased_credits = stripe_customer.get("purchased_credits", 0)
    purchased_used = stripe_customer.get("purchased_credits_used", 0)
    purchased_remaining = max(purchased_credits - purchased_used, 0)
    
    admin_credits = stripe_customer.get("admin_credits", CREDIT_CONFIG["default_spu_credits"])
    admin_used = stripe_customer.get("admin_credits_used", 0)
    admin_remaining = max(admin_credits - admin_used, 0)
    
    # Consume purchased credits first, then admin credits
    from_purchased = min(spus, purchased_remaining)
    from_admin = min(spus - from_purchased, admin_remaining)
    from_paid = spus - from_purchased - from_admin

    # Update credit usage
    if from_purchased > 0:
        await stripe_customers.update_one(
            {"_id": stripe_customer["_id"]},
            {"$inc": {"purchased_credits_used": from_purchased}}
        )
    
    if from_admin > 0:
        await stripe_customers.update_one(
            {"_id": stripe_customer["_id"]},
            {"$inc": {"admin_credits_used": from_admin}}
        )
    
    # Record paid usage for the remainder
    if from_paid > 0:
        await save_usage_record(org_id, from_paid, operation="paid_usage", source="backend")
    
    return {
        "from_purchased": from_purchased, 
        "from_admin": from_admin, 
        "from_paid": from_paid
    }

# Admin API to add credits
@payments_router.post("/{organization_id}/credits/add")
async def add_spu_credits(
    organization_id: str,
    update: CreditUpdate,
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Adding {update.amount} admin credits to org {organization_id}")

    if not await is_system_admin(current_user.user_id):
        raise HTTPException(status_code=403, detail="Admin only")
    stripe_customer = await stripe_customers.find_one({"org_id": organization_id})
    if not stripe_customer:
        raise HTTPException(status_code=404, detail="No stripe_customer for org")
    await ensure_subscription_credits(stripe_customer)
    await stripe_customers.update_one(
        {"_id": stripe_customer["_id"]},
        {"$inc": {"admin_credits": update.amount}}
    )
    return {"success": True, "added": update.amount}

@payments_router.get("/{organization_id}/credits/config")
async def get_credit_config(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get credit purchase configuration"""
    if not await is_organization_member(org_id=organization_id, user_id=current_user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "price_per_credit": CREDIT_CONFIG["price_per_credit"],
        "currency": CREDIT_CONFIG["currency"],
        "min_cost": CREDIT_CONFIG["min_cost"],
        "max_cost": CREDIT_CONFIG["max_cost"]
    }

@payments_router.post("/{organization_id}/credits/purchase")
async def purchase_credits(
    organization_id: str,
    request: PurchaseCreditsRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe checkout session for credit purchase with dynamic pricing"""
    
    logger.info(f"purchase_credits called for org_id: {organization_id}, credits: {request.credits}")
    
    if not await is_organization_member(org_id=organization_id, user_id=current_user.user_id):
        logger.error(f"Access denied for user {current_user.user_id} to org {organization_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate total cost for the requested credits
    total_cost = request.credits * CREDIT_CONFIG["price_per_credit"]
    
    # Validate cost limits instead of credit limits
    if total_cost < CREDIT_CONFIG["min_cost"]:
        logger.error(f"Purchase cost too low: ${total_cost:.2f} (minimum: ${CREDIT_CONFIG['min_cost']})")
        raise HTTPException(
            status_code=400, 
            detail=f"Purchase amount must be at least ${CREDIT_CONFIG['min_cost']} (you requested ${total_cost:.2f})"
        )
    
    if total_cost > CREDIT_CONFIG["max_cost"]:
        logger.error(f"Purchase cost too high: ${total_cost:.2f} (maximum: ${CREDIT_CONFIG['max_cost']})")
        raise HTTPException(
            status_code=400, 
            detail=f"Purchase amount cannot exceed ${CREDIT_CONFIG['max_cost']} (you requested ${total_cost:.2f})"
        )
    
    # Get or create Stripe customer
    stripe_customer = await get_payments_customer(organization_id)
    if not stripe_customer:
        logger.info(f"No existing Stripe customer for org {organization_id}, creating one")
        await sync_payments_customer(organization_id)
        stripe_customer = await get_payments_customer(organization_id)
    
    if not stripe_customer:
        logger.error(f"Failed to create Stripe customer for org {organization_id}")
        raise HTTPException(status_code=500, detail="Failed to create Stripe customer")
    
    logger.info(f"Using Stripe customer: {stripe_customer.id}")
    
    try:
        # Calculate total amount in dollars
        total_amount_usd = request.credits * CREDIT_CONFIG["price_per_credit"]
        amount_cents = int(total_amount_usd * 100)
        
        logger.info(f"Calculated amount: ${total_amount_usd} ({amount_cents} cents)")

        # Create Stripe checkout session with dynamic pricing
        # Use product_data instead of product to create a new product on-the-fly
        session = await StripeAsync._run_in_threadpool(
            stripe.checkout.Session.create,
            customer=stripe_customer.id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': CREDIT_CONFIG["currency"],
                    'unit_amount': amount_cents,
                    'product_data': {
                        'name': f'{request.credits} SPU Credits',
                        'description': f'Purchase {request.credits} SPU credits (${total_amount_usd:.2f})',
                        'metadata': {
                            'type': 'spu_credits',
                            'credits': str(request.credits)
                        }
                    }
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata={
                'org_id': organization_id,
                'credits': str(request.credits),
                'user_id': current_user.user_id,
                'spu_amount': str(request.credits),
                'customer_id': organization_id
            }
        )
        
        logger.info(f"Created Stripe checkout session: {session.id}, URL: {session.url}")
        
        return PurchaseCreditsResponse(
            checkout_url=session.url,
            session_id=session.id
        )
        
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

async def credit_customer_account_from_session(session: Dict[str, Any]):
    """Credit customer account after successful Checkout session"""
    
    try:
        metadata = session.get("metadata", {})
        org_id = metadata.get("org_id")
        credits = int(metadata.get("credits", 0))
        
        if not org_id or not credits:
            logger.error(f"Missing metadata in checkout session: {session['id']}")
            return
        
        # Add credits to the organization
        stripe_customer = await stripe_customers.find_one({"org_id": org_id})
        if not stripe_customer:
            logger.error(f"No stripe customer found for org: {org_id}")
            return
        
        await ensure_subscription_credits(stripe_customer)
        await stripe_customers.update_one(
            {"_id": stripe_customer["_id"]},
            {"$inc": {"purchased_credits": credits}}
        )
        
        logger.info(f"Credited {credits} purchased SPUs to organization {org_id} from checkout session {session['id']}")
        
    except Exception as e:
        logger.error(f"Error processing checkout session completion: {e}")
        logger.error(f"Error processing checkout session completion: {e}")

# Update the webhook handler to handle checkout.session.completed for subscriptions
async def handle_checkout_session_completed(session: Dict[str, Any]):
    """Handle checkout session completed event"""
    try:
        metadata = session.get("metadata", {})
        org_id = metadata.get("org_id")
        plan_id = metadata.get("plan_id")
        
        if not org_id or not plan_id:
            logger.error(f"Missing metadata in checkout session: {session['id']}")
            return
        
        # The subscription should already be created by Stripe
        # We just need to ensure our local state is updated
        logger.info(f"Checkout session completed for org {org_id}, plan {plan_id}")
        
        # Refresh the customer data to ensure we have the latest subscription info
        await sync_payments_customer(org_id)
        
    except Exception as e:
        logger.error(f"Error processing checkout session completion: {e}")