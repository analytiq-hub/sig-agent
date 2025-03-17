import os
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Body, BackgroundTasks
from pydantic import BaseModel, Field
import stripe
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId

# Initialize FastAPI router
router = APIRouter(prefix="/v0/account/stripe", tags=["stripe"])

# Initialize Stripe with API key
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
ENV = os.getenv("ENV", "dev")

# Initialize MongoDB client
client = AsyncIOMotorClient(MONGO_URI)
db = client[ENV]

# Define Stripe-specific collections with prefix
stripe_customers = db["stripe.customers"]
stripe_subscriptions = db["stripe.subscriptions"]
stripe_usage = db["stripe.usage"]
stripe_events = db["stripe.events"]

# Stripe configuration constants
FREE_TIER_LIMIT = 50  # Number of free pages
DEFAULT_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")  # Metered price ID from Stripe dashboard
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

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
    customer_id: str

# Dependency to get database
async def get_db() -> AsyncIOMotorDatabase:
    return db

# Helper functions
async def get_or_create_stripe_customer(user_id: str, email: str, name: Optional[str] = None) -> Dict[str, Any]:
    """Create or retrieve a Stripe customer for the given user"""
    # Check if customer already exists in our DB
    customer_doc = await stripe_customers.find_one({"user_id": user_id})
    
    if customer_doc:
        return customer_doc
    
    # Create new customer in Stripe
    stripe_customer = stripe.Customer.create(
        email=email,
        name=name,
        metadata={"user_id": user_id}
    )
    
    # Store in our database
    customer_doc = {
        "user_id": user_id,
        "stripe_customer_id": stripe_customer.id,
        "email": email,
        "name": name,
        "payment_status": "none",
        "free_usage_remaining": FREE_TIER_LIMIT,
        "current_month_usage": 0,
        "usage_tier": "free",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await stripe_customers.insert_one(customer_doc)
    return customer_doc

async def record_usage(user_id: str, pages_processed: int, operation: str, source: str = "backend") -> Dict[str, Any]:
    """Record usage for a user and report to Stripe if on paid tier"""
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
    
    # If customer is on paid tier, report to Stripe
    if customer.get("usage_tier") == "paid" and customer.get("stripe_subscription_id"):
        try:
            # Report usage to Stripe
            subscription = await stripe_subscriptions.find_one({"subscription_id": customer["stripe_subscription_id"]})
            if subscription and subscription.get("status") == "active":
                stripe.SubscriptionItem.create_usage_record(
                    subscription["subscription_item_id"],
                    {
                        "quantity": pages_processed,
                        "timestamp": int(datetime.utcnow().timestamp()),
                        "action": "increment"
                    }
                )
                
                # Mark as reported
                await stripe_usage.update_one(
                    {"_id": usage_id},
                    {"$set": {"reported_to_stripe": True}}
                )
        except Exception as e:
            print(f"Error reporting usage to Stripe: {e}")
    
    # Check if user needs to upgrade
    updated_customer = await stripe_customers.find_one({"user_id": user_id})
    if updated_customer["usage_tier"] == "free" and updated_customer["current_month_usage"] >= FREE_TIER_LIMIT:
        await stripe_customers.update_one(
            {"user_id": user_id},
            {"$set": {"free_usage_remaining": 0}}
        )
    
    return usage_record

async def check_usage_limits(user_id: str) -> Dict[str, Any]:
    """Check if user has hit usage limits and needs to upgrade"""
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

# API Endpoints
@router.post("/create-customer")
async def create_customer(
    customer_data: CustomerCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a new Stripe customer"""
    try:
        customer = await get_or_create_stripe_customer(
            customer_data.user_id,
            customer_data.email,
            customer_data.name
        )
        return {"success": True, "customer_id": customer["stripe_customer_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/setup-intent")
async def create_setup_intent(
    data: SetupIntentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a setup intent for collecting payment method"""
    try:
        setup_intent = stripe.SetupIntent.create(
            customer=data.customer_id,
            payment_method_types=["card"],
        )
        return {"client_secret": setup_intent.client_secret}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-subscription")
async def create_subscription(
    data: SubscriptionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a metered subscription for a customer"""
    try:
        # Find the customer in our database
        customer = await stripe_customers.find_one({"stripe_customer_id": data.customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Use default price ID if not provided
        price_id = data.price_id or DEFAULT_PRICE_ID
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

@router.post("/customer-portal")
async def customer_portal(
    data: PortalSessionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Generate a Stripe Customer Portal link"""
    try:
        session = stripe.billing_portal.Session.create(
            customer=data.customer_id,
            return_url=f"{FRONTEND_URL}/account",
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook", status_code=200)
async def webhook_received(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, stripe_webhook_secret
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
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
        background_tasks.add_task(handle_subscription_updated, subscription)
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        background_tasks.add_task(handle_subscription_deleted, subscription)
    elif event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        background_tasks.add_task(handle_invoice_paid, invoice)
    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        background_tasks.add_task(handle_invoice_payment_failed, invoice)
    
    # Mark event as processed
    await stripe_events.update_one(
        {"stripe_event_id": event["id"]},
        {"$set": {"processed": True, "processed_at": datetime.utcnow()}}
    )
    
    return {"status": "success"}

@router.post("/record-usage")
async def api_record_usage(
    usage: UsageRecord,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Record usage for a user"""
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

@router.get("/usage-stats/{user_id}")
async def get_usage_stats(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get current usage statistics for a user"""
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