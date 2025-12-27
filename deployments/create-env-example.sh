#!/bin/bash
# Script to create .env.example file from template
# This creates a template that customers can copy to .env

cat > ../.env.example << 'EOF'
# Doc-Router Environment Configuration
# Copy this file to .env and configure your settings

# =============================================================================
# Core Application Configuration
# =============================================================================

# Environment: dev, prod, or test
ENV=prod

# MongoDB Connection String
# For embedded MongoDB: mongodb://admin:admin@mongodb:27017?authSource=admin
# For external MongoDB: mongodb://username:password@host:port/database?authSource=admin
MONGODB_URI=mongodb://admin:admin@mongodb:27017?authSource=admin

# FastAPI root path (useful for reverse proxies)
FASTAPI_ROOT_PATH=/fastapi

# =============================================================================
# Authentication & NextAuth Configuration
# =============================================================================

# Base URL for NextAuth.js (must match your frontend URL)
NEXTAUTH_URL=http://localhost:3000

# Secret key for NextAuth.js session encryption (REQUIRED - generate a secure random string)
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-nextauth-secret-here-change-this-in-production

# GitHub OAuth (optional)
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Google OAuth (optional)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# =============================================================================
# Frontend Configuration
# =============================================================================

# URL for the FastAPI backend as seen by the frontend
NEXT_PUBLIC_FASTAPI_FRONTEND_URL=http://localhost:8000

# =============================================================================
# AWS Configuration (optional)
# =============================================================================

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=analytiq-data

# =============================================================================
# LLM Provider API Keys (at least one required)
# =============================================================================

# OpenAI
OPENAI_API_KEY=

# Anthropic (Claude)
ANTHROPIC_API_KEY=

# Google Gemini
GEMINI_API_KEY=

# Groq
GROQ_API_KEY=

# Mistral AI
MISTRAL_API_KEY=

# =============================================================================
# Email Configuration (optional)
# =============================================================================

# AWS SES sender email address
SES_FROM_EMAIL=

# =============================================================================
# Payment Configuration - Stripe (optional)
# =============================================================================

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRODUCT_TAG=

# =============================================================================
# System Administration
# =============================================================================

# Default admin user email
ADMIN_EMAIL=admin@example.com

# Default admin user password (change this!)
ADMIN_PASSWORD=change-this-password

# =============================================================================
# Worker Configuration
# =============================================================================

# Number of worker processes
N_WORKERS=1

# =============================================================================
# CORS Configuration
# =============================================================================

# Comma-separated list of allowed CORS origins
# Default: http://localhost:3000,http://127.0.0.1:3000,http://host.docker.internal:3000
CORS_ORIGINS=

# =============================================================================
# Port Configuration (for docker-compose)
# =============================================================================

# Frontend port (default: 3000)
FRONTEND_PORT=3000

# Backend port (default: 8000)
BACKEND_PORT=8000

# OTLP port for telemetry (default: 4317)
OTLP_PORT=4317

# MongoDB port (default: 27017)
MONGODB_PORT=27017

# =============================================================================
# MongoDB Configuration (for embedded MongoDB)
# =============================================================================

MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=admin
EOF

echo ".env.example file created successfully!"
echo "You can now copy it to .env and configure your settings:"
echo "  cp .env.example .env"

