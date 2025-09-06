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
    get_org_admin_user,
    get_admin_or_org_user,
    is_organization_admin,
    is_system_admin,
    is_organization_member
)
from docrouter_app.models import User

import asyncio
import stripe
from functools import partial
from typing import Any, Dict, List, Optional

def format_price_per_spu(price: float) -> str:
    """
    Format price per SPU to show only necessary decimal places.
    Shows 3 decimals only if the third decimal is non-zero, otherwise shows 2 decimals.
    """
    # Round to 3 decimal places first to handle floating point precision issues
    rounded_price = round(price, 3)
    
    # Check if the third decimal place is significant
    if rounded_price * 1000 == int(rounded_price * 1000):
        # No significant third decimal, use 2 decimal places
        return f"{rounded_price:.2f}"
    else:
        # Third decimal is significant, use 3 decimal places
        return f"{rounded_price:.3f}"

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
    included_spus: int  # Monthly SPU allowance
    features: List[str]
    currency: str = "usd"
    interval: str = "month"

class SubscriptionResponse(BaseModel):
    plans: List[SubscriptionPlan]
    current_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    cancel_at_period_end: bool = False
    current_period_end: Optional[int] = None  # Unix timestamp

class UsageData(BaseModel):
    subscription_type: Optional[str]
    usage_unit: str
    period_metered_usage: int
    total_metered_usage: int
    remaining_included: int
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

# Dynamic configuration - populated from Stripe at startup
CREDIT_CONFIG = {}

# SPU limits per tier - populated from Stripe metadata at startup
TIER_LIMITS = {
    "enterprise": None     # No limit (custom billing, not in Stripe)
}

async def get_tier_limits() -> Dict[str, Any]:
    """
    Fetch tier limits dynamically from Stripe base price metadata
    """
    global TIER_LIMITS
    
    if not stripe.api_key:
        raise ValueError("Stripe API key not configured - cannot fetch tier limits")
    
    # Get all active prices for our product
    prices = await StripeAsync._run_in_threadpool(
        stripe.Price.list,
        active=True,
        expand=['data.product']
    )
    
    # Start with enterprise (not in Stripe)
    tier_limits = {"enterprise": None}
    
    # Find base prices and extract limits from metadata
    for price in prices.data:
        metadata = price.metadata
        price_type = metadata.get('price_type')
        
        if price_type == 'base':
            tier = metadata.get('tier', '').strip()
            if tier in ['individual', 'team']:
                included_spus = metadata.get('included_spus')
                if not included_spus:
                    raise ValueError(f"Missing included_spus metadata for {tier} base price {price.id}")
                tier_limits[tier] = int(included_spus)
                logger.info(f"Loaded {tier} SPU limit from Stripe: {included_spus}")
    
    # Ensure we found both individual and team limits
    if 'individual' not in tier_limits or 'team' not in tier_limits:
        missing = [t for t in ['individual', 'team'] if t not in tier_limits]
        raise ValueError(f"Missing base prices in Stripe for tiers: {missing}")
    
    # Update global limits
    TIER_LIMITS = tier_limits
    return tier_limits

async def load_credit_config() -> Dict[str, Any]:
    """
    Fetch credit configuration dynamically from Stripe credit prices
    """
    global CREDIT_CONFIG
    
    if not stripe.api_key:
        raise ValueError("Stripe API key not configured - cannot fetch credit config")
    
    # Get all active prices for our product
    prices = await StripeAsync._run_in_threadpool(
        stripe.Price.list,
        active=True,
        expand=['data.product']
    )
    
    credit_config = None
    
    # Find credit prices
    for price in prices.data:
        metadata = price.metadata
        price_type = metadata.get('price_type')
        
        if price_type == 'credit':
            # Validate price has unit_amount
            if price.unit_amount is None:
                raise ValueError(f"Credit price {price.id} has no unit_amount set in Stripe")
                
            # Build config from Stripe price and metadata
            # Stripe unit_amount is in the smallest currency unit (cents for USD)
            # Account for transform_quantity.divide_by if present
            transform_divide_by = price.get('transform_quantity', {}).get('divide_by', 1)
            price_per_credit = (price.unit_amount / 100) / transform_divide_by
            
            # Get required metadata
            min_spu_purchase = metadata.get('min_spu_purchase')
            max_spu_purchase = metadata.get('max_spu_purchase')
            spu_credit = metadata.get('spu_credit')
            
            # Log found price for debugging
            logger.info(f"Found credit price {price.id}: unit_amount={price.unit_amount}, currency={price.currency}")
            logger.info(f"Credit price metadata: {dict(metadata)}")
            
            if not min_spu_purchase:
                raise ValueError(f"Missing min_spu_purchase metadata for credit price {price.id}")
            if not max_spu_purchase:
                raise ValueError(f"Missing max_spu_purchase metadata for credit price {price.id}")
            if not spu_credit:
                raise ValueError(f"Missing spu_credit metadata for credit price {price.id}")
            
            credit_config = {
                'price_per_credit': price_per_credit,
                'currency': price.currency,
                'min_spu_purchase': int(min_spu_purchase),
                'max_spu_purchase': int(max_spu_purchase),
                'min_cost': int(min_spu_purchase) * price_per_credit,
                'max_cost': int(max_spu_purchase) * price_per_credit,
                'spu_credit': int(spu_credit)
            }
            
            logger.info(f"Loaded credit config from Stripe: price=${price_per_credit:.3f}, min={min_spu_purchase}, max={max_spu_purchase}")
            break
    
    if not credit_config:
        raise ValueError("No credit price found in Stripe with price_type=credit")
    
    # Update global config
    CREDIT_CONFIG = credit_config
    return credit_config

