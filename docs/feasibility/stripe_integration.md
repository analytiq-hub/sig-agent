# PRD: Stripe Payment Integration for DocRouter
## Overview
This document outlines the integration of Stripe's metered billing system with DocRouter. The solution will implement pay-as-you-go billing based on document pages processed by LLM calls, while allowing new users to try the service before requiring payment information.

## User Experience Requirements
* __Frictionless Onboarding__: Users can register and start using the service without immediately entering credit card details
* __Usage Transparency__: Clear display of current usage, limits, and projected billing
* __Smooth Payment Transition__: Simple process for entering payment details when usage limits are reached
* __Account Management__: Easy access to billing history, subscription status, and payment method management

## Functional Requirements
### Metered Billing
* Implement per-page metering for all LLM-processed document pages
* Count pages processed across both frontend and backend operations
* Apply different rates for different types of operations if needed
### User Tiers
* __Free Tier__: Limited number of pages per month (e.g., 50 pages)
* __Basic Tier__: Unlimited pages at a metered rate, $0.01 per page
* __Teams Tier__: Unlimited pages at $0.05 per page
* __Enterprise Tier__: Unlimited pages at $0.10 per page
### Payment Processing
* Collect and securely store payment details through Stripe
* Process automatic payments based on usage
* Provide receipts and invoices for all transactions
### Usage Monitoring
* Track and display current usage to users
* Send notifications when approaching free tier limits
* Provide usage forecasting based on current patterns

# Technical Requirements
## Stripe Integration
* Implement Stripe Customer portal
* Configure Stripe metered billing products
* Set up webhook handlers for Stripe events
## MongoDB Integration
* Store user Stripe customer IDs in MongoDB
* Cache and track usage metrics in MongoDB
* Maintain billing and subscription status in user records
## FastAPI Implementation
* Create endpoints for Stripe operations
* Implement page counting middleware for all LLM operations
* Handle usage limit enforcement
## Security
* Secure handling of Stripe API keys
* PCI compliance for payment processing
* Protection of user payment and billing data

# System Design Document
## Architecture Overview
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │     │   FastAPI   │     │    Stripe   │
│  Frontend   │◄────┤   Backend   │◄────┤    APIs     │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                   ▲                   ▲
       │                   │                   │
       └───────────────┐  │  ┌─────────────────┘
                       │  │  │
                       ▼  ▼  ▼
                   ┌─────────────┐
                   │  MongoDB    │
                   │  Database   │
                   └─────────────┘
```

## Component Description
### Stripe Integration
* __Stripe Customer Management__: Create and manage Stripe customers
* __Subscription Management__: Handle metered subscription lifecycle
* __Usage Reporting__: Report usage to Stripe for billing
* __Webhook Handler__: Process Stripe events (payment success/failure, etc.)
### MongoDB Schema
```
// User Collection
{
  _id: ObjectId,
  email: String,
  name: String,
  stripeCustomerId: String,
  stripePriceId: String,
  stripeSubscriptionId: String,
  paymentStatus: String,  // "none", "active", "pastDue", "canceled"
  freeUsageRemaining: Number,
  currentMonthUsage: Number,
  usageTier: String,  // "free", "paid"
  createdAt: Date,
  updatedAt: Date
}

