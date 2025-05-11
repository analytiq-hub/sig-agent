import os
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Body, BackgroundTasks
from pydantic import BaseModel, Field
import stripe
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId

import analytiq_data as ad

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
stripe_subscriptions = None
stripe_usage = None
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

async def init_payments_env():
    global MONGO_URI, ENV
    global TIER_TO_PRICE
    global NEXTAUTH_URL
    global client, db
    global stripe_customers, stripe_subscriptions, stripe_usage, stripe_events
    global stripe_webhook_secret

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    ENV = os.getenv("ENV", "dev")
    TIER_TO_PRICE = {
        "individual": os.getenv("STRIPE_PRICE_ID_INDIVIDUAL", ""),
        "team": os.getenv("STRIPE_PRICE_ID_TEAM", ""),
        "enterprise": os.getenv("STRIPE_PRICE_ID_ENTERPRISE", "")
    }
    NEXTAUTH_URL = os.getenv("NEXTAUTH_URL", "http://localhost:3000")

    client = AsyncIOMotorClient(MONGO_URI)
    db = client[ENV]

    stripe_customers = db["stripe.customers"]
    stripe_subscriptions = db["stripe.subscriptions"]
    stripe_usage = db["stripe.usage"]
    stripe_events = db["stripe.events"]
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

async def init_payments():
    await init_payments_env()

    ad.log.info("Stripe initialized")

    await sync_customers()
    ad.log.info("Stripe customers synced")