# Function to fetch base pricing from Stripe
async def get_tier_config(org_id: str = None) -> Dict[str, Any]:
    """
    Fetch tier configuration dynamically from Stripe prices (base pricing only)
    """
    if not stripe.api_key:
        raise ValueError("Stripe API key not configured - cannot fetch tier config")

    # Get all active prices for our product
    prices = await StripeAsync._run_in_threadpool(
        stripe.Price.list,
        active=True,
        expand=['data.product']
    )
    
    dynamic_config = {
        "enterprise": {"base_price_id": None, "base_price": 0.0, "included_spus": None}
    }
    
    # Find base prices for each tier
    for price in prices.data:
        metadata = price.metadata
        price_type = metadata.get('price_type')
        
        if price_type != 'base':
            continue
            
        tier = metadata.get('tier', '').strip()
        if tier in ['individual', 'team']:
            included_spus = metadata.get('included_spus')
            if not included_spus:
                raise ValueError(f"Missing included_spus metadata for {tier} base price {price.id}")
                
            dynamic_config[tier] = {
                'base_price_id': price.id,
                'base_price': price.unit_amount / 100,
                'included_spus': int(included_spus)
            }
            logger.info(f"Loaded {tier} tier config from Stripe: ${price.unit_amount / 100}, {included_spus} SPUs")
    
    # Ensure we found both individual and team tiers
    if 'individual' not in dynamic_config or 'team' not in dynamic_config:
        missing = [t for t in ['individual', 'team'] if t not in dynamic_config]
        raise ValueError(f"Missing base prices in Stripe for tiers: {missing}")
    
    return dynamic_config

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

    if stripe.api_key:
        ad.payments.set_check_subscription_limits_hook(check_subscription_limits)
        ad.payments.set_record_subscription_usage_hook(record_subscription_usage)
        
        # Initialize dynamic configuration from Stripe
        await load_credit_config()
        await get_tier_limits()
        logger.info("Dynamic pricing configuration and limits loaded from Stripe")

    await sync_all_customers()
    logger.info("Stripe customers synced")

async def sync_all_customers() -> Tuple[int, int, List[str]]:
    """
    Differential sync: only sync organizations that don't have Stripe customers yet.
    
    Returns:
        Tuple containing (total_orgs, successful_syncs, error_messages)
    """
    if not stripe.api_key:
        # No-op if Stripe is not configured
        logger.warning("Stripe API key not configured - sync_all_payments_customers aborted")
        return 0, 0, ["Stripe API key not configured"]

    logger.info("Starting differential sync of customers with Stripe")
    
    try:
        # Get all organizations from MongoDB
        orgs = await db["organizations"].find().to_list(length=None)
        total_orgs = len(orgs)
        local_org_ids = set(str(org["_id"]) for org in orgs)
        
        # Get all Stripe customers with org_id metadata
        stripe_org_ids, stripe_customer_map = await _get_stripe_customer_org_ids()
        
        # Find organizations that need syncing (missing from Stripe)
        missing_from_stripe = local_org_ids - stripe_org_ids
        orphaned_in_stripe = stripe_org_ids - local_org_ids
        
        logger.info(f"Total orgs: {total_orgs}, Stripe customers: {len(stripe_org_ids)}, Need sync: {len(missing_from_stripe)}, Orphaned: {len(orphaned_in_stripe)}")
        
        # Clean up orphaned Stripe customers if any exist
        if orphaned_in_stripe:
            logger.info(f"Found {len(orphaned_in_stripe)} orphaned Stripe customers - cleaning up")
            await _cleanup_orphaned_stripe_customers(orphaned_in_stripe, stripe_customer_map)
        
        if not missing_from_stripe:
            logger.info("All organizations already synced with Stripe")
            return total_orgs, 0, []
        
        # Sync only the missing organizations
        return await _sync_org_ids(missing_from_stripe)
    
    except Exception as e:
        logger.error(f"Error during differential customer sync: {e}")
        return 0, 0, [f"Global error: {str(e)}"]

async def _get_stripe_customer_org_ids() -> Tuple[set, Dict[str, str]]:
    """Get all org_ids from Stripe customers metadata and return mapping to customer_ids"""
    try:
        org_ids = set()
        customer_map = {}  # org_id -> stripe_customer_id
        has_more = True
        starting_after = None
        
        while has_more:
            params = {"limit": 100}
            if starting_after:
                params["starting_after"] = starting_after
                
            customers = await StripeAsync.customer_list(**params)
            
            for customer in customers.data:
                org_id = customer.metadata.get("org_id")
                if org_id:
                    org_ids.add(org_id)
                    customer_map[org_id] = customer.id
            
            has_more = customers.has_more
            if has_more and customers.data:
                starting_after = customers.data[-1].id
        
        return org_ids, customer_map
    
    except Exception as e:
        logger.error(f"Error getting Stripe customer org_ids: {e}")
        return set(), {}

