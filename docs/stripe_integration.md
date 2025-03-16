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
-Implement per-page metering for all LLM-processed document pages
-Count pages processed across both frontend and backend operations
-Apply different rates for different types of operations if needed
### User Tiers
- __Free Tier__: Limited number of pages per month (e.g., 50 pages)
- __Paid Tier__: Unlimited pages at a metered rate (e.g., $0.01 per page)
### Payment Processing
-Collect and securely store payment details through Stripe
-Process automatic payments based on usage
-Provide receipts and invoices for all transactions
### Usage Monitoring
-Track and display current usage to users
-Send notifications when approaching free tier limits
-Provide usage forecasting based on current patterns

# Technical Requirements
## Stripe Integration
-Implement Stripe Customer portal
-Configure Stripe metered billing products
-Set up webhook handlers for Stripe events
## MongoDB Integration
-Store user Stripe customer IDs in MongoDB
-Cache and track usage metrics in MongoDB
-Maintain billing and subscription status in user records
## FastAPI Implementation
-Create endpoints for Stripe operations
-Implement page counting middleware for all LLM operations
-Handle usage limit enforcement
## Security
-Secure handling of Stripe API keys
-PCI compliance for payment processing
-Protection of user payment and billing data

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
2.1 Stripe Integration
Stripe Customer Management: Create and manage Stripe customers
Subscription Management: Handle metered subscription lifecycle
Usage Reporting: Report usage to Stripe for billing
Webhook Handler: Process Stripe events (payment success/failure, etc.)
2.2 MongoDB Schema
2.3 FastAPI Backend Components
API Endpoints:
/api/stripe/create-customer - Create a new Stripe customer
/api/stripe/setup-intent - Generate a setup intent for collecting payment
/api/stripe/create-subscription - Create a metered subscription
/api/stripe/customer-portal - Generate a link to Stripe Customer Portal
/api/stripe/webhook - Handle Stripe webhook events
/api/usage/stats - Get current usage statistics
/api/usage/reset-limit - Admin endpoint to reset user limits
Middleware:
MeteringMiddleware - Count and log page usage for all LLM operations
2.4 Next.js Frontend Components
SubscriptionStatus - Display current usage and subscription status
BillingSetupForm - Collect payment details using Stripe Elements
UsageLimit - Show warnings when approaching limits
BillingPortal - Entry point to Stripe Customer Portal
3. Implementation Plan
3.1 Stripe Setup
Create Stripe Products and Prices:
Create a metered product in Stripe dashboard
Set up metered price with per-page billing
Configure Stripe Webhook Events:
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
3.2 Metering Implementation
3.3 Usage Tracking Service
3.4 Stripe Customer Portal Integration
4. Usage Flow
New User Registration:
User creates account and gets assigned to free tier
Backend creates Stripe customer without payment method
MongoDB records user with Stripe customer ID
Free Tier Usage:
User processes documents
Backend counts pages and stores in MongoDB
Usage displayed on dashboard with remaining free limit
Approaching Limit:
User receives notification when nearing free tier limit
Dashboard displays upgrade prompt
Payment Setup:
User clicks "Upgrade" and enters payment details
Stripe setup intent created and payment method attached
Metered subscription created with Stripe
Paid Usage:
Backend continues counting pages
Usage reported to Stripe via usage records
Stripe generates invoices based on usage
Billing Management:
User can access Stripe Customer Portal for billing history
Portal allows payment method updates and invoice downloads
This design provides a complete solution for implementing Stripe metered billing with MongoDB integration, while meeting all the specified requirements for DocRouter.
