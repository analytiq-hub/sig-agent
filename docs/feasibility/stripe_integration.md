# System Design: Stripe Payment Integration for DocRouter
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
* One product with three tiers:
  * __DocRouterBasic__
  * __DocRouterTeams__
  * __DocRouterEnterprise__

### System Design
* When a user is registered, or unregistered, it is added or removed from Stripe
* On startup, `sync_customers()` is called to sync the users in Mongo with those in Stripe
* Initially, customers are placed in the free tier, and have a limited number of APIs they can call.
* Admins are always on the free tier, with no limit. They can increase the free tier limit for a user.
* Users can go on the Settings page, and subscribe to one of the products - Basic, Teams or Enterprise. 
  * They will be charged monthly
  * The Settings page calls `/customer_portal` FastAPI to redirect to the Stripe portal
* When subscription is complete, Stripe calls the `/web_hook`, so DocRouter can update the customer table with subscription information.
* LLM calls check the subscription, and either decrease the free tier credit, or increase the meter. 

## Local development
* Source the `.venv` to be able to execute the `stripe` CLI command
* `stripe listen --forward-to localhost:8000/v0/account/stripe/webhook` to forward the webhook to the local application