async def _cleanup_orphaned_stripe_customers(orphaned_org_ids: set, stripe_customer_map: Dict[str, str]) -> Tuple[int, List[str]]:
    """Delete orphaned Stripe customers that don't have corresponding organizations"""
    deleted_count = 0
    errors = []
    
    logger.info(f"Starting cleanup of {len(orphaned_org_ids)} orphaned Stripe customers")
    
    for org_id in orphaned_org_ids:
        stripe_customer_id = stripe_customer_map.get(org_id)
        if not stripe_customer_id:
            continue
            
        try:
            # Check if customer has any active subscriptions
            subscriptions = await StripeAsync.subscription_list(customer=stripe_customer_id, status="active")
            
            if subscriptions.data:
                logger.warning(f"Skipping deletion of customer {stripe_customer_id} (org_id: {org_id}) - has active subscriptions")
                continue
            
            # Delete the customer from Stripe
            await StripeAsync.customer_delete(stripe_customer_id)
            
            # Also clean up from local stripe_customers collection
            await stripe_customers.delete_one({"org_id": org_id})
            
            deleted_count += 1
            logger.info(f"Deleted orphaned Stripe customer {stripe_customer_id} (org_id: {org_id})")
            
        except Exception as e:
            error_msg = f"Error deleting orphaned customer {stripe_customer_id} (org_id: {org_id}): {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
    
    logger.info(f"Cleanup completed: {deleted_count} orphaned customers deleted")
    return deleted_count, errors

async def _sync_org_ids(org_ids_to_sync: set) -> Tuple[int, int, List[str]]:
    """Sync only the specified organization IDs"""
    successful = 0
    errors = []
    
    # Process in batches of 10
    org_ids_list = list(org_ids_to_sync)
    batch_size = 10
    
    for i in range(0, len(org_ids_list), batch_size):
        batch = org_ids_list[i:i + batch_size]
        
        # Create tasks for each org in the batch
        tasks = []
        for org_id in batch:
            task = sync_payments_customer(org_id=org_id)
            tasks.append(task)
        
        # Execute batch in parallel
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for idx, result in enumerate(results):
                if isinstance(result, Exception):
                    error_msg = f"Error syncing customer for org {batch[idx]}: {str(result)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                elif result:
                    successful += 1
                else:
                    errors.append(f"Failed to create/get customer for org {batch[idx]}")
        
        except Exception as e:
            error_msg = f"Error processing sync batch: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
        
        logger.info(f"Processed batch {i//batch_size + 1}/{(len(org_ids_list) + batch_size - 1)//batch_size}")
    
    logger.info(f"Differential sync completed: {successful}/{len(org_ids_list)} customers synchronized")
    return len(org_ids_list), successful, errors

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

    logger.info(f"Syncing payments customer for org_id: {org_id}")

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
            # Update local billing period and subscription data
            await sync_local_subscription_data(org_id, stripe_customer.id, existing_subscription)

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
        "timestamp": datetime.utcnow()
    }
    
    await stripe_usage_records.insert_one(usage_record)
    return usage_record



