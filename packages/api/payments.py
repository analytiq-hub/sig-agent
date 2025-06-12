import os
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Body, BackgroundTasks
from pydantic import BaseModel, Field
import stripe
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId

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
FREE_TIER_LIMIT = 50  # Number of free pages
TIER_TO_PRICE = {
    "individual": None,
    "team": None,
    "enterprise": None
}
NEXTAUTH_URL = None

# Pydantic models for request/response validation
class CustomerCreate(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None

class SetupIntentCreate(BaseModel):
    customer_id: str

class SubscriptionCreate(BaseModel):
    customer_id: str
    price_id: Optional[str] = None

class UsageRecord(BaseModel):
    user_id: str
    pages_processed: int
    operation: str
    source: str = "backend"

class PortalSessionCreate(BaseModel):
    user_id: str

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

class ChangePlanRequest(BaseModel):
    user_id: str
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
def get_subscription_type(price_id: str) -> str:
    """
    Determine the subscription type (basic, team, enterprise) based on the price_id
    
    Args:
        price_id: The Stripe price ID to look up
        
    Returns:
        str: The subscription type (basic, team, enterprise) or None if not found
    """
    for tier, tier_price_id in TIER_TO_PRICE.items():
        if tier_price_id == price_id:
            return tier
    return None

async def init_payments_env():
    global MONGO_URI, ENV
    global TIER_TO_PRICE
    global NEXTAUTH_URL
    global client, db
    global stripe_customers, stripe_events
    global stripe_webhook_secret

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    ENV = os.getenv("ENV", "dev")
    TIER_TO_PRICE = {
        "basic": os.getenv("STRIPE_PRICE_ID_BASIC", ""),
        "team": os.getenv("STRIPE_PRICE_ID_TEAM", ""),
        "enterprise": os.getenv("STRIPE_PRICE_ID_ENTERPRISE", "")
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
    Synchronize all users in the database with Stripe by creating customer records
    
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
        users = await db["users"].find().to_list(length=None)
        total_users = len(users)
        successful = 0
        errors = []
        
        for user in users:
            try:
                # Extract required fields
                user_id = str(user.get("_id"))
                email = user.get("email")
                name = user.get("name")
                
                if not email:
                    errors.append(f"User {user_id} has no email address")
                    continue
                
                # Create or get customer
                customer = await sync_payments_customer(
                    user_id=user_id,
                    email=email,
                    name=name
                )
                
                if customer:
                    successful += 1
                else:
                    errors.append(f"Failed to create/get customer for {user_id}")
            
            except Exception as e:
                error_msg = f"Error syncing user {user.get('_id', 'unknown')} with Stripe: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        logger.info(f"{successful}/{total_users} customers synchronized with Stripe")
        return total_users, successful, errors
    
    except Exception as e:
        logger.error(f"Error during customer sync with Stripe: {e}")
        return 0, 0, [f"Global error: {str(e)}"]

# Dependency to get database
async def get_db() -> AsyncIOMotorDatabase:
    return db

def parse_stripe_subscription(subscription):    
    # 1. Check if subscription is active
    is_active = subscription.get('status') == 'active'
    
    # 2. Check if payment method is on file
    # This can be determined by checking for default_payment_method or default_source
    has_payment_method = bool(subscription.get('default_payment_method') or subscription.get('default_source'))
    
    # 3. Check if payments are current
    # In Stripe, if a subscription is 'active', it generally means payments are current
    # You might also want to check if there are any past_due invoices related to this subscription
    payments_current = is_active  # For basic check
    
    # 4. Get metered usage information
    metered_usage = {}
    
    # Check subscription items for metered plans
    items = subscription.get('items', {}).get('data', [])
    for item in items:
        plan = item.get('plan', {})
        price = item.get('price', {})
        
        # Check if this is a metered plan
        if plan.get('usage_type') == 'metered':
            item_id = item.get('id')
            price_id = price.get('id')
            
            # Use the new subroutine
            subscription_type = get_subscription_type(price_id)
            
            metered_usage[item_id] = {
                'subscription_type': subscription_type,
                'product_id': plan.get('product'),
                'price_id': price_id,
                'meter_id': plan.get('meter'),
                'current_period_start': item.get('current_period_start'),
                'current_period_end': item.get('current_period_end')
            }
    
    return {
        'is_active': is_active,
        'has_payment_method': has_payment_method,
        'payments_current': payments_current,
        'metered_usage': metered_usage
    }

def parse_stripe_usage(parsed_subscription, stripe_customer_id):
    # Get metered usage information
    usage = {}
    if parsed_subscription and parsed_subscription.get("metered_usage"):
        try:
            # Get usage for each subscription item that has metered billing
            for item_id, item_data in parsed_subscription["metered_usage"].items():
                # Get the current billing period's usage
                if "subscription_item_id" in item_data:
                    subscription_item_id = item_data["subscription_item_id"]
                    subscription_type = item_data.get("subscription_type")  # Get subscription type

                    meter_event_summaries = stripe.billing.Meter.list_event_summaries(
                        item_data["meter_id"],
                        customer=stripe_customer_id,
                        start_time=item_data["current_period_start"],
                        end_time=item_data["current_period_end"],
                    )

                    logger.info(f"Meter event summaries: {meter_event_summaries}")
                    
                    # Extract relevant usage information
                    current_usage = {
                        "subscription_type": subscription_type,
                        "total_usage": meter_event_summaries.get('total_usage', 0),
                        "period_details": []
                    }
                    
                    # Store usage for this subscription item
                    usage[subscription_item_id] = current_usage
        
        except Exception as e:
            logger.error(f"Error retrieving Stripe usage information: {e}")
            # Continue with empty usage object rather than failing
    
    return usage

# Helper functions
async def sync_payments_customer(user_id: str, email: str, name: Optional[str] = None) -> Dict[str, Any]:
    """Create or retrieve a Stripe customer for the given user"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    logger.info(f"Sync stripe customer for user_id: {user_id} email: {email} name: {name}")

    try:
        # Check if customer already exists in our DB. We will reconcilie this with Stripe.
        customer = await stripe_customers.find_one({"user_id": user_id})
    
        # Search for customers in Stripe with the given email
        stripe_customer = None
        stripe_customer_list = stripe.Customer.list(email=email)
        
        if stripe_customer_list and stripe_customer_list.data:
            if len(stripe_customer_list.data) > 1:
                logger.warning(f"Multiple Stripe customers found for email: {email}")
            
            stripe_customer = stripe_customer_list.data[0]

        if stripe_customer:
            # Log the Stripe customer
            logger.info(f"Stripe customer: {stripe_customer}")
            
            # Get the metadata from the Stripe customer
            stripe_customer_metadata = stripe_customer.metadata
            if stripe_customer.name != name or stripe_customer_metadata.get("user_id") != user_id:

                # Update the customer in Stripe with additional metadata
                stripe.Customer.modify(
                    stripe_customer.id,
                    name=name,  # Update name if provided
                    metadata={"user_id": user_id, "updated_at": datetime.utcnow().isoformat()}
                )

                logger.info(f"Updated Stripe customer name {name} and user_id {user_id}")
        else:
            # Create new customer in Stripe
            stripe_customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"user_id": user_id}
            )
            
            logger.info(f"Created new Stripe customer with id: {stripe_customer.id}")
        
        # Check if the customer has an active subscription
        stripe_subscription = None
        stripe_subscription_list = stripe.Subscription.list(customer=stripe_customer.id)
        if stripe_subscription_list.data:
            if len(stripe_subscription_list.data) > 1:
                logger.error(f"Multiple subscriptions found for customer {user_id}, just parsing the first one")
            
            stripe_subscription = stripe_subscription_list.data[0]
            if stripe_subscription.status == "active":
                logger.info(f"Customer {user_id} has an active subscription")
        else:
            logger.info(f"Customer {user_id} has no active subscriptions")

        logger.info(f"Parsing Stripe subscription: {stripe_subscription}")
        
        subscriptions = parse_stripe_subscription(stripe_subscription) if stripe_subscription else None
        logger.info(f"Parsed subscriptions: {subscriptions}")
        
        # Get metered usage information
        usage = parse_stripe_usage(subscriptions, stripe_customer.id)
        logger.info(f"Parsed usage: {usage}")

        if customer:
            # Check if the customer_id changed
            if customer.get("stripe_customer_id") != stripe_customer.id:
                logger.info(f"Stripe customer_id changed from {customer.get('stripe_customer_id')} to {stripe_customer.id}")
                
                # Delete the old customer
                await stripe_customers.delete_one({"user_id": user_id})
                customer = None
        
        if customer:
            # Update the customer document with the new subscription and usage data
            await stripe_customers.update_one(
                {"user_id": user_id},
                {"$set": {
                    "subscriptions": subscriptions,
                    "usage": usage,
                    "updated_at": datetime.utcnow()
                }}
            )
            customer = await stripe_customers.find_one({"user_id": user_id})
            logger.info(f"Updated customer for user_id: {user_id}")
        else:
            logger.info(f"Customer {user_id} not found in MongoDB, creating")
        
            # Store in our database
            customer = {
                "user_id": user_id,
                "stripe_customer_id": stripe_customer.id,
                "email": email,
                "name": name,
                "subscriptions": subscriptions,
                "usage": usage,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            await stripe_customers.insert_one(customer)
        return customer
    
    except Exception as e:
        logger.error(f"Error in sync_payments_customer: {e}")
        raise e

async def record_usage(user_id: str, pages_processed: int, operation: str, source: str = "backend") -> Dict[str, Any]:
    """Record usage for a user and report to Stripe if on paid tier"""

    logger.info(f"record_usage called with user_id: {user_id}, pages_processed: {pages_processed}, operation: {operation}, source: {source}")

    if not stripe.api_key:
        # No-op if Stripe is not configured
        logger.warning("Stripe API key not configured - record_usage aborted")
        return None

    logger.info(f"Recording usage for user_id: {user_id}")
    logger.info(f"Pages processed: {pages_processed}")
    logger.info(f"Operation: {operation}")
    logger.info(f"Source: {source}")

    # Get current active subscription
    customer = await stripe_customers.find_one({"user_id": user_id})
    if not customer:
        raise ValueError(f"No customer found for user_id: {user_id}")

    # Create usage record
    usage_record = {
        "user_id": user_id,
        "stripe_customer_id": customer["stripe_customer_id"],
        "pages_processed": pages_processed,
        "operation": operation,
        "source": source,
        "timestamp": datetime.utcnow(),
        "reported_to_stripe": False
    }

    # Update usage in current subscription period if there is an active subscription
    if customer.get("current_subscription"):
        pass

    # Check if user needs to upgrade (has reached free tier limit)
    if not customer.get("stripe_subscription") or customer["stripe_subscription"].get("is_active") == False:
        # Only check limits for free tier users
        current_usage = customer.get("current_month_usage", 0) + pages_processed
        if current_usage >= FREE_TIER_LIMIT:
            await stripe_customers.update_one(
                {"user_id": user_id},
                {"$set": {"free_usage_remaining": 0}}
            )
            logger.info(f"User {user_id} has reached free usage limit")
    
    return usage_record

async def check_usage_limits(user_id: str) -> Dict[str, Any]:
    """Check if user has hit usage limits and needs to upgrade"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    logger.info(f"Checking usage limits for user_id: {user_id}")

    customer = await stripe_customers.find_one({"user_id": user_id})
    if not customer:
        raise ValueError(f"No customer found for user_id: {user_id}")
    
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

async def update_payments_customer(user_id: str, email: Optional[str] = None, name: Optional[str] = None) -> Dict[str, Any]:
    """
    Update a Stripe customer for the given user with new information
    
    Args:
        user_id: The user ID to update the Stripe customer for
        email: Optional new email address
        name: Optional new name
        
    Returns:
        The updated customer document or None if not found
    """

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    logger.info(f"Updating Stripe customer for user_id: {user_id}")
    
    try:
        # Check if customer exists in our DB
        stripe_customer = await stripe_customers.find_one({"user_id": user_id})
        if not stripe_customer:
            logger.warning(f"No Stripe customer found for user_id: {user_id}")
            return None
            
        # Only update if we have data to update
        if not any([email, name]):
            return stripe_customer
            
        # Update customer in Stripe
        stripe.Customer.modify(
            stripe_customer["stripe_customer_id"],
            email=email,
            name=name,
            metadata={"updated_at": datetime.utcnow().isoformat()}
        )
        
        # Update our local record
        update_data = {"updated_at": datetime.utcnow()}
        if email:
            update_data["email"] = email
        if name:
            update_data["name"] = name
            
        await stripe_customers.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
        # Return the updated customer
        return await stripe_customers.find_one({"user_id": user_id})
        
    except Exception as e:
        logger.error(f"Error updating Stripe customer: {e}")
        # Return the original customer info even if update failed
        return stripe_customer

async def delete_payments_customer(user_id: str) -> Dict[str, Any]:
    """
    Mark a Stripe customer as deleted without actually removing them from Stripe
    
    Args:
        user_id: The user ID of the Stripe customer to mark as deleted
        
    Returns:
        Dictionary with status information about the operation
    """

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    logger.info(f"Marking Stripe customer as deleted for user_id: {user_id}")
    
    try:
        # Find Stripe customer
        stripe_customer = await stripe_customers.find_one({"user_id": user_id})
        if not stripe_customer:
            logger.warning(f"No Stripe customer found for user_id: {user_id}")
            return {"success": False, "reason": "Customer not found"}
            
        # In Stripe, we typically don't delete customers but mark them as deleted
        # or disassociate them from your application
        stripe.Customer.modify(
            stripe_customer["stripe_customer_id"],
            metadata={"deleted": "true", "deleted_at": datetime.utcnow().isoformat()}
        )
        
        # Update our database record
        await stripe_customers.update_one(
            {"user_id": user_id},
            {"$set": {"deleted": True, "deleted_at": datetime.utcnow()}}
        )
        
        return {
            "success": True, 
            "customer_id": stripe_customer["stripe_customer_id"],
            "deleted_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error handling Stripe customer deletion: {e}")
        return {"success": False, "error": str(e)}

@payments_router.post("/setup-intent")
async def create_setup_intent(
    data: SetupIntentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a setup intent for collecting payment method"""

    logger.info(f"Creating setup intent for customer_id: {data.customer_id}")

    try:
        setup_intent = stripe.SetupIntent.create(
            customer=data.customer_id,
            payment_method_types=["card"],
        )
        return {"client_secret": setup_intent.client_secret}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/create-subscription")
async def create_subscription(
    data: SubscriptionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a metered subscription for a customer"""

    logger.info(f"Creating subscription for customer_id: {data.customer_id}")

    try:
        # Find the customer in our database
        customer = await stripe_customers.find_one({"stripe_customer_id": data.customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Use default price ID if not provided
        price_id = data.price_id or TIER_TO_PRICE["basic"]
        if not price_id:
            raise HTTPException(status_code=400, detail="No price ID provided or configured")
        
        # Use the new subroutine
        subscription_type = get_subscription_type(price_id)
        
        # Create the subscription
        subscription = stripe.Subscription.create(
            customer=data.customer_id,
            items=[{
                "price": price_id,
            }],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"],
        )
        
        # Find the subscription item ID for usage reporting later
        subscription_item_id = subscription["items"]["data"][0]["id"]
        
        # Update customer status
        await stripe_customers.update_one(
            {"stripe_customer_id": data.customer_id},
            {
                "$set": {
                    "stripe_subscription_id": subscription.id,
                    "usage_tier": "paid",
                    "payment_status": subscription.status,
                    "subscription_type": subscription_type,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {
            "subscription_id": subscription.id,
            "status": subscription.status,
            "subscription_type": subscription_type,
            "client_secret": subscription.latest_invoice.payment_intent.client_secret if hasattr(subscription, "latest_invoice") and hasattr(subscription.latest_invoice, "payment_intent") else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/customer-portal")
async def customer_portal(
    data: PortalSessionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> PortalSessionResponse:
    """Generate a Stripe Customer Portal link"""

    logger.info(f"Generating Stripe customer portal for user_id: {data.user_id}")

    user_id = data.user_id
    customer = await stripe_customers.find_one({"user_id": user_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found for user_id: {user_id}")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer["stripe_customer_id"],
            return_url=f"{NEXTAUTH_URL}/settings/user/subscription",
        )
        logger.info(f"Stripe customer portal URL: {session.url}")
        return PortalSessionResponse(url=session.url)
    except Exception as e:
        logger.error(f"Error generating Stripe customer portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/webhook", status_code=200)
async def webhook_received(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Handle Stripe webhook events"""

    logger.info("Received Stripe webhook event")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, stripe_webhook_secret
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
    elif event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        await handle_invoice_paid(invoice)
    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        await handle_invoice_payment_failed(invoice)
    
    # Mark event as processed
    await stripe_events.update_one(
        {"stripe_event_id": event["id"]},
        {"$set": {"processed": True, "processed_at": datetime.utcnow()}}
    )
    
    return {"status": "success"}

@payments_router.post("/record-usage")
async def api_record_usage(
    usage: UsageRecord,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Record usage for a user"""

    logger.info(f"Recording usage for user_id: {usage.user_id}")
    logger.info(f"Pages processed: {usage.pages_processed}")
    logger.info(f"Operation: {usage.operation}")
    logger.info(f"Source: {usage.source}")

    try:
        result = await record_usage(
            usage.user_id,
            usage.pages_processed,
            usage.operation,
            usage.source
        )
        limits = await check_usage_limits(usage.user_id)
        return {"success": True, "usage": result, "limits": limits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.get("/usage-stats/{user_id}")
async def get_usage_stats(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get current usage statistics for a user"""

    logger.info(f"Getting usage stats for user_id: {user_id}")
    try:
        customer = await stripe_customers.find_one({"user_id": user_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get usage data
        limits = await check_usage_limits(user_id)
        
        # Get subscription status if available
        subscription_status = None
        if customer.get("stripe_subscription_id"):
            # TODO: Get subscription status from Stripe
            pass
        
        return {
            "user_id": user_id,
            "usage_tier": customer["usage_tier"],
            "current_usage": customer["current_month_usage"],
            "free_limit": FREE_TIER_LIMIT,
            "free_remaining": customer.get("free_usage_remaining", 0) if customer["usage_tier"] == "free" else 0,
            "limit_reached": limits["limit_reached"],
            "needs_upgrade": limits["needs_upgrade"],
            "subscription": subscription_status
        }
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
        subscription_type = get_subscription_type(price_id)

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

async def handle_invoice_paid(invoice: Dict[str, Any]):
    """Handle invoice paid event"""
    
    logger.info(f"Handling invoice paid event for invoice_id: {invoice['id']}")

    try:
        # Update subscription status if needed
        if invoice.get("subscription"):
            
            # Update customer payment status
            customer = await stripe_customers.find_one({"stripe_customer_id": invoice["customer"]})
            if customer:
                await stripe_customers.update_one(
                    {"stripe_customer_id": invoice["customer"]},
                    {
                        "$set": {
                            "payment_status": "active",
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
    except Exception as e:
        print(f"Error processing invoice payment: {e}")

async def handle_invoice_payment_failed(invoice: Dict[str, Any]):
    """Handle invoice payment failed event"""

    logger.info(f"Handling invoice payment failed event for invoice_id: {invoice['id']}")
    try:
        # Update customer payment status
        await stripe_customers.update_one(
            {"stripe_customer_id": invoice["customer"]},
            {
                "$set": {
                    "payment_status": "pastDue",
                    "updated_at": datetime.utcnow()
                }
            }
        )
    except Exception as e:
        print(f"Error processing invoice payment failure: {e}")

async def delete_all_stripe_customers(dryrun: bool = True) -> Dict[str, Any]:
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
        batch_size = 100
        
        while has_more:
            # Fetch customers in batches
            params = {"limit": batch_size}
            if starting_after:
                params["starting_after"] = starting_after
                
            customers = stripe.Customer.list(**params)
            
            # Process each customer in the batch
            for customer in customers.data:
                try:
                    # First cancel any active subscriptions
                    subscriptions = stripe.Subscription.list(customer=customer.id)
                    for subscription in subscriptions.data:
                        try:
                            if not dryrun:
                                stripe.Subscription.delete(subscription.id)
                                logger.info(f"Deleted subscription {subscription.id} for customer {customer.id}")
                            else:
                                logger.info(f"Would have deleted subscription {subscription.id} for customer {customer.id}")
                        except Exception as e:
                            logger.error(f"Error deleting subscription {subscription.id}: {e}")
                    
                    # Delete the customer
                    if not dryrun:
                        stripe.Customer.delete(customer.id)
                        deleted_count += 1
                        logger.info(f"Deleted Stripe customer: {customer.id}")
                    else:
                        logger.info(f"Would have deleted Stripe customer: {customer.id}")
                    
                except Exception as e:
                    error_msg = f"Error deleting Stripe customer {customer.id}: {str(e)}"
                    logger.error(error_msg)
                    error_messages.append(error_msg)
                    failed_count += 1
            
            # Check if there are more customers to process
            has_more = customers.has_more
            if has_more and customers.data:
                starting_after = customers.data[-1].id
        
        # Now clean up our local database
        try:
            if not dryrun:
                # Delete all local records
                await stripe_customers.delete_many({})
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

@payments_router.get("/plans")
async def get_subscription_plans(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> SubscriptionPlanResponse:
    """Get available subscription plans and user's current plan"""
    
    # Define the available plans with metered usage details
    plans = [
        SubscriptionPlan(
            plan_id="basic",
            name="Basic",
            price_id=TIER_TO_PRICE["basic"],
            price=9.99,
            included_usage=100,
            overage_price=0.01,
            features=[
                "Basic document processing",
                "Email support"
            ]
        ),
        SubscriptionPlan(
            plan_id="team",
            name="Team",
            price_id=TIER_TO_PRICE["team"],
            price=29.99,
            included_usage=500,
            overage_price=0.02,
            features=[
                "Advanced document processing",
                "Priority support",
                "Team collaboration"
            ]
        ),
        SubscriptionPlan(
            plan_id="enterprise",
            name="Enterprise",
            price_id=TIER_TO_PRICE["enterprise"],
            price=99.99,
            included_usage=2000,
            overage_price=0.05,
            features=[
                "Custom document processing",
                "Gold support",
                "Team collaboration",
                "Custom integrations",
            ]
        )
    ]

    # Get user's current plan
    customer = await stripe_customers.find_one({"user_id": user_id})
    current_plan = None
    if customer and customer.get("stripe_subscription"):
        subscription = customer["stripe_subscription"]
        if subscription.get("is_active"):
            # Find the plan ID based on the price ID
            for plan in plans:
                if plan.price_id == subscription.get("price_id"):
                    current_plan = plan.plan_id
                    break

    return SubscriptionPlanResponse(plans=plans, current_plan=current_plan)

@payments_router.post("/change-plan")
async def change_subscription_plan(
    data: ChangePlanRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Change user's subscription plan"""
    logger.info(f"Changing subscription plan for user_id: {data.user_id} to plan_id: {data.plan_id}")
    
    # Get customer record
    customer = await stripe_customers.find_one({"user_id": data.user_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Find the selected plan
    plans = await get_subscription_plans(data.user_id, db)
    selected_plan = next((p for p in plans.plans if p.plan_id == data.plan_id), None)
    if not selected_plan:
        raise HTTPException(status_code=400, detail="Invalid plan selected")

    try:
        # If user has an active subscription, update it
        if customer.get("stripe_subscription") and customer["stripe_subscription"].get("subscription_item_id"):
            subscription_id = customer["stripe_subscription"].get("subscription_id")
            if subscription_id:
                # Update the subscription with the new price
                updated_subscription = stripe.Subscription.modify(
                    subscription_id,
                    items=[{
                        'id': customer["stripe_subscription"].get("subscription_item_id"),
                        'price': selected_plan.price_id,
                    }],
                    proration_behavior='always_invoice'
                )
                # Update minimal info in customer record
                await stripe_customers.update_one(
                    {"user_id": data.user_id},
                    {
                        "$set": {
                            "stripe_subscription": {
                                "subscription_type": selected_plan.plan_id,
                                "subscription_item_id": customer["stripe_subscription"].get("subscription_item_id")
                            },
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                logger.info(f"Updated subscription {subscription_id} with new price {selected_plan.price_id}")
        else:
            # Create new subscription
            subscription = stripe.Subscription.create(
                customer=customer["stripe_customer_id"],
                items=[{
                    'price': selected_plan.price_id,
                }],
                payment_behavior='default_incomplete',
                expand=['latest_invoice.payment_intent'],
            )
            
            # Store only minimal info in customer record
            await stripe_customers.update_one(
                {"user_id": data.user_id},
                {
                    "$set": {
                        "stripe_subscription": {
                            "subscription_type": selected_plan.plan_id,
                            "subscription_item_id": subscription["items"]["data"][0]["id"]
                        },
                        "updated_at": datetime.utcnow()
                    }
                }
            )

        return {"status": "success", "message": "Subscription plan updated successfully"}

    except Exception as e:
        logger.error(f"Error changing subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.get("/subscription-history/{user_id}")
async def get_subscription_history(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get subscription history for a user"""
    try:
        history = None # TODO: Get subscription history from Stripe
        
        return {
            "subscription_history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
