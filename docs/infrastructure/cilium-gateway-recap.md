# Cilium Gateway API Setup - Recap & Morning Restart Guide

**Date:** February 10, 2026  
**Cluster:** RKE2 on AWS EC2 (Rancher managed)  
**Domain:** apo-llm-test.com (Route 53)

---

## Cluster Overview

- **Cilium Version:** 1.18.6 (Helm chart + images)
- **Kubernetes:** v1.31.12+rke2r1
- **Nodes:** 10 total (3 control-plane, 7 workers including 2 gateway nodes)
- **CNI:** Cilium
- **Storage:** Longhorn
- **ClusterMesh:** Enabled

### Node Layout

| Node | Role | IP |
|------|------|----|
| ip-10-0-1-60 | control-plane | 10.0.1.60 |
| ip-10-0-1-87 | control-plane | 10.0.1.87 |
| ip-10-0-1-94 | control-plane | 10.0.1.94 |
| ip-10-0-1-103 | worker | 10.0.1.103 |
| ip-10-0-1-23 | worker | 10.0.1.23 |
| ip-10-0-1-248 | worker | 10.0.1.248 |
| ip-10-0-1-39 | worker | 10.0.1.39 |
| ip-10-0-1-82 | worker | 10.0.1.82 |
| **ip-10-0-1-112** | **gateway** (labeled + tainted) | **10.0.1.112** |
| **ip-10-0-1-169** | **gateway** (labeled + tainted) | **10.0.1.169** |

### Services to Migrate from NodePort → ClusterIP

| Namespace | Service | Current NodePort |
|-----------|---------|-----------------|
| chuck | chuck-app-service | 30080 |
| croc-shop-frontend | frontend | 32733 |
| open-webui | open-webui | 32709 |
| sock-shop | front-end | 31920 |

### Planned DNS Hostnames (apo-llm-test.com)

| App | Hostname |
|-----|----------|
| chuck | chuck.apo-llm-test.com |
| croc-shop | croc-shop.apo-llm-test.com |
| open-webui | open-webui.apo-llm-test.com |
| sock-shop | sock-shop.apo-llm-test.com |
| hubble | hubble.apo-llm-test.com |

---

## What Was Completed

### 1. Gateway Nodes Created & Configured ✅
```bash
kubectl label node ip-10-0-1-112 role=gateway
kubectl label node ip-10-0-1-169 role=gateway
kubectl taint nodes ip-10-0-1-112 role=gateway:NoSchedule
kubectl taint nodes ip-10-0-1-169 role=gateway:NoSchedule
```

### 2. Gateway API CRDs Installed ✅
All 5 required CRDs are installed:
- gatewayclasses.gateway.networking.k8s.io
- gateways.gateway.networking.k8s.io
- httproutes.gateway.networking.k8s.io
- referencegrants.gateway.networking.k8s.io
- grpcroutes.gateway.networking.k8s.io (this was the missing one that blocked startup)
- tlsroutes.gateway.networking.k8s.io (experimental, optional)

### 3. Cilium Helm Upgraded with Gateway API ✅
Key settings enabled via `/tmp/cilium-overrides.yaml`:
- `gatewayAPI.enabled: true`
- `gatewayAPI.hostNetwork.enabled: true`
- `gatewayAPI.hostNetwork.nodes.matchLabels.role: gateway`
- `envoyConfig.enabled: true`
- `nodePort.enabled: true` (required prerequisite for Gateway API in 1.18)

### 4. cert-manager Installed ✅
- Namespace: cert-manager
- ClusterIssuer: `letsencrypt-prod` (HTTP-01 challenge, production)
- Email configured for Let's Encrypt notifications

### 5. GatewayClass Created & Accepted ✅
```
NAME     CONTROLLER                     ACCEPTED
cilium   io.cilium/gateway-controller   True
```

### 6. Gateway Created (HTTP-only, simplified for testing) ✅
- Name: `main-gateway` in `default` namespace
- Listener: HTTP on port 80
- Status: **Accepted = True**, Programmed = False (AddressNotAssigned - expected for hostNetwork)
- CiliumEnvoyConfig created: `cilium-gateway-main-gateway` ✅
- Service created: `cilium-gateway-main-gateway` (ClusterIP) ✅