async def sync_customers() -> Tuple[int, int, List[str]]:
    """
    Synchronize all users in the database with Stripe by creating customer records
    
    Returns:
        Tuple containing (total_users, successful_syncs, error_messages)
    """
    if not stripe.api_key:
        # No-op if Stripe is not configured
        ad.log.warning("Stripe API key not configured - sync_customers aborted")
        return 0, 0, ["Stripe API key not configured"]

    ad.log.info("Starting sync of all users with Stripe")
    
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
                customer = await get_or_create_payments_customer(
                    user_id=user_id,
                    email=email,
                    name=name
                )
                
                if customer:
                    successful += 1
                else:
                    errors.append(f"Failed to create/get customer for {user_id}")
            
            except Exception as e:
                error_msg = f"Error syncing user {user.get('_id', 'unknown')}: {str(e)}"
                ad.log.error(error_msg)
                errors.append(error_msg)
        
        ad.log.info(f"Completed sync: {successful}/{total_users} users synchronized with Stripe")
        return total_users, successful, errors
    
    except Exception as e:
        ad.log.error(f"Error during customer sync: {e}")
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
            metered_usage[item_id] = {
                'subscription_item_id': item_id,
                'meter_id': plan.get('meter'),
                'product_id': plan.get('product'),
                'price_id': price.get('id'),
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

                    meter_event_summaries = stripe.billing.Meter.list_event_summaries(
                        item_data["meter_id"],
                        customer=stripe_customer_id,
                        start_time=item_data["current_period_start"],
                        end_time=item_data["current_period_end"],
                    )

                    ad.log.info(f"Meter event summaries: {meter_event_summaries}")
                    
                    # Extract relevant usage information
                    current_usage = {
                        "total_usage": 0,
                        "period_details": []
                    }
                    
                    # for record in usage_records.get("data", []):
                    #     period_info = {
                    #         "period_start": datetime.fromtimestamp(record.get("period", {}).get("start", 0)),
                    #         "period_end": datetime.fromtimestamp(record.get("period", {}).get("end", 0)),
                    #         "total_usage": record.get("total_usage", 0)
                    #     }
                    #     current_usage["period_details"].append(period_info)
                        
                    #     # Add to total usage
                    #     current_usage["total_usage"] += record.get("total_usage", 0)
                    
                    # Store usage for this subscription item
                    usage[subscription_item_id] = current_usage
        
        except Exception as e:
            ad.log.error(f"Error retrieving Stripe usage information: {e}")
            # Continue with empty usage object rather than failing
    
    return usage

# Helper functions
async def get_or_create_payments_customer(user_id: str, email: str, name: Optional[str] = None) -> Dict[str, Any]:
    """Create or retrieve a Stripe customer for the given user"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    ad.log.info(f"Getting or creating Stripe customer for user_id: {user_id}")
    ad.log.info(f"Email: {email}")
    ad.log.info(f"Name: {name}")

    # Check if customer already exists in our DB. We will reconcilie this with Stripe.
    customer_doc = await stripe_customers.find_one({"user_id": user_id})

    # Check if customer exists in Stripe by email
    try:
        # Search for customers in Stripe with the given email
        existing_customers = stripe.Customer.list(email=email)
        
        if existing_customers and existing_customers.data:
            # Customer exists in Stripe but not in our DB
            stripe_customer = existing_customers.data[0]

            # Has name changed?
            if name and name != stripe_customer.name:
                # Update the customer in Stripe with additional metadata
                stripe.Customer.modify(
                    stripe_customer.id,
                    name=name,  # Update name if provided
                    metadata={"user_id": user_id, "updated_at": datetime.utcnow().isoformat()}
                )
                ad.log.info(f"Updated Stripe customer name for user_id: {user_id}")
            else:          
                ad.log.info(f"Found existing Stripe customer with id: {stripe_customer.id}")
        else:
            # Create new customer in Stripe
            stripe_customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"user_id": user_id}
            )
            
            ad.log.info(f"Created new Stripe customer with id: {stripe_customer.id}")
        
        # Check if the customer has an active subscription
        subscription = None
        subscriptions = stripe.Subscription.list(customer=stripe_customer.id)
        if subscriptions.data:
            subscription = subscriptions.data[0]
            if subscription.status == "active":
                ad.log.info(f"Customer {user_id} has an active subscription")
        else:
            ad.log.info(f"Customer {user_id} has no active subscriptions")
        
        parsed_subscription = parse_stripe_subscription(subscription) if subscription else None
        ad.log.info(f"Parsed subscription: {parsed_subscription}")
        
        # Get metered usage information
        usage = parse_stripe_usage(parsed_subscription, stripe_customer.id)
        ad.log.info(f"Parsed usage: {usage}")
        
        if customer_doc:
            # Update the customer document with the new subscription and usage data
            await stripe_customers.update_one(
                {"user_id": user_id},
                {"$set": {
                    "stripe_subscription": parsed_subscription,
                    "stripe_usage": usage,
                    "updated_at": datetime.utcnow()
                }}
            )
            customer_doc = await stripe_customers.find_one({"user_id": user_id})
            ad.log.info(f"Updated customer document for user_id: {user_id}")
        else:
            ad.log.info(f"Customer {user_id} has no customer document")
        
            # Store in our database
            customer_doc = {
                "user_id": user_id,
                "stripe_customer_id": stripe_customer.id,
                "email": email,
                "name": name,
                "stripe_subscription": parsed_subscription,
                "stripe_usage": usage,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            await stripe_customers.insert_one(customer_doc)
        return customer_doc
    
    except Exception as e:
        ad.log.error(f"Error in get_or_create_payments_customer: {e}")
        raise e

async def record_usage(user_id: str, pages_processed: int, operation: str, source: str = "backend") -> Dict[str, Any]:
    """Record usage for a user and report to Stripe if on paid tier"""

    ad.log.info(f"record_usage called with user_id: {user_id}, pages_processed: {pages_processed}, operation: {operation}, source: {source}")

    if not stripe.api_key:
        # No-op if Stripe is not configured
        ad.log.warning("Stripe API key not configured - record_usage aborted")
        return None

    ad.log.info(f"Recording usage for user_id: {user_id}")
    ad.log.info(f"Pages processed: {pages_processed}")
    ad.log.info(f"Operation: {operation}")
    ad.log.info(f"Source: {source}")

    # Get customer record
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
    
    # Insert usage record
    result = await stripe_usage.insert_one(usage_record)
    usage_id = result.inserted_id
    
    # Update customer usage stats
    await stripe_customers.update_one(
        {"user_id": user_id},
        {
            "$inc": {"current_month_usage": pages_processed},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Check if customer has an active subscription with metered usage
    if customer.get("stripe_subscription") and customer["stripe_subscription"].get("is_active"):
        try:
            # Get metered usage items from the subscription
            metered_usage = customer["stripe_subscription"].get("metered_usage", {})
            if metered_usage:
                # Report usage to Stripe for each metered subscription item
                for item_id, item_data in metered_usage.items():
                    if "subscription_item_id" in item_data:
                        subscription_item_id = item_data["subscription_item_id"]

                        meter_event = stripe.billing.MeterEvent.create(
                            event_name="docrouterpages",
                            payload={"stripe_customer_id": customer["stripe_customer_id"], "value": pages_processed},
                        )
                        ad.log.info(f"Reported usage to Stripe for user_id: {customer['user_id']}")
                        ad.log.info(f"Meter event: {meter_event}")
                        
                # Mark usage as reported to Stripe
                await stripe_usage.update_one(
                    {"_id": usage_id},
                    {"$set": {"reported_to_stripe": True}}
                )
                
                ad.log.info(f"Reported {pages_processed} pages of usage to Stripe for user_id: {user_id}")
        except Exception as e:
            ad.log.error(f"Error reporting usage to Stripe: {e}")
    else:
        ad.log.info(f"User {user_id} has no active subscription with metered usage - skipping Stripe reporting")
    
    # Check if user needs to upgrade (has reached free tier limit)
    if not customer.get("stripe_subscription") or customer["stripe_subscription"].get("is_active") == False:
        # Only check limits for free tier users
        current_usage = customer.get("current_month_usage", 0) + pages_processed
        if current_usage >= FREE_TIER_LIMIT:
            await stripe_customers.update_one(
                {"user_id": user_id},
                {"$set": {"free_usage_remaining": 0}}
            )
            ad.log.info(f"User {user_id} has reached free usage limit")
    
    return usage_record

async def check_usage_limits(user_id: str) -> Dict[str, Any]:
    """Check if user has hit usage limits and needs to upgrade"""

    if not stripe.api_key:
        # No-op if Stripe is not configured
        return None

    ad.log.info(f"Checking usage limits for user_id: {user_id}")

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

    ad.log.info(f"Updating Stripe customer for user_id: {user_id}")
    
    try:
        # Check if customer exists in our DB
        stripe_customer = await stripe_customers.find_one({"user_id": user_id})
        if not stripe_customer:
            ad.log.warning(f"No Stripe customer found for user_id: {user_id}")
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
        ad.log.error(f"Error updating Stripe customer: {e}")
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

    ad.log.info(f"Marking Stripe customer as deleted for user_id: {user_id}")
    
    try:
        # Find Stripe customer
        stripe_customer = await stripe_customers.find_one({"user_id": user_id})
        if not stripe_customer:
            ad.log.warning(f"No Stripe customer found for user_id: {user_id}")
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
        ad.log.error(f"Error handling Stripe customer deletion: {e}")
        return {"success": False, "error": str(e)}

@payments_router.post("/setup-intent")
async def create_setup_intent(
    data: SetupIntentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a setup intent for collecting payment method"""

    ad.log.info(f"Creating setup intent for customer_id: {data.customer_id}")

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

    ad.log.info(f"Creating subscription for customer_id: {data.customer_id}")

    try:
        # Find the customer in our database
        customer = await stripe_customers.find_one({"stripe_customer_id": data.customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Use default price ID if not provided
        price_id = data.price_id or TIER_TO_PRICE["individual"]
        if not price_id:
            raise HTTPException(status_code=400, detail="No price ID provided or configured")
        
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
        
        # Store the subscription in our database
        subscription_doc = {
            "user_id": customer["user_id"],
            "stripe_customer_id": data.customer_id,
            "subscription_id": subscription.id,
            "subscription_item_id": subscription_item_id,
            "price_id": price_id,
            "status": subscription.status,
            "current_period_start": datetime.fromtimestamp(subscription.current_period_start),
            "current_period_end": datetime.fromtimestamp(subscription.current_period_end),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await stripe_subscriptions.insert_one(subscription_doc)
        
        # Update customer status
        await stripe_customers.update_one(
            {"stripe_customer_id": data.customer_id},
            {
                "$set": {
                    "stripe_subscription_id": subscription.id,
                    "usage_tier": "paid",
                    "payment_status": subscription.status,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {
            "subscription_id": subscription.id,
            "status": subscription.status,
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

    ad.log.info(f"Generating Stripe customer portal for user_id: {data.user_id}")

    user_id = data.user_id
    customer = await stripe_customers.find_one({"user_id": user_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found for user_id: {user_id}")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer["stripe_customer_id"],
            return_url=f"{NEXTAUTH_URL}/settings",
        )
        ad.log.info(f"Stripe customer portal URL: {session.url}")
        return PortalSessionResponse(url=session.url)
    except Exception as e:
        ad.log.error(f"Error generating Stripe customer portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payments_router.post("/webhook", status_code=200)
async def webhook_received(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Handle Stripe webhook events"""

    ad.log.info("Received Stripe webhook event")
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
    
    ad.log.info(f"Stripe webhook event received: {event['type']}")

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

    ad.log.info(f"Recording usage for user_id: {usage.user_id}")
    ad.log.info(f"Pages processed: {usage.pages_processed}")
    ad.log.info(f"Operation: {usage.operation}")
    ad.log.info(f"Source: {usage.source}")

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

    ad.log.info(f"Getting usage stats for user_id: {user_id}")
    try:
        customer = await stripe_customers.find_one({"user_id": user_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get usage data
        limits = await check_usage_limits(user_id)
        
        # Get subscription status if available
        subscription_status = None
        if customer.get("stripe_subscription_id"):
            subscription = await stripe_subscriptions.find_one({"subscription_id": customer["stripe_subscription_id"]})
            if subscription:
                subscription_status = {
                    "status": subscription["status"],
                    "current_period_start": subscription["current_period_start"],
                    "current_period_end": subscription["current_period_end"],
                }
        
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

    ad.log.info(f"Handling subscription updated event for subscription_id: {subscription['id']}")
    try:
        # Find the subscription in our database
        sub_doc = await stripe_subscriptions.find_one({"subscription_id": subscription["id"]})
        
        if sub_doc:
            # Update existing subscription
            await stripe_subscriptions.update_one(
                {"subscription_id": subscription["id"]},
                {
                    "$set": {
                        "status": subscription["status"],
                        "current_period_start": datetime.fromtimestamp(subscription["current_period_start"]),
                        "current_period_end": datetime.fromtimestamp(subscription["current_period_end"]),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # This is a new subscription or one we don't have - find the customer
            customer = await stripe_customers.find_one({"stripe_customer_id": subscription["customer"]})
            if not customer:
                print(f"Warning: Received subscription update for unknown customer: {subscription['customer']}")
                return
                
            # Find the subscription item ID
            subscription_item_id = subscription["items"]["data"][0]["id"] if "items" in subscription and "data" in subscription["items"] else None
            
            # Create new subscription document
            new_sub = {
                "user_id": customer["user_id"],
                "stripe_customer_id": subscription["customer"],
                "subscription_id": subscription["id"],
                "subscription_item_id": subscription_item_id,
                "price_id": subscription["items"]["data"][0]["price"]["id"] if "items" in subscription and "data" in subscription["items"] else None,
                "status": subscription["status"],
                "current_period_start": datetime.fromtimestamp(subscription["current_period_start"]),
                "current_period_end": datetime.fromtimestamp(subscription["current_period_end"]),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await stripe_subscriptions.insert_one(new_sub)
        
        # Update customer status
        await stripe_customers.update_one(
            {"stripe_customer_id": subscription["customer"]},
            {
                "$set": {
                    "stripe_subscription_id": subscription["id"],
                    "usage_tier": "paid" if subscription["status"] == "active" else "free",
                    "payment_status": subscription["status"],
                    "updated_at": datetime.utcnow()
                }
            }
        )
    except Exception as e:
        print(f"Error processing subscription update: {e}")

async def handle_subscription_deleted(subscription: Dict[str, Any]):
    """Handle subscription deleted event"""

    ad.log.info(f"Handling subscription deleted event for subscription_id: {subscription['id']}")

    try:
        # Update subscription in our database
        await stripe_subscriptions.update_one(
            {"subscription_id": subscription["id"]},
            {
                "$set": {
                    "status": "canceled",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Update customer status
        await stripe_customers.update_one(
            {"stripe_subscription_id": subscription["id"]},
            {
                "$set": {
                    "usage_tier": "free",
                    "payment_status": "none",
                    "free_usage_remaining": 0,  # They've used their free tier
                    "updated_at": datetime.utcnow()
                }
            }
        )
    except Exception as e:
        print(f"Error processing subscription deletion: {e}")

async def handle_invoice_paid(invoice: Dict[str, Any]):
    """Handle invoice paid event"""
    
    ad.log.info(f"Handling invoice paid event for invoice_id: {invoice['id']}")

    try:
        # Update subscription status if needed
        if invoice.get("subscription"):
            await stripe_subscriptions.update_one(
                {"subscription_id": invoice["subscription"]},
                {
                    "$set": {
                        "status": "active",
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
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

    ad.log.info(f"Handling invoice payment failed event for invoice_id: {invoice['id']}")
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
        
        if invoice.get("subscription"):
            # Update subscription status
            await stripe_subscriptions.update_one(
                {"subscription_id": invoice["subscription"]},
                {
                    "$set": {
                        "status": "past_due",
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
    
    ad.log.warning("Starting deletion of ALL Stripe customers")
    
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
                                ad.log.info(f"Deleted subscription {subscription.id} for customer {customer.id}")
                            else:
                                ad.log.info(f"Would have deleted subscription {subscription.id} for customer {customer.id}")
                        except Exception as e:
                            ad.log.error(f"Error deleting subscription {subscription.id}: {e}")
                    
                    # Delete the customer
                    if not dryrun:
                        stripe.Customer.delete(customer.id)
                        deleted_count += 1
                        ad.log.info(f"Deleted Stripe customer: {customer.id}")
                    else:
                        ad.log.info(f"Would have deleted Stripe customer: {customer.id}")
                    
                except Exception as e:
                    error_msg = f"Error deleting Stripe customer {customer.id}: {str(e)}"
                    ad.log.error(error_msg)
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
                await stripe_subscriptions.delete_many({})
                await stripe_usage.delete_many({})
                await stripe_customers.delete_many({})
                ad.log.info("Deleted all local Stripe customer records")
            else:
                ad.log.info("Would have deleted all local Stripe customer records")
        except Exception as e:
            error_msg = f"Error cleaning up local database: {str(e)}"
            ad.log.error(error_msg)
            error_messages.append(error_msg)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "errors": error_messages,
            "warning": "All Stripe customers have been permanently deleted."
        }
        
    except Exception as e:
        ad.log.error(f"Error during bulk deletion: {e}")
        return {"success": False, "error": str(e)}
