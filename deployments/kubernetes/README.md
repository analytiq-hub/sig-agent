# Kubernetes Deployment Files

This directory contains Kubernetes manifests for deploying doc-router.

## Files

- **namespace.yaml** - Creates the `doc-router` namespace
- **configmap.yaml** - Non-sensitive configuration (edit before applying)
- **secret.yaml.example** - Template for secrets (create your own secret.yaml)
- **mongodb.yaml** - MongoDB deployment with persistent storage
- **backend.yaml** - Backend API deployment and service
- **frontend.yaml** - Frontend deployment and service
- **worker.yaml** - Background worker deployment
- **ingress.yaml.example** - Ingress configuration template

## Deployment Order

1. **Namespace:**
   ```bash
   kubectl apply -f namespace.yaml
   ```

2. **Secrets:**
   ```bash
   # Option 1: Create from command line
   kubectl create secret generic doc-router-secret \
     --from-literal=NEXTAUTH_SECRET='your-secret' \
     --from-literal=ADMIN_EMAIL='admin@example.com' \
     --from-literal=ADMIN_PASSWORD='your-password' \
     --namespace=doc-router
   
   # Option 2: Create from file (edit secret.yaml.example first)
   kubectl apply -f secret.yaml
   ```

3. **ConfigMap:**
   ```bash
   # Edit configmap.yaml with your settings first
   kubectl apply -f configmap.yaml
   ```

4. **MongoDB:**
   ```bash
   kubectl apply -f mongodb.yaml
   # Wait for MongoDB to be ready
   kubectl wait --for=condition=ready pod -l app=doc-router-mongodb -n doc-router --timeout=300s
   ```

5. **Backend:**
   ```bash
   kubectl apply -f backend.yaml
   ```

6. **Frontend:**
   ```bash
   kubectl apply -f frontend.yaml
   ```

7. **Worker:**
   ```bash
   kubectl apply -f worker.yaml
   ```

7. **Ingress (optional):**
   ```bash
   # Edit ingress.yaml.example first
   kubectl apply -f ingress.yaml
   ```

## All-in-One Deployment

To deploy everything at once (after editing configmap.yaml and creating secrets):

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f mongodb.yaml
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
kubectl apply -f worker.yaml
```

## Verification

Check deployment status:

```bash
# Check all resources
kubectl get all -n doc-router

# Check pods
kubectl get pods -n doc-router

# Check services
kubectl get svc -n doc-router

# Check logs
kubectl logs -f deployment/doc-router-backend -n doc-router
kubectl logs -f deployment/doc-router-frontend -n doc-router
```

## Customization

### Update ConfigMap

Edit `configmap.yaml` and reapply:
```bash
kubectl apply -f configmap.yaml
kubectl rollout restart deployment/doc-router-backend -n doc-router
kubectl rollout restart deployment/doc-router-frontend -n doc-router
```

### Update Secrets

Edit secrets and restart deployments:
```bash
kubectl create secret generic doc-router-secret \
  --from-literal=NEW_KEY='new-value' \
  --namespace=doc-router \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/doc-router-backend -n doc-router
```

### Scaling

```bash
kubectl scale deployment doc-router-backend --replicas=3 -n doc-router
kubectl scale deployment doc-router-frontend --replicas=3 -n doc-router
kubectl scale deployment doc-router-worker --replicas=2 -n doc-router
```

## Troubleshooting

See the main [DEPLOYMENT.md](../DEPLOYMENT.md) guide for troubleshooting steps.