// Usage Collection
{
  _id: ObjectId,
  userId: ObjectId,
  timestamp: Date,
  operation: String,  // Description of the operation
  pagesProcessed: Number,
  source: String,  // "frontend" or "backend"
  reportedToStripe: Boolean
}
```
### Stripe Configuration
* One meter: __DocRouterPages__
* Three products:
  * __DocRouterBasic__
  * __DocRouterTeams__
  * __DocRouterEnterprise__

### FastAPI Backend Components
####API Endpoints:
* `/api/stripe/create-customer` - Create a new Stripe customer
* `/api/stripe/setup-intent` - Generate a setup intent for collecting payment
* `/api/stripe/create-subscription` - Create a metered subscription
* `/api/stripe/customer-portal` - Generate a link to Stripe Customer Portal
* `/api/stripe/webhook` - Handle Stripe webhook events
* `/api/usage/stats` - Get current usage statistics
* `/api/usage/reset-limit` - Admin endpoint to reset user limits
#### Middleware:
* `MeteringMiddleware` - Count and log page usage for all LLM operations
### Next.js Frontend Components
* `SubscriptionStatus` - Display current usage and subscription status
* `BillingSetupForm` - Collect payment details using Stripe Elements
* `UsageLimit` - Show warnings when approaching limits
* `BillingPortal` - Entry point to Stripe Customer Portal
## Implementation Plan
### Stripe Setup
* Create Stripe Products and Prices:
  * Create a metered product in Stripe dashboard
  * Set up metered price with per-page billing
* Configure Stripe Webhook Events:
  * `customer.subscription.created`
  * `customer.subscription.updated`
  * `customer.subscription.deleted`
  * `invoice.paid`
  * `invoice.payment_failed`
### Metering Implementation
```
# FastAPI middleware for metering
class MeteringMiddleware:
    async def __call__(self, request: Request, call_next):
        # Process the request
        response = await call_next(request)
        
        # Extract user information from request
        user_id = get_user_id_from_request(request)
        
        # Count pages processed in this request
        pages_processed = extract_pages_count(request, response)
        
        if pages_processed > 0 and user_id:
            # Log usage
            await record_usage(user_id, pages_processed, "backend")
            
            # Check if user needs to upgrade
            await check_usage_limits(user_id)
            
        return response
```
### Usage Tracking Service
```
# Usage service in FastAPI
async def record_usage(user_id, pages_processed, source):
    # Log usage in MongoDB
    usage_entry = {
        "userId": user_id,
        "timestamp": datetime.utcnow(),
        "pagesProcessed": pages_processed,
        "source": source,
        "reportedToStripe": False
    }
    
    await db.usage.insert_one(usage_entry)
    
    # Update user's current usage
    await db.users.update_one(
        {"_id": user_id},
        {"$inc": {"currentMonthUsage": pages_processed}}
    )
    
    # Get user details
    user = await db.users.find_one({"_id": user_id})
    
    # If paid tier, report to Stripe
    if user["usageTier"] == "paid" and user["stripeSubscriptionId"]:
        await report_to_stripe(user["stripeSubscriptionId"], pages_processed)
        
        # Mark as reported
        await db.usage.update_one(
            {"_id": usage_entry["_id"]},
            {"$set": {"reportedToStripe": True}}
        )
```
### Stripe Customer Portal Integration
```
# API endpoint to generate customer portal link
@app.post("/api/stripe/customer-portal")
async def customer_portal(request: Request):
    user_id = get_authenticated_user_id(request)
    user = await db.users.find_one({"_id": user_id})
    
    if not user or not user.get("stripeCustomerId"):
        raise HTTPException(status_code=400, detail="No Stripe customer found")
    
    # Create a portal session
    session = stripe.billing_portal.Session.create(
        customer=user["stripeCustomerId"],
        return_url=f"{FRONTEND_URL}/account"
    )
    
    return {"url": session.url}
```
## Usage Flow
### New User Registration:
* User creates account and gets assigned to free tier
* Backend creates Stripe customer without payment method
* MongoDB records user with Stripe customer ID
### Free Tier Usage:
* User processes documents
* Backend counts pages and stores in MongoDB
* Usage displayed on dashboard with remaining free limit
### Approaching Limit:
* User receives notification when nearing free tier limit
* Dashboard displays upgrade prompt
### Payment Setup:
* User clicks "Upgrade" and enters payment details
* Stripe setup intent created and payment method attached
* Metered subscription created with Stripe
### Paid Usage:
* Backend continues counting pages
* Usage reported to Stripe via usage records
* Stripe generates invoices based on usage
### Billing Management:
* User can access Stripe Customer Portal for billing history
* Portal allows payment method updates and invoice downloads

This design provides a complete solution for implementing Stripe metered billing with MongoDB integration, while meeting all the specified requirements for DocRouter.

## Local development

* Source the venv to be able to execute the `stripe` CLI command
* `stripe listen --forward-to localhost:8000/v0/account/stripe/webhook` to forward the webhook to the local application