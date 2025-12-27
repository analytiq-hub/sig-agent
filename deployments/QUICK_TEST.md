# Quick Testing Guide

This guide shows you the fastest ways to test doc-router deployments.

## Option 1: Docker Compose (Fastest - ~5 minutes)

**Best for:** Quick local testing, development, and validation

### Steps:

1. **Create minimal .env file:**
   ```bash
   cat > .env << EOF
   ENV=dev
   MONGODB_URI=mongodb://admin:admin@mongodb:27017?authSource=admin
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   ADMIN_EMAIL=admin@test.com
   ADMIN_PASSWORD=test123
   NEXT_PUBLIC_FASTAPI_FRONTEND_URL=http://localhost:8000
   OPENAI_API_KEY=your-key-here
   EOF
   ```

2. **Start services:**
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

3. **Wait for services (30-60 seconds):**
   ```bash
   docker compose -f docker-compose.production.yml ps
   # Wait until all services show "healthy" or "Up"
   ```

4. **Test:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/docs
   - Health check: http://localhost:8000/health

5. **View logs:**
   ```bash
   docker compose -f docker-compose.production.yml logs -f
   ```

6. **Stop:**
   ```bash
   docker compose -f docker-compose.production.yml down
   ```

**Time to test:** ~5 minutes

---

## Option 2: Local Kubernetes (Medium - ~15 minutes)

**Best for:** Testing Kubernetes manifests before deploying to cloud

**Linux Prerequisites:**
- Docker installed and running (for kind/k3d)
- OR VirtualBox/KVM installed (for minikube)
- kubectl installed
- At least 4GB RAM available
- 20GB free disk space

### Option 2A: Using kind (Kubernetes in Docker)

1. **Install kind:**
   ```bash
   # Download kind binary
   curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
   chmod +x ./kind
   sudo mv ./kind /usr/local/bin/kind
   
   # Verify installation
   kind version
   ```
   
   **Note:** Requires Docker to be installed and running. Install Docker with:
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y docker.io
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker $USER
   # Log out and back in for group changes to take effect
   ```

2. **Create cluster:**
   ```bash
   kind create cluster --name doc-router-test
   ```

3. **Deploy:**
   ```bash
   cd deployments/kubernetes
   kubectl apply -f namespace.yaml
   
   # Create minimal secret
   kubectl create secret generic doc-router-secret \
     --from-literal=NEXTAUTH_SECRET=$(openssl rand -base64 32) \
     --from-literal=ADMIN_EMAIL=admin@test.com \
     --from-literal=ADMIN_PASSWORD=test123 \
     --from-literal=OPENAI_API_KEY=your-key \
     --namespace=doc-router
   
   kubectl apply -f configmap.yaml
   kubectl apply -f mongodb.yaml
   kubectl apply -f backend.yaml
   kubectl apply -f frontend.yaml
   kubectl apply -f worker.yaml
   ```

4. **Port forward to access:**
   ```bash
   # Start port forwarding in background
   kubectl port-forward -n doc-router svc/doc-router-frontend 3000:3000 &
   kubectl port-forward -n doc-router svc/doc-router-backend 8000:8000 &
   
   # Or run in separate terminals to see logs:
   # Terminal 1:
   kubectl port-forward -n doc-router svc/doc-router-frontend 3000:3000
   
   # Terminal 2:
   kubectl port-forward -n doc-router svc/doc-router-backend 8000:8000
   ```
   
   **Note:** Port forwarding will block the terminal. Press Ctrl+C to stop, or run in background with `&`.

5. **Test:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000/docs

6. **Cleanup:**
   ```bash
   kind delete cluster --name doc-router-test
   ```

**Time to test:** ~15 minutes

### Option 2B: Using minikube

1. **Install minikube:**
   ```bash
   # Download minikube binary
   curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
   sudo install minikube-linux-amd64 /usr/local/bin/minikube
   
   # Verify installation
   minikube version
   ```

2. **Install a driver (choose one):**
   
   **Option A: Docker (recommended, if Docker is installed):**
   ```bash
   minikube start --driver=docker
   ```
   
   **Option B: KVM2 (for better performance):**
   ```bash
   # Install KVM2 driver
   curl -LO https://storage.googleapis.com/minikube/releases/latest/docker-machine-driver-kvm2
   chmod +x docker-machine-driver-kvm2
   sudo mv docker-machine-driver-kvm2 /usr/local/bin/
   
   # Install KVM packages (Ubuntu/Debian)
   sudo apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils
   sudo usermod -aG libvirt $USER
   # Log out and back in
   
   minikube start --driver=kvm2
   ```
   
   **Option C: VirtualBox:**
   ```bash
   # Install VirtualBox
   sudo apt-get install -y virtualbox
   
   minikube start --driver=virtualbox
   ```

3. **Start minikube:**
   ```bash
   minikube start
   ```
   
   **Note:** First start may take a few minutes as it downloads the VM image.

3. **Follow steps 3-5 from kind above**

4. **Cleanup:**
   ```bash
   minikube delete
   ```

**Time to test:** ~15 minutes

### Option 2C: Using k3d (Lightweight)

1. **Install k3d:**
   ```bash
   # Download and install k3d
   curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
   
   # Or install manually
   wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
   
   # Verify installation
   k3d version
   ```
   
   **Note:** Requires Docker to be installed and running.

2. **Create cluster:**
   ```bash
   k3d cluster create doc-router-test
   ```

3. **Follow steps 3-5 from kind above**

4. **Cleanup:**
   ```bash
   k3d cluster delete doc-router-test
   ```

**Time to test:** ~15 minutes

---

## Option 3: AWS EKS (Production-like - ~30 minutes)

**Best for:** Production testing, AWS integration validation

### Prerequisites:
- AWS CLI configured
- `eksctl` installed
- AWS account with appropriate permissions

### Steps:

1. **Install eksctl:**
   ```bash
   # Download and install eksctl
   ARCH=amd64
   PLATFORM=$(uname -s)_$ARCH
   curl -sLO "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$PLATFORM.tar.gz"
   tar -xzf eksctl_$PLATFORM.tar.gz -C /tmp && rm eksctl_$PLATFORM.tar.gz
   sudo mv /tmp/eksctl /usr/local/bin
   
   # Verify installation
   eksctl version
   ```
   
   **Prerequisites:** 
   - AWS CLI must be installed and configured
   - kubectl should be installed (eksctl will use it)

2. **Create EKS cluster:**
   ```bash
   eksctl create cluster \
     --name doc-router-test \
     --region us-west-2 \
     --node-type t3.medium \
     --nodes 2 \
     --nodes-min 1 \
     --nodes-max 3 \
     --managed
   ```
   
   This takes ~15-20 minutes.

3. **Update kubeconfig:**
   ```bash
   aws eks update-kubeconfig --name doc-router-test --region us-west-2
   ```

4. **Deploy doc-router:**
   ```bash
   cd deployments/kubernetes
   
   # Create secrets (use AWS Secrets Manager or kubectl)
   kubectl create secret generic doc-router-secret \
     --from-literal=NEXTAUTH_SECRET=$(openssl rand -base64 32) \
     --from-literal=ADMIN_EMAIL=admin@test.com \
     --from-literal=ADMIN_PASSWORD=test123 \
     --from-literal=OPENAI_API_KEY=your-key \
     --namespace=doc-router
   
   kubectl apply -f namespace.yaml
   kubectl apply -f configmap.yaml
   kubectl apply -f mongodb.yaml
   kubectl apply -f backend.yaml
   kubectl apply -f frontend.yaml
   kubectl apply -f worker.yaml
   ```

5. **Expose services:**

   **Option A: LoadBalancer (easiest):**
   ```bash
   # Edit frontend.yaml and backend.yaml to use LoadBalancer
   kubectl patch svc doc-router-frontend -n doc-router -p '{"spec":{"type":"LoadBalancer"}}'
   kubectl patch svc doc-router-backend -n doc-router -p '{"spec":{"type":"LoadBalancer"}}'
   
   # Get external IPs
   kubectl get svc -n doc-router
   ```

   **Option B: Ingress (recommended for production):**
   ```bash
   # Install NGINX Ingress Controller
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/aws/deploy.yaml
   
   # Edit and apply ingress.yaml
   kubectl apply -f ingress.yaml
   ```

6. **Test:**
   - Use the LoadBalancer URLs or Ingress domain
   - Frontend: http://<loadbalancer-url>:3000
   - Backend: http://<loadbalancer-url>:8000/docs

7. **Cleanup:**
   ```bash
   eksctl delete cluster --name doc-router-test --region us-west-2
   ```

**Time to test:** ~30 minutes (mostly cluster creation)

**Cost:** ~$0.20-0.50/hour while running (2x t3.medium nodes)

---

## Option 4: AWS EKS with Terraform (Advanced)

For production deployments, consider using Terraform to manage EKS infrastructure.

See `deployments/terraform/` (if created) for infrastructure-as-code approach.

---

## Quick Validation Script

Run this to quickly validate your deployment:

```bash
#!/bin/bash
# Quick validation script

