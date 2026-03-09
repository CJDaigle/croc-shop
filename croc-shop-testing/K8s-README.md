# Kubernetes JMeter Load Testing

## Overview

This setup deploys JMeter load testing directly inside the Kubernetes cluster, routing all traffic through the Cilium Gateway API using the hostname `testing.apo-llm-test.com`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   JMeter    │    │   Gateway   │    │  Services   │      │
│  │     Pod     │───▶│   (Cilium)  │───▶│ (Croc-Shop) │      │
│  │             │    │             │    │             │      │
│  │ testing     │    │ testing.    │    │ user:3002   │      │
│  │ namespace   │    │ apo-llm-     │    │ prod:3001   │      │
│  │             │    │ test.com    │    │ cart:3003   │      │
│  └─────────────┘    └─────────────┘    │ order:3004  │      │
│                                     └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Cluster-Native Testing**: JMeter runs inside the cluster
- **Gateway Routing**: All traffic routes through `testing.apo-llm-test.com`
- **HTTPS/TLS**: Automatic certificate management with cert-manager
- **Isolated Namespace**: Dedicated `testing` namespace
- **Job-Based**: Runs as Kubernetes Job for proper lifecycle management
- **Results Collection**: Automatic result collection and storage

## Prerequisites

### Cluster Requirements
- **Kubernetes**: v1.24+ with Gateway API support
- **Cilium**: CNI with Gateway API enabled
- **cert-manager**: For automatic TLS certificates (optional)
- **Domain**: `testing.apo-llm-test.com` pointing to cluster

### Service Requirements
- **Croc-Shop services** deployed in their namespaces:
  - `user` service in `croc-shop-user` namespace
  - `product-catalog` service in `croc-shop-product-catalog` namespace
  - `cart` service in `croc-shop-cart` namespace
  - `order` service in `croc-shop-order` namespace

## Quick Start

### 1. Deploy the Test

```bash
cd croc-shop/test

# Deploy everything (default command)
./deploy-k8s.sh

# Or explicitly
./deploy-k8s.sh deploy
```

### 2. Monitor Progress

```bash
# Check deployment status
./deploy-k8s.sh status

# Watch the test job
kubectl logs -f job/jmeter-load-test -n testing
```

### 3. View Results

```bash
# Show test results
./deploy-k8s.sh results

# Results are also copied to ./results-YYYYMMDD-HHMMSS/
```

## Configuration

### Test Parameters

Edit `k8s/configmap.yaml` to modify test settings:

```yaml
data:
  test.properties: |
    NUM_CUSTOMERS=100          # Number of customers to create
    ORDERS_PER_CUSTOMER=10     # Orders each customer places
    THREADS=10                 # Concurrent threads
    RAMP_TIME=10               # Ramp-up time in seconds
```

### Gateway Configuration

Edit `k8s/gateway.yaml` to modify routing:

```yaml
spec:
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      certificateRefs:
      - name: testing-apo-llm-test-com-tls
```

### Service Routes

The gateway routes these paths:

| Gateway Path | Target Service | Namespace |
|---------------|----------------|-----------|
| `/user-service/*` | `user:3002` | `croc-shop-user` |
| `/product-service/*` | `product-catalog:3001` | `croc-shop-product-catalog` |
| `/cart-service/*` | `cart:3003` | `croc-shop-cart` |
| `/order-service/*` | `order:3004` | `croc-shop-order` |
| `/chatbot-service/*` | `chatbot:3005` | `croc-shop-chatbot` |

## URL Mappings

The JMeter test uses these final URLs:

- **Customer Creation**: `https://testing.apo-llm-test.com/user-service/customers` (POST)
- **Product Catalog**: `https://testing.apo-llm-test.com/product-service/products` (GET)
- **Order Placement**: `https://testing.apo-llm-test.com/order-service/orders` (POST)

## File Structure

```
k8s/
├── namespace.yaml      # Namespace, RBAC, ServiceAccount
├── configmap.yaml      # JMeter configuration and scripts
├── jmx-configmap.yaml  # JMeter test plan
├── gateway.yaml        # Gateway API configuration
├── secrets.yaml        # TLS certificates and kubeconfig
├── jmeter-pod.yaml     # JMeter Pod and Job definitions
└── kubeconfig-secret.yaml # Generated kubeconfig secret

deploy-k8s.sh           # Deployment script
```

## Deployment Components

### Namespace & RBAC
- **Namespace**: `testing` with appropriate labels
- **ServiceAccount**: `jmeter-test-sa` for pod execution
- **ClusterRole**: Permissions to access services and endpoints
- **ClusterRoleBinding**: Links service account to permissions

