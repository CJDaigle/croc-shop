# Cilium Gateway API Setup - Current Direction Guide

**Date:** February 10, 2026  
**Cluster:** RKE2 on AWS EC2 (Rancher managed)  
**Domain:** apo-llm-test.com (Route 53)

---

## Purpose

This document summarizes the current infrastructure direction for Croc-Shop and related workloads in this repository:

- **Single-cluster deployment model**
- **Cilium as the CNI and policy enforcement layer**
- **Gateway API for north-south traffic**
- **Hubble for observability**
- **ClusterMesh excluded from the active deployment path**

ClusterMesh may still be considered later for multi-cluster expansion, but it is not part of the default install or deployment workflow documented in this repository.

---

## Cluster Overview

- **Cilium Version:** 1.18.6 (Helm chart + images)
- **Kubernetes:** v1.31.12+rke2r1
- **Nodes:** 10 total (3 control-plane, 7 workers including 2 gateway nodes)
- **CNI:** Cilium
- **Gateway API:** Enabled via Cilium
- **Observability:** Hubble relay + UI
- **Storage:** Longhorn

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

### Active DNS Hostnames

| App | Hostname |
|-----|----------|
| croc-shop | croc-shop.apo-llm-test.com |

Other hostnames may exist for neighboring workloads, but Croc-Shop in this repository is documented as a single-cluster application using Cilium networking and Gateway API.

---

## Active Infrastructure Decisions

### 1. Cilium Provides the Core Networking Layer

The repository now treats Cilium as:

- the **CNI**
- the **eBPF policy enforcement layer**
- the **Gateway API controller/data plane integration point**
- the **observability foundation via Hubble**

The repository does **not** treat ClusterMesh as an active requirement for Croc-Shop.

### 2. Gateway API Replaces Traditional Ingress

The active direction is:

- Gateway API CRDs installed before Cilium
- Cilium Gateway API enabled via Helm values
- dedicated gateway nodes labeled `role=gateway`
- `nodePort.enabled: true` retained for the Cilium 1.18 Gateway API requirements

### 3. Single-Cluster, Multi-Namespace Application Layout

Croc-Shop communicates across namespaces using standard Kubernetes service discovery:

```text
<service>.<namespace>.svc.cluster.local
```

This is the current and intended default operating model.

### 4. ClusterMesh Is Optional Future Work

ClusterMesh is no longer part of the active deployment story in this repo.

If the platform later expands to multiple clusters, ClusterMesh can be revisited as an optional capability, but it should not shape the default install, deployment, or troubleshooting steps for Croc-Shop today.

---

## What Was Completed

### 1. Gateway Nodes Created & Configured
```bash
kubectl label node ip-10-0-1-112 role=gateway
kubectl label node ip-10-0-1-169 role=gateway
kubectl taint nodes ip-10-0-1-112 role=gateway:NoSchedule
kubectl taint nodes ip-10-0-1-169 role=gateway:NoSchedule
```

### 2. Gateway API CRDs Installed
Required CRDs were installed so Cilium could register its GatewayClass and reconcile Gateway resources.

### 3. Cilium Installed via Helm with Gateway API Support
Key active settings include:

- `gatewayAPI.enabled: true`
- `gatewayAPI.hostNetwork.enabled: true`
- `gatewayAPI.hostNetwork.nodes.matchLabels.role: gateway`
- `envoyConfig.enabled: true`
- `nodePort.enabled: true`

### 4. Hubble Enabled for Observability
The active observability path remains:

- Hubble Relay
- Hubble UI
- Cilium flow inspection via CLI

### 5. GatewayClass Registered
Expected status:

```text
NAME     CONTROLLER                     ACCEPTED
cilium   io.cilium/gateway-controller   True
```

---

## Current Operational Caveat

### Envoy Binding on Port 80/443

One of the known operational concerns in this environment has been Envoy binding behavior on privileged ports when using host-networked gateway nodes.

If gateway listeners are not programming correctly, check:

```bash
kubectl get daemonset cilium-envoy -n kube-system -o jsonpath='{.spec.template.spec.containers[0].securityContext}'
kubectl logs -n kube-system -l k8s-app=cilium-envoy --tail=50
```

This remains a Gateway API / Envoy operational issue, not a ClusterMesh issue.

---

## Problems Encountered & Current Interpretation

| Problem | Root Cause | Current Interpretation |
|---------|-----------|------------------------|
| GatewayClass stuck at `Unknown` | Gateway API prerequisites missing | Ensure Gateway API CRDs are installed and `nodePort.enabled: true` is set for Cilium 1.18 |
| Operator not logging gateway events | Missing Gateway API CRDs | Install all required Gateway API CRDs before enabling Gateway API |
| Helm `--reuse-values` caused confusing upgrades | Old values masked new defaults | Save explicit values to file and upgrade with `-f`, not `--reuse-values` |
| Envoy could not bind low ports | Missing capabilities / host networking constraints | Treat as Gateway API runtime troubleshooting, not multi-cluster design work |
| 1.19 upgrade introduced extra risk | Config and behavior changes across versions | Keep upgrade guidance focused on single-cluster Cilium + Gateway API validation |

---

## Current Recommended Validation Commands

```bash
# Check cluster health
cilium status
kubectl get nodes -o wide
kubectl get pods -n kube-system | grep -E "Crash|Error|0/"

# Check Gateway API status
kubectl get gatewayclass cilium
kubectl get gateway --all-namespaces
kubectl get httproute --all-namespaces
kubectl get ciliumenvoyconfigs --all-namespaces

# Check envoy status
kubectl logs -n kube-system -l k8s-app=cilium-envoy --tail=20
kubectl get daemonset cilium-envoy -n kube-system -o jsonpath='{.spec.template.spec.containers[0].securityContext}' | python3 -m json.tool

# Check Helm revision
helm history cilium -n kube-system | tail -3
```

---

## Current Architecture Target

```text
Internet → DNS (croc-shop.apo-llm-test.com) → Gateway Nodes
                                             │
                                             ▼
                                   Cilium Gateway API (Envoy)
                                             │
                                   HTTPRoute / Gateway routing
                                             │
                         ┌──────────────┬──────────────┬──────────────┐
                         ▼              ▼              ▼              ▼
                     frontend      product-catalog     user      other app services
                      (ClusterIP)      (ClusterIP)   (ClusterIP)   (ClusterIP)
```

Internally, services communicate across namespaces through standard Kubernetes DNS and ClusterIP services. That is the active design center for this repository.

---

## Forward-Looking Note

If this environment later evolves into a multi-cluster platform, revisit:

- unique `cluster.name` and `cluster.id` values
- ClusterMesh connectivity
- multi-cluster policy behavior
- multi-cluster service discovery

Until then, keep Croc-Shop documentation, deployment steps, and troubleshooting focused on the current **single-cluster Cilium + Gateway API** model.
