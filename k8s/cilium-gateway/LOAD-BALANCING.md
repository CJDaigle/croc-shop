# Cilium Gateway API Load Balancing Guide

This guide explains how Cilium Gateway API load balancing works and provides step-by-step instructions for setting up external access with TLS for services.

## Overview

Cilium Gateway API provides layer 7 load balancing with TLS termination using Envoy proxies running on dedicated gateway nodes. Traffic flows:

```
Internet → DNS (example.com) → Gateway Nodes (hostNetwork)
                                      │
                                Cilium Gateway API (Envoy)
                                      │
                              HTTPRoute path matching
                                      │
                              Backend Services (ClusterIP)
```

## Architecture Components

### 1. Gateway Nodes
- **Dedicated nodes** labeled `role=gateway` with taint `role=gateway:NoSchedule`
- **Internal IPs**: 10.0.1.112, 10.0.1.169
- **Public IPs**: 18.217.133.0, 18.216.67.132
- **hostNetwork mode**: Envoy binds directly to node ports 80/443

### 2. CiliumLoadBalancerIPPool
- **Purpose**: Provides IP addresses for Gateway LoadBalancer services
- **Configuration**: Maps gateway node internal IPs to LoadBalancer services
- **Result**: Gateway Service gets real node IPs instead of placeholder

### 3. Gateway Resource
- **Type**: `gateway.networking.k8s.io/v1`
- **Listeners**: HTTP (port 80) and HTTPS (port 443) per hostname
- **TLS**: Termination mode with certificate references
- **Class**: `cilium` (provided by Cilium CNI)

### 4. HTTPRoute Resource
- **Type**: `gateway.networking.k8s.io/v1`
- **ParentRefs**: Links to specific Gateway listeners
- **Rules**: Path-based routing to backend services
- **BackendRefs**: Service name, namespace, and port

### 5. TLS Certificates
- **cert-manager**: Automates Let's Encrypt certificate provisioning
- **HTTP-01 Challenge**: Uses Gateway HTTP listener for validation
- **Storage**: Kubernetes Secrets referenced by Gateway

## Step-by-Step Setup

### Prerequisites
- Cilium installed with Gateway API enabled
- Gateway nodes labeled `role=gateway`
- cert-manager installed with `letsencrypt-prod` ClusterIssuer
- DNS configured for target hostname

### Step 1: Create CiliumLoadBalancerIPPool

Create IP pool with gateway node internal IPs:

```yaml
apiVersion: cilium.io/v2
kind: CiliumLoadBalancerIPPool
metadata:
  name: gateway-node-ips
spec:
  blocks:
    - cidr: 10.0.1.112/32
    - cidr: 10.0.1.169/32
```

```bash
kubectl apply -f lb-ipam.yaml
```

### Step 2: Create Gateway Resource

Create Gateway with HTTP and HTTPS listeners:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: cilium-gateway-application-gateway
  namespace: default
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All
    - name: https-service
      protocol: HTTPS
      port: 443
      hostname: service.example.com
      tls:
        mode: Terminate
        certificateRefs:
          - name: service-tls
            namespace: default
      allowedRoutes:
        namespaces:
          from: All
```

```bash
kubectl apply -f gateway.yaml
```

**Note**: Cilium will automatically create a LoadBalancer Service named `cilium-gateway-cilium-gateway-application-gateway` that handles the external traffic.

### Step 3: Create TLS Certificate

Create Certificate resource for Let's Encrypt:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: service-tls
  namespace: default
spec:
  secretName: service-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - service.example.com
```

```bash
kubectl apply -f certificate.yaml
```

### Step 4: Create HTTPRoute

Create HTTPRoute to route traffic to backend service:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: service-route
  namespace: service-namespace
spec:
  parentRefs:
    - name: service-gateway
      namespace: default
      sectionName: https-service
  hostnames:
    - "service.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: service-name
          namespace: service-namespace
          port: 80