### Gateway Configuration
- **Gateway**: `testing-gateway` with HTTPS listener
- **HTTPRoutes**: Service-specific routing rules
- **Certificate**: Auto-generated TLS certificate
- **URL Rewriting**: Path prefix matching and rewriting

### JMeter Configuration
- **ConfigMap**: Test parameters and execution script
- **JMX ConfigMap**: Load test plan with gateway URLs
- **Job**: Kubernetes Job for test execution
- **Results**: Automatic result collection

## Monitoring and Debugging

### Check Deployment Status

```bash
# Overall status
./deploy-k8s.sh status

# Gateway status
kubectl get gateway testing-gateway -n testing -o wide

# HTTPRoute status
kubectl get httproute -n testing

# Certificate status
kubectl get certificate testing-apo-llm-test-com-tls -n testing

# Job status
kubectl get job jmeter-load-test -n testing

# Pod logs
kubectl logs -f job/jmeter-load-test -n testing
```

### Common Issues

#### Gateway Not Ready
```bash
# Check GatewayClass
kubectl get gatewayclass cilium

# Check Gateway status
kubectl describe gateway testing-gateway -n testing

# Check Cilium logs
kubectl logs -n kube-system -l k8s-app=cilium
```

#### Certificate Issues
```bash
# Check cert-manager
kubectl get pods -n cert-manager

# Check certificate status
kubectl describe certificate testing-apo-llm-test-com-tls -n testing

# Check CertificateRequest
kubectl get certificaterequest -n testing
```

#### Test Failures
```bash
# Check pod logs
kubectl logs job/jmeter-load-test -n testing

# Check service connectivity
kubectl exec -it job/jmeter-load-test -n testing -- curl -k https://testing.apo-llm-test.com/user-service/health

# Check network policies
kubectl get networkpolicy -n testing
kubectl get networkpolicy -n croc-shop-user
```

## Customization

### Scaling Tests

Modify test parameters in `k8s/configmap.yaml`:

```yaml
data:
  test.properties: |
    NUM_CUSTOMERS=500          # More customers
    ORDERS_PER_CUSTOMER=20     # More orders per customer
    THREADS=20                 # More concurrent threads
    RAMP_TIME=30               # Slower ramp-up
```

### Adding Services

1. Add new HTTPRoute in `k8s/gateway.yaml`
2. Update JMX paths in `k8s/jmx-configmap.yaml`
3. Redeploy with `./deploy-k8s.sh deploy`

### Custom Domains

1. Update domain in `k8s/gateway.yaml` and `k8s/secrets.yaml`
2. Update DNS to point to cluster
3. Redeploy gateway configuration

## Security Considerations

- **Network Policies**: Consider adding network policies for the testing namespace
- **RBAC**: Service account has minimal required permissions
- **TLS**: All traffic encrypted with TLS certificates
- **Data Privacy**: All test data is fake/test data only
- **Resource Limits**: Pod has resource limits to prevent cluster impact

## Cleanup

```bash
# Remove all testing resources
./deploy-k8s.sh cleanup

# Or manually
kubectl delete namespace testing --ignore-not-found=true
```

## Advanced Usage

### Manual Test Execution

```bash
# Create just the pod for manual testing
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/jmx-configmap.yaml
kubectl apply -f k8s/jmeter-pod.yaml

# Exec into pod and run tests manually
kubectl exec -it jmeter-test-pod -n testing -- /bin/bash
cd /opt/jmeter
./run-test.sh
```

### Custom Test Plans

1. Create new JMX file
2. Update `k8s/jmx-configmap.yaml`
3. Redeploy configuration

### Integration with CI/CD

```bash
# In CI/CD pipeline
./deploy-k8s.sh deploy
./deploy-k8s.sh results

# Check exit code for test success/failure
if [[ $? -eq 0 ]]; then
    echo "Tests passed"
else
    echo "Tests failed"
    exit 1
fi
```

## Troubleshooting

### DNS Resolution
```bash
# Check if domain resolves
nslookup testing.apo-llm-test.com

# Check from within cluster
kubectl run -it --rm dns-test --image=busybox --restart=Never -- nslookup testing.apo-llm-test.com
```

### Service Connectivity
```bash
# Test service endpoints from cluster
kubectl run -it --rm test-pod --image=curlimages/curl --restart=Never -- \
  curl -k https://testing.apo-llm-test.com/user-service/health
```

### Gateway Configuration
```bash
# Validate gateway configuration
kubectl get gateway testing-gateway -n testing -o yaml

# Check HTTPRoute status
kubectl get httproute -n testing -o yaml
```

This Kubernetes-native setup provides a robust, scalable load testing solution that leverages the cluster's networking capabilities while maintaining proper isolation and security.
