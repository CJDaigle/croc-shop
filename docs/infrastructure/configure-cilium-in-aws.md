# Configure Cilium in AWS

Build a Rancher-provisioned RKE2 cluster on AWS with **Cilium CNI**, **Hubble**, **Hubble UI**, **Cluster Mesh**, and **Gateway API**.

## Prerequisites

- Rancher management server deployed (see [README](../README.md))
- Helm installed on your workstation
- `kubectl` configured to access your cluster
- **VPC and Cilium pod CIDRs must not overlap.** For example, use `10.0.0.0/16` for the VPC and `172.16.0.0/16` for the Cilium pod CIDR. If these ranges overlap, CoreDNS will not be able to route traffic outside the cluster and the cluster will fail to come up.
- AWS security groups allowing:
  - **UDP 8472** — VXLAN overlay traffic between nodes
  - **TCP 4240** — Cilium health checks
  - **TCP 4244** — Hubble Relay
  - **TCP 2379** — Cluster Mesh API server (if using NodePort or LoadBalancer)

## 1) Provision the RKE2 Cluster via Rancher

Use the included [cluster.RKE2.yaml](cluster.RKE2.yaml) to define the cluster. Key settings already configured:

- **Cluster name:** `cilium-ai-defense`
- **Kubernetes version:** `v1.31.12+rke2r1`
- **CNI:** `none` (Cilium will manage networking)
- **Disabled:** `rke2-ingress-nginx` (Cilium Gateway API replaces it)

Apply the cluster definition through the Rancher UI or via `kubectl` against the Rancher management cluster:

~~~
kubectl apply -f docs/cluster.RKE2.yaml
~~~

Once the cluster is provisioned and all nodes show `Ready`, proceed to install Cilium.

## 2) Install Gateway API CRDs

Gateway API CRDs must be installed before Cilium so the controller can register against them.

~~~
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml
~~~

## 3) Install Cilium

### Add the Helm repo

~~~
helm repo add cilium https://helm.cilium.io/
helm repo update
~~~

### Install using the values file

The included [cilium-values.yaml](cilium-values.yaml) is a confirmed working configuration with `cluster.name: cluster-1` and `cluster.id: 1` already set. Update these values if connecting multiple clusters via Cluster Mesh (each cluster needs a unique name and ID 1–255).

~~~
helm install cilium cilium/cilium \
  --namespace kube-system \
  -f docs/cilium-values.yaml
~~~

Or install with explicit flags:

~~~
helm install cilium cilium/cilium \
  --namespace kube-system \
  --set cluster.name=cluster-1 \
  --set cluster.id=1 \
  --set hubble.enabled=true \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true \
  --set hubble.metrics.enabled="{dns,drop,tcp,flow,icmp,http}" \
  --set gatewayAPI.enabled=true \
  --set clustermesh.useAPIServer=true \
  --set clustermesh.apiserver.service.type=LoadBalancer
~~~

## 4) Verify the Installation

### Check Cilium agent pods

~~~
kubectl get po -n kube-system -l app.kubernetes.io/name=cilium
~~~

### Check Cilium status

~~~
kubectl exec -n kube-system ds/cilium -- cilium status
~~~

### Verify Hubble Relay

~~~
kubectl get po -n kube-system -l app.kubernetes.io/name=hubble-relay
~~~

### Verify Hubble UI

~~~
kubectl get po -n kube-system -l app.kubernetes.io/name=hubble-ui
~~~

### Verify Cluster Mesh API server

~~~
kubectl get po -n kube-system -l app.kubernetes.io/name=clustermesh-apiserver
~~~

### Verify Gateway API

~~~
kubectl get gatewayclasses
~~~

## 5) Access Hubble UI

Port-forward to access the Hubble UI locally:

~~~
kubectl port-forward -n kube-system svc/hubble-ui 12000:80
~~~

Then open http://localhost:12000 in your browser.

## 6) Connect Clusters with Cluster Mesh

To mesh two clusters together, ensure both clusters have Cilium installed with unique `cluster.name` and `cluster.id` values, then connect them using the Cilium CLI:

~~~
cilium clustermesh connect --context <CLUSTER1_CONTEXT> --destination-context <CLUSTER2_CONTEXT>
~~~

Verify the connection:

~~~
cilium clustermesh status --context <CLUSTER1_CONTEXT>
~~~

## 7) Create a Gateway

Example Gateway resource using the Cilium GatewayClass:

~~~yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: my-gateway
  namespace: default
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
~~~

Then attach an HTTPRoute to it:

~~~yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-route
  namespace: default
spec:
  parentRefs:
    - name: my-gateway
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: my-service
          port: 80
~~~

## Troubleshooting

- **Pods stuck in `Init` state** — Verify AWS security groups allow UDP 8472 and TCP 4240 between nodes.
- **Hubble UI not loading** — Confirm `hubble-relay` pods are running and the relay service is healthy.
- **Cluster Mesh not connecting** — Ensure both clusters have unique `cluster.id` values and the Cluster Mesh API server service is reachable (check LoadBalancer external IP).
- **Gateway not getting an address** — Confirm Gateway API CRDs were installed before Cilium and that the `cilium` GatewayClass exists (`kubectl get gatewayclasses`).

### Save Current State & Health Check

Run these commands to capture the current Cilium Helm values and verify cluster health. Useful before upgrades or debugging sessions.

~~~bash
# Save current Helm values
helm get values cilium -n kube-system > ~/cilium-values-base.yaml

# Current Helm revision
helm history cilium -n kube-system | tail -5

# Cluster health check
cilium status

# Gateway status
kubectl get gatewayclass cilium
kubectl get gateway main-gateway
kubectl get ciliumenvoyconfigs --all-namespaces

# Gateway node status
kubectl get nodes -l role=gateway
~~~