async def check_subscription_limits(org_id: str, spus: int) -> bool:
    """Check if organization has hit usage limits using local data only (no Stripe API calls)"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return True

    logger.info(f"Checking subscription limits for org_id: {org_id} spus: {spus}")

    customer = await stripe_customers.find_one({"org_id": org_id})
    if not customer:
        raise ValueError(f"No customer found for org_id: {org_id}")

    await ensure_subscription_credits(customer)

    # Get all subscription and credit data from local customer document (NO Stripe API calls)
    subscription_type = customer.get("subscription_type")
    subscription_spu_allowance = customer.get("subscription_spu_allowance", 0)
    subscription_spus_used = customer.get("subscription_spus_used", 0)
    
    # Calculate subscription SPUs remaining
    subscription_spus_remaining = 0
    if subscription_spu_allowance:
        subscription_spus_remaining = max(subscription_spu_allowance - subscription_spus_used, 0)
    
    # Get credit information
    purchased_credits = customer.get("purchased_credits", 0)
    purchased_used = customer.get("purchased_credits_used", 0)
    purchased_remaining = max(purchased_credits - purchased_used, 0)
    
    admin_credits = customer.get("admin_credits", CREDIT_CONFIG["spu_credit"])
    admin_used = customer.get("admin_credits_used", 0)
    admin_remaining = max(admin_credits - admin_used, 0)
    
    # Calculate total available SPUs (subscription + credits)
    total_available = subscription_spus_remaining + purchased_remaining + admin_remaining
    
    # Enterprise plans allow overage - always return True
    if subscription_type == "enterprise":
        logger.info(f"Enterprise plan allows overage for org_id: {org_id}")
        return True
    
    # Individual and team plans block usage when credits are exhausted
    if total_available >= spus:
        logger.info(f"Sufficient credits available for org_id: {org_id} (available: {total_available}, requested: {spus})")
        return True
    else:
        logger.warning(f"Insufficient credits for org_id: {org_id} (available: {total_available}, requested: {spus})")
        return False

async def sync_local_subscription_data(org_id: str, stripe_customer_id: str, subscription: Dict[str, Any]):
    """Sync subscription billing period and details to local stripe_customer document"""
    try:
        if not subscription or subscription.get("status") != "active":
            return
            
        # Get subscription details
        subscription_type = get_subscription_type(subscription)
        
        # Get billing period from subscription items
        subscription_items = subscription.get("items", {}).get("data", [])
        if not subscription_items:
            return
            
        subscription_item = subscription_items[0]
        current_period_start = subscription_item.get("current_period_start")
        current_period_end = subscription_item.get("current_period_end")
        
        if not current_period_start or not current_period_end:
            return
            
        # Get subscription SPU allowance
        subscription_spu_allowance = 0
        if subscription_type in TIER_LIMITS:
            subscription_spu_allowance = TIER_LIMITS[subscription_type]
        
        # Update local customer document with subscription data
        update_data = {
            "subscription_type": subscription_type,
            "subscription_status": subscription.get("status"),
            "subscription_id": subscription.get("id"),
            "subscription_item_id": subscription_item.get("id"),
            "current_billing_period_start": current_period_start,
            "current_billing_period_end": current_period_end,
            "subscription_spu_allowance": subscription_spu_allowance,
            "subscription_updated_at": datetime.utcnow()
        }
        
        await stripe_customers.update_one(
            {"org_id": org_id},
            {"$set": update_data}
        )
        
        logger.info(f"Synced local subscription data for org {org_id}: {subscription_type} plan, period {current_period_start}-{current_period_end}")
        
    except Exception as e:
        logger.error(f"Error syncing local subscription data for org {org_id}: {e}")

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



async def is_enterprise_customer(org_id: str) -> bool:
    """Check if an organization is an enterprise customer"""
    org = await db["organizations"].find_one({"_id": ObjectId(org_id)})
    if not org:
        return False
    return org.get("type") == "enterprise"

async def get_current_billing_period() -> tuple:
    """Get current month billing period boundaries as unix timestamps"""
    now = datetime.utcnow()
    period_start = datetime(now.year, now.month, 1)
    
    # Next month start
    if now.month == 12:
        period_end = datetime(now.year + 1, 1, 1)
    else:
        period_end = datetime(now.year, now.month + 1, 1)
    
    return int(period_start.timestamp()), int(period_end.timestamp())

async def get_billing_period_for_customer(org_id: str) -> tuple:
    """Get billing period boundaries from local customer data (no Stripe API calls)"""
    # Get local customer data
    stripe_customer = await stripe_customers.find_one({"org_id": org_id})
    if not stripe_customer:
        return None, None
    
    # Check if we have local billing period data
    period_start = stripe_customer.get("current_billing_period_start")
    period_end = stripe_customer.get("current_billing_period_end")
    subscription_type = stripe_customer.get("subscription_type")
    
    if period_start and period_end:
        return period_start, period_end
    
    # If no local billing period but customer has subscription type, we may need to sync
    if subscription_type:
        # For enterprise, use calendar month
        is_enterprise = await is_enterprise_customer(org_id)
        if is_enterprise:
            return await get_current_billing_period()
    
    # No active subscription or billing period
    return None, None

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

    # Skip enterprise - they don't use Stripe
    if subscription_type == "enterprise":
        logger.info(f"Skipping Stripe subscription for enterprise org {org_id}")
        return True

    base_price_id = tier_config[subscription_type]["base_price_id"]
    
    if not base_price_id:
        raise ValueError(f"No base price configured for subscription type: {subscription_type}")

    # Get the current subscription
    subscription = await get_subscription(customer_id)
    
    if subscription:
        update_subscription = False
        subscription_items = subscription.get("items", {}).get("data", [])
        
        # Check if we need to update the subscription
        current_subscription_type = get_subscription_type(subscription)
        if current_subscription_type != subscription_type:
            update_subscription = True
        
        # Check if the subscription has the correct base price (should have only 1 item now)
        if len(subscription_items) != 1:
            update_subscription = True
        else:
            current_base_price_id = subscription_items[0].get("price", {}).get("id")
            if current_base_price_id != base_price_id:
                update_subscription = True

        if update_subscription:
            logger.info(f"Updating subscription to {subscription_type} base_price_id {base_price_id}")

            # Update subscription to use only base pricing
            items = [{'price': base_price_id}]
            
            # If we have existing subscription items, update by ID to avoid creating new items
            if subscription_items:
                items = [{'id': subscription_items[0]['id'], 'price': base_price_id}]

            # Modify existing subscription with proration and metadata
            await StripeAsync.subscription_modify(
                subscription.id,
                items=items,
                proration_behavior='create_prorations',
                metadata={'subscription_type': subscription_type}
            )
    else:
        # Create new subscription for customers without one (base pricing only)
        await StripeAsync.subscription_create(
            customer=customer_id,
            items=[{'price': base_price_id}],
            payment_behavior='default_incomplete',
            expand=['latest_invoice.payment_intent'],
            metadata={'subscription_type': subscription_type}
        )

    return True

@payments_router.post("/{organization_id}/customer-portal")
async def customer_portal(
    organization_id: str,
    current_user: User = Depends(get_current_user)
) -> PortalSessionResponse:
    """Generate a customer portal link (Stripe for non-enterprise, contact page for enterprise)"""

    logger.info(f"Generating customer portal for org_id: {organization_id}")

    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_member = await is_organization_member(organization_id, current_user.user_id)

    if not is_sys_admin and not is_org_member:
        raise HTTPException(status_code=403, detail="You are not authorized to generate a customer portal")

    # Check if this is an enterprise customer
    is_enterprise = await is_enterprise_customer(organization_id)
    
    if is_enterprise:
        # Enterprise customers don't use Stripe portal - redirect to enterprise billing contact
        enterprise_portal_url = f"{NEXTAUTH_URL}/enterprise-billing?org_id={organization_id}"
        return PortalSessionResponse(url=enterprise_portal_url)

    try:
        # Get Stripe customer for non-enterprise customers
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
        logger.error(f"Error generating customer portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/{organization_id}/checkout-session")
async def create_checkout_session(
    organization_id: str,
    request: CheckoutSessionRequest,
    current_user: User = Depends(get_admin_or_org_user)
) -> PortalSessionResponse:
    """Create a Stripe Checkout session for subscription setup"""

    plan_id = request.plan_id
    logger.info(f"Creating checkout session for org_id: {organization_id}, plan: {plan_id}")

    # Check if user is trying to select Enterprise plan without admin privileges
    if plan_id == 'enterprise':
        is_sys_admin = await is_system_admin(current_user.user_id)
        
        if not is_sys_admin:
            raise HTTPException(
                status_code=403, 
                detail="Enterprise plan requires admin privileges"
            )
        
        # Enterprise plans don't use Stripe - handle locally
        try:
            # Update organization type to enterprise
            from docrouter_app.models import UpdateOrganizationRequest
            await db.organizations.update_one(
                {"_id": ObjectId(organization_id)},
                {"$set": {"type": "enterprise"}}
            )
            
            logger.info(f"Updated organization {organization_id} to enterprise plan")
            
            # Return success URL to redirect back to subscription page
            success_url = f"{NEXTAUTH_URL}/settings/organizations/{organization_id}/subscription?success=true"
            return PortalSessionResponse(url=success_url)
            
        except Exception as e:
            logger.error(f"Error updating organization to enterprise: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update organization: {str(e)}")

    try:
        is_org_admin = await is_organization_admin(organization_id, current_user.user_id)

        if not is_org_admin:
            raise HTTPException(status_code=403, detail="You are not authorized to create a checkout session")

        # Get the customer
        customer = await stripe_customers.find_one({"org_id": organization_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get tier configuration
        tier_config = await get_tier_config(organization_id)
        if plan_id not in tier_config:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_id}")
        
        # Get price ID for the plan (base pricing only)
        base_price_id = tier_config[plan_id]["base_price_id"]
        
        if not base_price_id:
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
        logger.error(f"Error creating checkout session: {e}")
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
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions for webhook handlers
async def handle_subscription_updated(subscription: Dict[str, Any]):
    """Handle subscription created or updated event"""
    logger.info(f"Handling subscription updated event for subscription_id {subscription['id']}")
    
    try:
        # Get org_id from subscription metadata or customer metadata
        customer_id = subscription.get("customer")
        if not customer_id:
            logger.error(f"No customer_id found in subscription {subscription['id']}")
            return
            
        # Find our local customer record
        stripe_customer = await stripe_customers.find_one({"stripe_customer_id": customer_id})
        if not stripe_customer:
            logger.error(f"No local customer found for Stripe customer {customer_id}")
            return
            
        org_id = stripe_customer.get("org_id")
        if not org_id:
            logger.error(f"No org_id found for Stripe customer {customer_id}")
            return
        
        # Sync the subscription data locally
        await sync_local_subscription_data(org_id, customer_id, subscription)
        logger.info(f"Synced subscription data for org {org_id} from webhook")
        
    except Exception as e:
        logger.error(f"Error handling subscription updated webhook: {e}")

async def handle_subscription_deleted(subscription: Dict[str, Any]):
    """Handle subscription deleted event"""
    logger.info(f"Handling subscription deleted event for subscription_id: {subscription['id']}")
    
    try:
        # Get org_id from subscription metadata or customer metadata
        customer_id = subscription.get("customer")
        if not customer_id:
            logger.error(f"No customer_id found in subscription {subscription['id']}")
            return
            
        # Find our local customer record
        stripe_customer = await stripe_customers.find_one({"stripe_customer_id": customer_id})
        if not stripe_customer:
            logger.error(f"No local customer found for Stripe customer {customer_id}")
            return
            
        org_id = stripe_customer.get("org_id")
        if not org_id:
            logger.error(f"No org_id found for Stripe customer {customer_id}")
            return
        
        # Clear subscription data from local customer record
        update_data = {
            "subscription_type": None,
            "subscription_status": "canceled",
            "subscription_id": None,
            "subscription_item_id": None,
            "current_billing_period_start": None,
            "current_billing_period_end": None,
            "subscription_spu_allowance": 0,
            "subscription_updated_at": datetime.utcnow()
        }
        
        await stripe_customers.update_one(
            {"org_id": org_id},
            {"$set": update_data}
        )
        
        logger.info(f"Cleared subscription data for org {org_id} from webhook")
        
    except Exception as e:
        logger.error(f"Error handling subscription deleted webhook: {e}")

async def sync_existing_customers_billing_data() -> Dict[str, Any]:
    """One-time function to sync billing period data for existing customers"""
    logger.info("Starting sync of billing period data for existing customers")
    
    total_customers = 0
    synced_customers = 0
    errors = []
    
    try:
        # Get all customers that don't have local billing period data
        customers = await stripe_customers.find({
            "$or": [
                {"current_billing_period_start": {"$exists": False}},
                {"current_billing_period_start": None},
                {"subscription_type": {"$exists": False}}
            ]
        }).to_list(length=None)
        
        total_customers = len(customers)
        logger.info(f"Found {total_customers} customers needing billing data sync")
        
        for customer in customers:
            try:
                org_id = customer.get("org_id")
                stripe_customer_id = customer.get("stripe_customer_id")
                
                if not org_id or not stripe_customer_id:
                    continue
                
                # Check if this customer has an active subscription in Stripe
                subscription = await get_subscription(stripe_customer_id)
                if subscription and subscription.get("status") == "active":
                    # Sync the subscription data
                    await sync_local_subscription_data(org_id, stripe_customer_id, subscription)
                    synced_customers += 1
                    logger.info(f"Synced billing data for org {org_id}")
                else:
                    # No active subscription - ensure fields are properly set
                    await stripe_customers.update_one(
                        {"_id": customer["_id"]},
                        {"$set": {
                            "subscription_type": None,
                            "current_billing_period_start": None,
                            "current_billing_period_end": None,
                            "subscription_spu_allowance": 0
                        }}
                    )
                    logger.info(f"Cleared subscription data for org {org_id} (no active subscription)")
                
            except Exception as e:
                error_msg = f"Error syncing customer {customer.get('org_id', 'unknown')}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        logger.info(f"Billing data sync completed: {synced_customers}/{total_customers} customers synced")
        
        return {
            "success": True,
            "total_customers": total_customers,
            "synced_customers": synced_customers,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error during billing data sync: {e}")
        return {"success": False, "error": str(e)}

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
    current_user: User = Depends(get_admin_or_org_user)
) -> SubscriptionResponse:
    """Get available subscription plans and user's current plan"""

    logger.info(f"Getting subscription plans for org_id: {organization_id} user_id: {current_user.user_id}")

    # Get the customer
    customer = await stripe_customers.find_one({"org_id": organization_id})
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer not found for org_id: {organization_id}")
    
    tier_config = await get_tier_config(organization_id)
    
    # Define the available plans with SPU allowances
    plans = [
        SubscriptionPlan(
            plan_id="individual",
            name="Individual",
            base_price=tier_config["individual"]["base_price"],
            included_spus=tier_config["individual"]["included_spus"],
            features=[
                f"${format_price_per_spu(tier_config['individual']['base_price'] / tier_config['individual']['included_spus'])} per SPU",
                f"{tier_config['individual']['included_spus']:,} SPUs per month",
                "Basic document processing",
                f"Additional SPUs at ${CREDIT_CONFIG['price_per_credit']:.2f} each"
            ]
        ),
        SubscriptionPlan(
            plan_id="team",
            name="Team", 
            base_price=tier_config["team"]["base_price"],
            included_spus=tier_config["team"]["included_spus"],
            features=[
                f"${format_price_per_spu(tier_config['team']['base_price'] / tier_config['team']['included_spus'])} per SPU",
                f"{tier_config['team']['included_spus']:,} SPUs per month",
                "Advanced document processing",
                "Team collaboration features",
                f"Additional SPUs at ${CREDIT_CONFIG['price_per_credit']:.2f} each"
            ]
        )
    ]
    
    # Add enterprise plan for all users (access control handled by frontend)
    plans.append(SubscriptionPlan(
        plan_id="enterprise",
        name="Enterprise",
        base_price=0.0,  # Custom pricing
        included_spus=0,  # Unlimited
        features=[
            "Custom document processing",
            "Dedicated support",
            "Custom pricing - contact sales"
        ]
    ))

    # Check if this is an enterprise customer
    is_enterprise = await is_enterprise_customer(organization_id)
    
    if is_enterprise:
        # Enterprise customers have local subscriptions, not Stripe subscriptions
        current_subscription_type = "enterprise"
        subscription_status = "active"  # Enterprise is always active
        cancel_at_period_end = False
        current_period_end = None
    else:
        # Get the Stripe customer and subscription for non-enterprise customers
        stripe_customer = await get_payments_customer(organization_id)

        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {organization_id}")

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
    
    return SubscriptionResponse(
        plans=plans, 
        current_plan=current_subscription_type,
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
            "status": "no_stripe"
        }

    try:
        stripe_customer = await get_payments_customer(org_id)
        if not stripe_customer:
            return {
                "stripe_enabled": True,
                "subscription_type": None,
                "status": "no_customer"
            }

        subscription = await get_subscription(stripe_customer.id)
        if not subscription:
            return {
                "stripe_enabled": True,
                "subscription_type": None,
                "status": "no_subscription"
            }

        # Only return subscription type if customer has a payment method
        subscription_type = get_subscription_type(subscription)
            
        return {
            "stripe_enabled": True,
            "subscription_type": subscription_type,
            "status": subscription.status
        }

    except Exception as e:
        logger.error(f"Error getting subscription status: {e}")
        return {
            "stripe_enabled": True,
            "subscription_type": None,
            "status": "error"
        }