```

```bash
kubectl apply -f httproute.yaml
```

### Step 5: Verify Deployment

Check Gateway status:

```bash
kubectl get gateway cilium-gateway-application-gateway -o wide
# Expected: PROGRAMMED=True with gateway node IP
```

Check LoadBalancer Service:

```bash
kubectl get svc cilium-gateway-cilium-gateway-application-gateway -o wide
# Expected: EXTERNAL-IP shows gateway node IP
```

Check Certificate:

```bash
kubectl get certificate service-tls -o wide
# Expected: READY=True
```

Test external access:

```bash
curl -I https://service.example.com/
# Expected: HTTP 200 with valid TLS certificate
```

## Chuck App Example

Here's the complete working example for Chuck App using the multi-service Gateway:

### Gateway
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: cilium-gateway-application-gateway
  namespace: default
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All
    - name: https-chuck
      protocol: HTTPS
      port: 443
      hostname: chuck.apo-llm-test.com
      tls:
        mode: Terminate
        certificateRefs:
          - name: chuck-tls
            namespace: default
      allowedRoutes:
        namespaces:
          from: All
    - name: https-hubble
      protocol: HTTPS
      port: 443
      hostname: hubble.apo-llm-test.com
      tls:
        mode: Terminate
        certificateRefs:
          - name: hubble-tls
            namespace: default
      allowedRoutes:
        namespaces:
          from: All
```

### HTTPRoute
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: chuck-route
  namespace: chuck-app
spec:
  parentRefs:
    - name: cilium-gateway-application-gateway
      namespace: default
      sectionName: https-chuck
  hostnames:
    - "chuck.apo-llm-test.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: chuck-app-service
          namespace: chuck-app
          port: 80
```

### Hubble HTTPRoute
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: hubble-route
  namespace: kube-system
spec:
  parentRefs:
    - name: cilium-gateway-application-gateway
      namespace: default
      sectionName: https-hubble
  hostnames:
    - "hubble.apo-llm-test.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: hubble-ui
          namespace: kube-system
          port: 80
```

### Certificate
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: chuck-tls
  namespace: default
spec:
  secretName: chuck-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - chuck.apo-llm-test.com
```

### LB-IPAM Pool
```yaml
apiVersion: cilium.io/v2
kind: CiliumLoadBalancerIPPool
metadata:
  name: gateway-node-ips
spec:
  blocks:
    - cidr: 10.0.1.112/32
    - cidr: 10.0.1.169/32
```

## Troubleshooting

### Gateway Not Programmed
- Check CiliumLoadBalancerIPPool exists and has correct IPs
- Verify gateway nodes have `role=gateway` label
- Check Cilium operator logs for errors

### Certificate Not Ready
- Verify DNS hostname resolves to gateway node public IP
- Check cert-manager logs for ACME challenge failures
- Ensure Gateway HTTP listener is accessible from internet

### 503 Errors
- Verify backend service exists and is healthy
- Check HTTPRoute backendRefs (name, namespace, port)
- Verify network policies allow traffic from gateway nodes

### No External Access
- Check AWS Security Groups allow ports 80/443
- Verify LoadBalancer Service has external IP assigned
- Test via NodePort as fallback: `http://<node-ip>:<nodeport>`

## Multiple Services

For multiple services, you can:
1. **Add listeners to existing Gateway** (recommended)
2. **Create separate Gateways** (one per service)
3. **Use path-based routing** in single HTTPRoute

Example of adding to existing Gateway:
```yaml
# Add new listener to chuck-gateway
- name: https-other
  protocol: HTTPS
  port: 443
  hostname: other.example.com
  tls:
    mode: Terminate
    certificateRefs:
      - name: other-tls
        namespace: default
  allowedRoutes:
    namespaces:
      from: All
```

## Cleanup

To remove a service configuration:
```bash
kubectl delete httproute service-route
kubectl delete certificate service-tls
kubectl delete secret service-tls
```

To remove the entire Gateway (only if no services need it):
```bash
kubectl delete gateway cilium-gateway-application-gateway
```

To remove LB-IPAM pool (only if no gateways use it):
```bash
kubectl delete CiliumLoadBalancerIPPool gateway-node-ips
```

## References

- [Cilium Gateway API Documentation](https://docs.cilium.io/en/stable/network/servicemesh/gateway-api/)
- [Gateway API Specification](https://gateway-api.sigs.k8s.io/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Cilium LoadBalancer IPAM](https://docs.cilium.io/en/stable/network/servicemesh/lb-ipam/)
