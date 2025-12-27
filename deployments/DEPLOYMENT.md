# Doc-Router Deployment Guide

This guide explains how to deploy doc-router on customer systems using Docker Compose or Kubernetes.

## Prerequisites

- Docker and Docker Compose (for Docker Compose deployment)
- Kubernetes cluster (for Kubernetes deployment)
- kubectl configured (for Kubernetes deployment)
- Access to pull images from Docker Hub: `analytiqhub/doc-router-frontend:latest` and `analytiqhub/doc-router-backend:latest`

## Quick Start

### Docker Compose Deployment

1. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start the services:**
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

4. **Stop the services:**
   ```bash
   docker compose -f docker-compose.production.yml down
   ```

### Kubernetes Deployment

1. **Create namespace:**
   ```bash
   kubectl apply -f deployments/kubernetes/namespace.yaml
   ```

2. **Create secrets:**
   ```bash
   # Create secret from environment variables
   kubectl create secret generic doc-router-secret \
     --from-literal=NEXTAUTH_SECRET='your-secret-here' \
     --from-literal=ADMIN_EMAIL='admin@example.com' \
     --from-literal=ADMIN_PASSWORD='your-password' \
     --from-literal=OPENAI_API_KEY='your-key' \
     --namespace=doc-router
   
   # Or edit secret.yaml.example and apply it
   # kubectl apply -f deployments/kubernetes/secret.yaml
   ```

3. **Update ConfigMap:**
   ```bash
   # Edit deployments/kubernetes/configmap.yaml with your settings
   kubectl apply -f deployments/kubernetes/configmap.yaml
   ```

4. **Deploy MongoDB:**
   ```bash
   kubectl apply -f deployments/kubernetes/mongodb.yaml
   ```

5. **Deploy Backend:**
   ```bash
   kubectl apply -f deployments/kubernetes/backend.yaml
   ```

6. **Deploy Frontend:**
   ```bash
   kubectl apply -f deployments/kubernetes/frontend.yaml
   ```

7. **Deploy Worker:**
   ```bash
   kubectl apply -f deployments/kubernetes/worker.yaml
   ```

8. **Configure Ingress (optional):**
   ```bash
   # Edit deployments/kubernetes/ingress.yaml.example
   kubectl apply -f deployments/kubernetes/ingress.yaml
   ```

## Configuration

### Environment Variables

The following environment variables are required or commonly used:

#### Required
- `NEXTAUTH_SECRET` - Secret key for NextAuth.js (generate with: `openssl rand -base64 32`)
- `MONGODB_URI` - MongoDB connection string
- `ADMIN_EMAIL` - Admin user email
- `ADMIN_PASSWORD` - Admin user password

#### Optional but Recommended
- `NEXTAUTH_URL` - Base URL for authentication (should match your frontend URL)
- `NEXT_PUBLIC_FASTAPI_FRONTEND_URL` - Backend URL as seen by frontend
- At least one LLM API key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.

#### Optional
- OAuth providers: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`
- Email: `SES_FROM_EMAIL`
- Payments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRODUCT_TAG`

See `.env.example` for a complete list of configuration options.

### MongoDB Configuration

#### Option 1: Embedded MongoDB (Docker Compose)
The `docker-compose.production.yml` includes an embedded MongoDB service. This is suitable for:
- Development and testing
- Small deployments
- Single-node deployments

#### Option 2: External MongoDB
For production deployments, use an external MongoDB instance:

1. **Docker Compose:**
   - Remove or comment out the `mongodb` service in `docker-compose.production.yml`
   - Set `MONGODB_URI` in `.env` to point to your external MongoDB

2. **Kubernetes:**
   - Remove or don't apply `mongodb.yaml`
   - Update `MONGODB_URI` in `configmap.yaml` to point to your external MongoDB

### Network Configuration

#### Docker Compose
- Services communicate via the `doc-router-network` Docker network
- Ports are exposed to the host as configured in `.env` (defaults: 3000, 8000, 27017)

#### Kubernetes
- Services communicate via ClusterIP services within the `doc-router` namespace
- Use Ingress or NodePort/LoadBalancer services to expose to external traffic
- See `ingress.yaml.example` for Ingress configuration

## Scaling

### Docker Compose
Docker Compose doesn't support native scaling. For multiple instances:
- Run multiple compose stacks on different ports
- Use an external load balancer
- Consider migrating to Kubernetes for better scaling

### Kubernetes
Scale deployments using kubectl:

```bash
# Scale frontend
kubectl scale deployment doc-router-frontend --replicas=3 -n doc-router

# Scale backend
kubectl scale deployment doc-router-backend --replicas=3 -n doc-router

# Scale workers
kubectl scale deployment doc-router-worker --replicas=2 -n doc-router
```