---

## Current Blocker: Envoy Permission Denied on Port 80

**The Problem:**
The Envoy DaemonSet pods on gateway nodes cannot bind to port 80 because they lack the `NET_BIND_SERVICE` Linux capability.

**Error from envoy logs:**
```
listener 'default/cilium-gateway-main-gateway/listener' failed to bind or apply socket options: 
cannot bind '0.0.0.0:80': Permission denied
```

**What Was Tried:**
- Set `envoy.securityContext.capabilities.keepCapNetBindService=true` via Helm — did NOT fix it

**What Needs to Happen Next:**
The envoy DaemonSet security context needs `NET_BIND_SERVICE` in its capabilities. Check:
```bash
kubectl get daemonset cilium-envoy -n kube-system -o jsonpath='{.spec.template.spec.containers[0].securityContext}'
```

Options to fix:
1. Add `NET_BIND_SERVICE` to envoy container capabilities
2. Or use a high port (e.g., 8080) and have iptables redirect 80 → 8080
3. Or set the envoy container to run with hostNetwork (separate from the gateway hostNetwork setting)

---

## Problems Encountered & Solutions Found

| Problem | Root Cause | Solution |
|---------|-----------|----------|
| GatewayClass stuck at "Unknown" | Gateway API requires `nodePort.enabled: true` OR kube-proxy replacement | Enabled `nodePort.enabled: true` |
| Operator not logging any gateway info | `grpcroutes` CRD was missing | Installed grpcroutes CRD |
| Helm upgrade to 1.19 broke clustermesh | `--clustermesh-cache-ttl` flag removed in 1.19 | Rolled back to 1.18.6 with `--version 1.18.6` |
| Helm `--reuse-values` not applying overrides | Old values file overriding `--set` flags | Used separate `-f overrides.yaml` file |
| Envoy can't bind port 80 | Missing `NET_BIND_SERVICE` capability | **STILL NEEDS FIX** |

---

## Remaining Steps After Fix

1. **Fix envoy port 80 binding** (permission issue above)
2. **Verify HTTP gateway works** (curl to gateway node IPs on port 80)
3. **Delete simplified gateway, recreate with full HTTPS listeners** for all apps
4. **Create HTTPRoutes** for each app
5. **Set up DNS** in Route 53 (A records → gateway node IPs)
6. **Migrate services** from NodePort → ClusterIP
7. **Test end-to-end** with HTTPS

---

## Key Commands for Morning

```bash
# Check cluster health
cilium status
kubectl get nodes -o wide
kubectl get pods -n kube-system | grep -E "Crash|Error|0/"

# Check gateway status
kubectl get gatewayclass cilium
kubectl get gateway main-gateway
kubectl get ciliumenvoyconfigs --all-namespaces

# Check envoy on gateway nodes
kubectl logs -n kube-system $(kubectl get pods -n kube-system -l k8s-app=cilium-envoy --field-selector spec.nodeName=ip-10-0-1-112 -o name) --tail=10

# Check envoy security context
kubectl get daemonset cilium-envoy -n kube-system -o jsonpath='{.spec.template.spec.containers[0].securityContext}' | python3 -m json.tool

# Current helm revision
helm history cilium -n kube-system | tail -3
```

---

## Architecture Target

```
Internet → DNS (*.apo-llm-test.com) → Gateway Nodes (10.0.1.112, 10.0.1.169)
                                              │
                                              ▼
                                    Cilium Gateway API (Envoy)
                                     Port 80 + 443 (TLS via cert-manager)
                                              │
                                    HTTPRoute matching by hostname
                                              │
                              ┌────────┬───────┼────────┬──────────┐
                              ▼        ▼       ▼        ▼          ▼
                           chuck   croc-shop  open-   sock-shop  hubble
                            svc     svc       webui    svc        svc
                         (ClusterIP)        (ClusterIP)        (ClusterIP)
```

**Design Principle:** No cloud provider dependencies. Fully portable across on-prem, AWS, Azure, GCP.