echo "Testing doc-router deployment..."

# Test backend health
BACKEND_URL=${BACKEND_URL:-http://localhost:8000}
echo "Testing backend at $BACKEND_URL..."
if curl -f -s "$BACKEND_URL/health" > /dev/null; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend health check failed"
    exit 1
fi

# Test frontend
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
echo "Testing frontend at $FRONTEND_URL..."
if curl -f -s "$FRONTEND_URL" > /dev/null; then
    echo "✓ Frontend is accessible"
else
    echo "✗ Frontend is not accessible"
    exit 1
fi

# Test API docs
if curl -f -s "$BACKEND_URL/docs" > /dev/null; then
    echo "✓ API documentation is accessible"
else
    echo "✗ API documentation is not accessible"
    exit 1
fi

echo "All checks passed! ✓"
```

---

## Comparison

| Method | Setup Time | Cost | Best For |
|--------|-----------|------|----------|
| Docker Compose | ~5 min | Free | Quick local testing |
| kind/minikube/k3d | ~15 min | Free | K8s manifest testing |
| AWS EKS | ~30 min | ~$0.20-0.50/hr | Production testing |
| EKS + Terraform | ~45 min | ~$0.20-0.50/hr | Production deployment |

---

## Troubleshooting

### Docker Compose
- **Services not starting:** Check logs with `docker compose logs`
- **Port conflicts:** Change ports in `.env` file
- **MongoDB connection issues:** Verify `MONGODB_URI` matches service name

### Kubernetes
- **Pods not starting:** Check with `kubectl describe pod <pod-name> -n doc-router`
- **Image pull errors:** Verify images exist: `docker pull analytiqhub/doc-router-frontend:latest`
- **Service not accessible:** Check service endpoints: `kubectl get endpoints -n doc-router`

### AWS EKS
- **Cluster creation fails:** Check IAM permissions
- **Nodes not joining:** Check node group configuration
- **LoadBalancer stuck:** Check AWS service quotas

---

## Next Steps

After successful testing:
1. Review logs for any warnings
2. Test authentication flow
3. Upload a test document
4. Verify MongoDB persistence
5. Test scaling (Kubernetes only)