Or use Horizontal Pod Autoscaler:

```bash
kubectl autoscale deployment doc-router-frontend --min=2 --max=10 --cpu-percent=80 -n doc-router
kubectl autoscale deployment doc-router-backend --min=2 --max=10 --cpu-percent=80 -n doc-router
```

## Monitoring and Health Checks

### Health Endpoints
- Frontend: `http://localhost:3000/` (or your configured URL)
- Backend: `http://localhost:8000/health`

### Docker Compose Health Checks
Health checks are configured in `docker-compose.production.yml`. View status:

```bash
docker compose -f docker-compose.production.yml ps
```

### Kubernetes Health Checks
Liveness and readiness probes are configured in the deployment manifests. View status:

```bash
kubectl get pods -n doc-router
kubectl describe pod <pod-name> -n doc-router
```

## Troubleshooting

### Docker Compose

**View logs:**
```bash
docker compose -f docker-compose.production.yml logs -f
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f frontend
```

**Restart a service:**
```bash
docker compose -f docker-compose.production.yml restart backend
```

**Check service status:**
```bash
docker compose -f docker-compose.production.yml ps
```

### Kubernetes

**View logs:**
```bash
kubectl logs -f deployment/doc-router-backend -n doc-router
kubectl logs -f deployment/doc-router-frontend -n doc-router
```

**Check pod status:**
```bash
kubectl get pods -n doc-router
kubectl describe pod <pod-name> -n doc-router
```

**Restart a deployment:**
```bash
kubectl rollout restart deployment/doc-router-backend -n doc-router
```

**Common issues:**
- **Pods in CrashLoopBackOff:** Check logs and verify environment variables are set correctly
- **Services not accessible:** Verify service selectors match pod labels
- **MongoDB connection issues:** Verify `MONGODB_URI` is correct and MongoDB is accessible

## Updating

### Docker Compose

1. Pull latest images:
   ```bash
   docker compose -f docker-compose.production.yml pull
   ```

2. Restart services:
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

### Kubernetes

1. Update image tag in deployment manifests (or use `latest`)

2. Apply changes:
   ```bash
   kubectl apply -f deployments/kubernetes/
   ```

3. Force rollout (if needed):
   ```bash
   kubectl rollout restart deployment/doc-router-backend -n doc-router
   kubectl rollout restart deployment/doc-router-frontend -n doc-router
   ```

## Backup and Restore

### MongoDB Backup

**Docker Compose:**
```bash
docker compose -f docker-compose.production.yml exec mongodb mongodump --out /data/backup
docker compose -f docker-compose.production.yml exec mongodb tar czf /data/backup.tar.gz /data/backup
docker cp doc-router-mongodb:/data/backup.tar.gz ./backup.tar.gz
```

**Kubernetes:**
```bash
kubectl exec -it deployment/doc-router-mongodb -n doc-router -- mongodump --out /data/backup
kubectl exec -it deployment/doc-router-mongodb -n doc-router -- tar czf /data/backup.tar.gz /data/backup
kubectl cp doc-router/doc-router-mongodb-<pod-id>:/data/backup.tar.gz ./backup.tar.gz
```

### MongoDB Restore

**Docker Compose:**
```bash
docker cp ./backup.tar.gz doc-router-mongodb:/data/
docker compose -f docker-compose.production.yml exec mongodb tar xzf /data/backup.tar.gz -C /data
docker compose -f docker-compose.production.yml exec mongodb mongorestore /data/backup
```

**Kubernetes:**
```bash
kubectl cp ./backup.tar.gz doc-router/doc-router-mongodb-<pod-id>:/data/
kubectl exec -it deployment/doc-router-mongodb -n doc-router -- tar xzf /data/backup.tar.gz -C /data
kubectl exec -it deployment/doc-router-mongodb -n doc-router -- mongorestore /data/backup
```

## Security Considerations

1. **Change default passwords:** Always change `ADMIN_PASSWORD` and `MONGO_ROOT_PASSWORD`
2. **Use strong secrets:** Generate strong `NEXTAUTH_SECRET` values
3. **Secure MongoDB:** Use authentication and restrict network access
4. **Use HTTPS:** Configure TLS/SSL for production deployments
5. **Limit API keys:** Only provide necessary API keys
6. **Network policies:** In Kubernetes, consider using NetworkPolicies to restrict traffic
7. **Secrets management:** Use Kubernetes secrets or external secret management systems

## Support

For issues and questions:
- Check logs first
- Review configuration
- Consult the main documentation in `/docs`
- Open an issue on GitHub