@payments_router.put("/{organization_id}/subscription")
async def activate_subscription(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Activate a subscription"""
    
    logger.info(f"Activating subscription for org_id: {organization_id}")

    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_admin = await is_organization_admin(org_id=organization_id, user_id=current_user.user_id)

    if not is_sys_admin and not is_org_admin:
        raise HTTPException(status_code=403, detail="You are not authorized to activate a subscription")

    org = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization not found: {organization_id}")

    org_type = org.get("type", "individual")

    # Check if this is an enterprise customer
    is_enterprise = await is_enterprise_customer(organization_id)
    
    if is_enterprise:
        # Enterprise subscriptions are always active - no action needed
        return {"status": "success", "message": "Enterprise subscription is always active"}

    try:
        # Get the customer for non-enterprise plans
        stripe_customer = await get_payments_customer(organization_id)
        if not stripe_customer:
            raise HTTPException(status_code=404, detail=f"Stripe customer not found for org_id: {organization_id}")

        success = await handle_activate_subscription(organization_id, org_type, stripe_customer.id)
        if success:
            return {"status": "success", "message": "Subscription activated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to activate subscription")

    except Exception as e:
        logger.error(f"Error activating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.delete("/{organization_id}/subscription")
async def deactivate_subscription(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel a subscription at the end of the current period"""
    
    logger.info(f"Deactivating subscription for org_id: {organization_id}")

    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_admin = await is_organization_admin(org_id=organization_id, user_id=current_user.user_id)

    if not is_sys_admin and not is_org_admin:
        raise HTTPException(status_code=403, detail="You are not authorized to cancel a subscription")

    # Check if this is an enterprise customer
    is_enterprise = await is_enterprise_customer(organization_id)
    
    if is_enterprise:
        # Enterprise subscriptions cannot be cancelled via API - contact sales
        raise HTTPException(
            status_code=400, 
            detail="Enterprise subscriptions must be cancelled by contacting sales"
        )

    try:
        # Get the customer for non-enterprise plans
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
        
        # Get subscription information
        period_start = None
        period_end = None
        subscription_type = None  # Default to None (no active plan)
        usage_unit = "spu"
        subscription_spu_allowance = 0
        subscription_spus_used = 0
        subscription_spus_remaining = 0
        
        # Get billing period boundaries (works for both enterprise and non-enterprise)
        period_start, period_end = await get_billing_period_for_customer(organization_id)
        
        # Check if this is an enterprise customer
        is_enterprise = await is_enterprise_customer(organization_id)
        
        if is_enterprise:
            subscription_type = "enterprise"
            subscription_spu_allowance = None  # Unlimited
        else:
            # Get subscription info from local customer data (NO Stripe API calls)
            subscription_type = stripe_customer.get("subscription_type")
            subscription_spu_allowance = stripe_customer.get("subscription_spu_allowance", 0)

        # Get subscription SPU usage from customer record
        subscription_spus_used = stripe_customer.get("subscription_spus_used", 0)
        
        # Calculate remaining SPUs (only for non-enterprise plans)
        if subscription_spu_allowance is not None:
            subscription_spus_remaining = max(subscription_spu_allowance - subscription_spus_used, 0)
        else:
            subscription_spus_remaining = 0  # Enterprise has unlimited
        
        # Get separate credit information
        purchased_credits = stripe_customer.get("purchased_credits", 0)
        purchased_used = stripe_customer.get("purchased_credits_used", 0)
        purchased_remaining = max(purchased_credits - purchased_used, 0)
        
        admin_credits = stripe_customer.get("admin_credits", CREDIT_CONFIG["spu_credit"])
        admin_used = stripe_customer.get("admin_credits_used", 0)
        admin_remaining = max(admin_credits - admin_used, 0)

        # --- Calculate both period and total metered usage ---
        period_metered_usage = 0
        total_metered_usage = 0
        
        # Period metered usage (paid usage for current billing period)
        if period_start and period_end:
            period_agg = await stripe_usage_records.aggregate([
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
            if period_agg and period_agg[0].get("total"):
                period_metered_usage = period_agg[0]["total"]
        
        # Total metered usage (all paid usage ever)
        total_agg = await stripe_usage_records.aggregate([
            {"$match": {"org_id": organization_id, "operation": "paid_usage"}},
            {"$group": {"_id": None, "total": {"$sum": "$spus"}}}
        ]).to_list(1)
        if total_agg and total_agg[0].get("total"):
            total_metered_usage = total_agg[0]["total"]

        return UsageResponse(
            usage_source="stripe",
            data=UsageData(
                period_metered_usage=period_metered_usage,
                total_metered_usage=total_metered_usage,
                remaining_included=subscription_spus_remaining,  # Now shows subscription SPU remaining
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
        update["admin_credits"] = CREDIT_CONFIG["spu_credit"]
    if "admin_credits_used" not in stripe_customer_doc:
        update["admin_credits_used"] = 0
    
    # Add subscription SPU tracking fields
    if "subscription_spus_used" not in stripe_customer_doc:
        update["subscription_spus_used"] = 0
    if "current_billing_period_start" not in stripe_customer_doc:
        update["current_billing_period_start"] = None
    if "current_billing_period_end" not in stripe_customer_doc:
        update["current_billing_period_end"] = None
    
    if update:
        await stripe_customers.update_one(
            {"_id": stripe_customer_doc["_id"]},
            {"$set": update}
        )

async def record_subscription_usage(org_id: str, spus: int):
    """Record subscription usage for an organization using local billing period data"""
    logger.info(f"Recording subscription usage for org_id: {org_id} spus: {spus}")

    stripe_customer = await stripe_customers.find_one({"org_id": org_id})
    if not stripe_customer:
        raise Exception("No stripe_customer for org")
    await ensure_subscription_credits(stripe_customer)
    
    # Get subscription information from local customer document (no Stripe API calls needed)
    is_enterprise = await is_enterprise_customer(org_id)
    subscription_type = stripe_customer.get("subscription_type")
    subscription_spu_allowance = stripe_customer.get("subscription_spu_allowance", 0)
    current_period_start = stripe_customer.get("current_billing_period_start")
    current_period_end = stripe_customer.get("current_billing_period_end")
    
    # For enterprise customers, use calendar month if not already set
    if is_enterprise and not current_period_start:
        subscription_type = "enterprise"
        subscription_spu_allowance = None  # Unlimited
        # Get current calendar month boundaries
        now = datetime.utcnow()
        period_start_dt = datetime(now.year, now.month, 1)
        if now.month == 12:
            period_end_dt = datetime(now.year + 1, 1, 1)
        else:
            period_end_dt = datetime(now.year, now.month + 1, 1)
        current_period_start = int(period_start_dt.timestamp())
        current_period_end = int(period_end_dt.timestamp())
        
        # Update customer document with enterprise billing period
        await stripe_customers.update_one(
            {"_id": stripe_customer["_id"]},
            {"$set": {
                "subscription_type": subscription_type,
                "current_billing_period_start": current_period_start,
                "current_billing_period_end": current_period_end,
                "subscription_spu_allowance": subscription_spu_allowance
            }}
        )
    
    # Check if we need to reset subscription SPU usage for new billing period
    customer_period_start = stripe_customer.get("current_billing_period_start")
    period_changed = current_period_start and customer_period_start != current_period_start
    has_spu_allowance = subscription_spu_allowance is not None and subscription_spu_allowance > 0
    
    if period_changed and (has_spu_allowance or is_enterprise):
        # New billing period - reset subscription SPU usage
        update_data = {
            "current_billing_period_start": current_period_start,
            "current_billing_period_end": current_period_end
        }
        
        # Only reset SPU usage for plans that have limits (not enterprise)
        if has_spu_allowance:
            update_data["subscription_spus_used"] = 0
            stripe_customer["subscription_spus_used"] = 0
        
        await stripe_customers.update_one(
            {"_id": stripe_customer["_id"]},
            {"$set": update_data}
        )
        
        logger.info(f"Updated billing period for {subscription_type} org {org_id}: {current_period_start} to {current_period_end}")
    
    # Get current subscription SPU usage
    subscription_spus_used = stripe_customer.get("subscription_spus_used", 0)
    subscription_spus_remaining = max(subscription_spu_allowance - subscription_spus_used, 0)
    
    # Get available credits
    purchased_credits = stripe_customer.get("purchased_credits", 0)
    purchased_used = stripe_customer.get("purchased_credits_used", 0)
    purchased_remaining = max(purchased_credits - purchased_used, 0)
    
    admin_credits = stripe_customer.get("admin_credits", CREDIT_CONFIG["spu_credit"])
    admin_used = stripe_customer.get("admin_credits_used", 0)
    admin_remaining = max(admin_credits - admin_used, 0)
    
    # NEW ORDER: Consume subscription SPUs first, then purchased credits, then admin credits, then paid usage
    from_subscription = min(spus, subscription_spus_remaining)
    from_purchased = min(spus - from_subscription, purchased_remaining)
    from_admin = min(spus - from_subscription - from_purchased, admin_remaining)
    from_paid = spus - from_subscription - from_purchased - from_admin

    # For individual/team plans, overage should not occur since it's blocked at limits check
    # For enterprise plans, overage is allowed and tracked
    if from_paid > 0 and subscription_type != "enterprise":
        logger.warning(f"Unexpected overage usage for non-enterprise plan {subscription_type} for org_id: {org_id}")
        # This should not happen since limits check should have blocked it
        # But if it does, we'll still record it for safety

    # Update subscription SPU usage
    if from_subscription > 0:
        await stripe_customers.update_one(
            {"_id": stripe_customer["_id"]},
            {"$inc": {"subscription_spus_used": from_subscription}}
        )
    
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
    
    # Record paid usage for the remainder (overage)
    # This will only be > 0 for enterprise plans or in unexpected cases
    if from_paid > 0:
        await save_usage_record(org_id, from_paid, operation="paid_usage", source="backend")
    
    return {
        "from_subscription": from_subscription,
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