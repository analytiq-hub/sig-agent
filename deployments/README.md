# Doc-Router Deployment Files

This directory contains deployment configurations for doc-router.

## Directory Structure

```
deployments/
├── README.md                    # This file
├── DEPLOYMENT.md                # Complete deployment guide
└── kubernetes/
    ├── namespace.yaml           # Kubernetes namespace
    ├── configmap.yaml           # Non-sensitive configuration
    ├── secret.yaml.example      # Template for secrets (copy and customize)
    ├── mongodb.yaml             # MongoDB deployment and service
    ├── backend.yaml             # Backend API deployment and service
    ├── frontend.yaml            # Frontend deployment and service
    ├── worker.yaml              # Worker deployment
    └── ingress.yaml.example     # Ingress configuration template
```

## Quick Links

- **Docker Compose:** See `../docker-compose.production.yml` in the root directory
- **Full Deployment Guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Environment Variables:** See `../.env.example` in the root directory (or create from template below)

## Quick Start

### Docker Compose

1. Create `.env` file in the project root:
   ```bash
   # Copy the template below or see ../.env.example
   cp ../.env.example .env
   # Edit .env with your settings
   ```

2. Start services:
   ```bash
   docker compose -f ../docker-compose.production.yml up -d
   ```

### Kubernetes

1. Create namespace:
   ```bash
   kubectl apply -f kubernetes/namespace.yaml
   ```

2. Create secrets:
   ```bash
   kubectl create secret generic doc-router-secret \
     --from-literal=NEXTAUTH_SECRET='your-secret' \
     --from-literal=ADMIN_EMAIL='admin@example.com' \
     --from-literal=ADMIN_PASSWORD='your-password' \
     --namespace=doc-router
   ```

3. Deploy all components:
   ```bash
   kubectl apply -f kubernetes/configmap.yaml
   kubectl apply -f kubernetes/mongodb.yaml
   kubectl apply -f kubernetes/backend.yaml
   kubectl apply -f kubernetes/frontend.yaml
   kubectl apply -f kubernetes/worker.yaml
   ```

## Environment Variables Template

Create a `.env` file in the project root with the following variables:

```bash
# Core Configuration
ENV=prod
MONGODB_URI=mongodb://admin:admin@mongodb:27017?authSource=admin
FASTAPI_ROOT_PATH=/fastapi

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password

# Frontend
NEXT_PUBLIC_FASTAPI_FRONTEND_URL=http://localhost:8000

# LLM API Keys (at least one required)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=

# Optional: OAuth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Optional: AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=

# Optional: Email & Payments
SES_FROM_EMAIL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRODUCT_TAG=
```

## Image Sources

The deployment configurations use pre-built images from Docker Hub:
- `analytiqhub/doc-router-frontend:latest`
- `analytiqhub/doc-router-backend:latest`

Make sure these images are available or update the image references in the deployment files.

## Support

For detailed deployment instructions, troubleshooting, and configuration options, see [DEPLOYMENT.md](./DEPLOYMENT.md).

