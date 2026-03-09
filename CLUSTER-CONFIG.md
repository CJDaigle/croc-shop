# Croc-Shop Cluster Configuration Dump
Generated: 2026-03-09 16:22:00 UTC

## Cilium Status

```
[33m    /¯¯\
[36m /¯¯[33m\__/[32m¯¯\[0m    Cilium:             [32mOK[0m
[36m \__[31m/¯¯\[32m__/[0m    Operator:           [32mOK[0m
[32m /¯¯[31m\__/[35m¯¯\[0m    Envoy DaemonSet:    [32mOK[0m
[32m \__[34m/¯¯\[35m__/[0m    Hubble Relay:       [32mOK[0m
[34m[34m[34m    \__/[0m       ClusterMesh:        [32mOK[0m

DaemonSet              cilium                   Desired: 10, Ready: [32m10/10[0m, Available: [32m10/10[0m
DaemonSet              cilium-envoy             Desired: 10, Ready: [32m10/10[0m, Available: [32m10/10[0m
Deployment             cilium-operator          Desired: 2, Ready: [32m2/2[0m, Available: [32m2/2[0m
Deployment             clustermesh-apiserver    Desired: 1, Ready: [32m1/1[0m, Available: [32m1/1[0m
Deployment             hubble-relay             Desired: 1, Ready: [32m1/1[0m, Available: [32m1/1[0m
Deployment             hubble-ui                Desired: 1, Ready: [32m1/1[0m, Available: [32m1/1[0m
Containers:            cilium                   Running: [32m10[0m
                       cilium-envoy             Running: [32m10[0m
                       cilium-operator          Running: [32m2[0m
                       clustermesh-apiserver    Running: [32m1[0m
                       hubble-relay             Running: [32m1[0m
                       hubble-ui                Running: [32m1[0m
Cluster Pods:          88/88 managed by Cilium
Helm chart version:    1.18.6
Image versions         cilium                   quay.io/cilium/cilium:v1.18.6: 10
                       cilium-envoy             quay.io/cilium/cilium-envoy:v1.34.7-1757592137-1a52bb680a956879722f48c591a2ca90f7791324: 10
                       cilium-operator          quay.io/cilium/operator-generic:v1.18.6: 2
                       clustermesh-apiserver    quay.io/cilium/clustermesh-apiserver:v1.18.6: 3
                       hubble-relay             quay.io/cilium/hubble-relay:v1.18.6: 1
                       hubble-ui                quay.io/cilium/hubble-ui-backend:v0.13.3: 1
                       hubble-ui                quay.io/cilium/hubble-ui:v0.13.3: 1
```

## Key Cilium Configuration

```
cluster-id                                        1
cluster-name                                      cluster-1
cluster-pool-ipv4-cidr                            172.16.0.0/16
datapath-mode                                     veth
enable-envoy-config                               true
enable-gateway-api                                true
enable-gateway-api-alpn                           false
enable-gateway-api-app-protocol                   false
enable-gateway-api-proxy-protocol                 false
enable-gateway-api-secrets-sync                   true
enable-hubble                                     true
enable-ipv4                                       true
enable-ipv6                                       false
enable-k8s-networkpolicy                          true
enable-l7-proxy                                   true
enable-lb-ipam                                    true
enable-metrics                                    true
enable-node-port                                  true
enable-policy                                     default
external-envoy-proxy                              true
gateway-api-hostnetwork-enabled                   true
http-retry-count                                  3
ipam                                              cluster-pool
kube-proxy-replacement                            false
mesh-auth-enabled                                 true
routing-mode                                      tunnel
tunnel-protocol                                   vxlan
```

## Namespaces

```
NAME                          STATUS   AGE
croc-shop                     Active   26d
croc-shop-cart                Active   26d
croc-shop-chatbot             Active   5d
croc-shop-data                Active   26d
croc-shop-frontend            Active   26d
croc-shop-order               Active   26d
croc-shop-product-catalog     Active   26d
croc-shop-user                Active   26d
monitoring                    Active   5d
sock-shop                     Active   26d
kube-system                   Active   26d
longhorn-system               Active   26d
cattle-fleet-system           Active   26d
```

## Pods (croc-shop namespaces)

```
NAME                        READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
frontend-599ff4fc98-d6f77   1/1     Running   0          26d   172.16.6.129   ip-10-0-1-248   <none>           <none>
frontend-599ff4fc98-p8bmc   1/1     Running   0          26d   172.16.5.123   ip-10-0-1-39    <none>           <none>

NAME                               READY   STATUS    RESTARTS   AGE   IP            NODE            NOMINATED NODE   READINESS GATES
product-catalog-7699c8b777-58xlm   1/1     Running   0          26d   172.16.8.73   ip-10-0-1-23    <none>           <none>
product-catalog-7699c8b777-r4rjp   1/1     Running   0          26d   172.16.6.58   ip-10-0-1-248   <none>           <none>

NAME                    READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
user-576f8bc899-bxz98   1/1     Running   0          26d   172.16.6.128   ip-10-0-1-248   <none>           <none>
user-576f8bc899-zh4qz   1/1     Running   0          26d   172.16.4.117   ip-10-0-1-103   <none>           <none>

NAME                    READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
cart-77d748f6f4-22mnc   1/1     Running   0          26d   172.16.8.246   ip-10-0-1-23    <none>           <none>
cart-77d748f6f4-kjwsg   1/1     Running   0          26d   172.16.4.9     ip-10-0-1-103   <none>           <none>

NAME                    READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
order-7f895d6c5-bj8hf   1/1     Running   0          26d   172.16.5.239   ip-10-0-1-39    <none>           <none>
order-7f895d6c5-z7ll9   1/1     Running   0          26d   172.16.4.119   ip-10-0-1-103   <none>           <none>

NAME                        READY   STATUS    RESTARTS   AGE   IP             NODE           NOMINATED NODE   READINESS GATES
postgres-588cb7f7bd-9zxhc   1/1     Running   0          26d   172.16.7.242   ip-10-0-1-82   <none>           <none>
redis-599d6dc8bd-6z7tw      1/1     Running   0          26d   172.16.5.119   ip-10-0-1-39   <none>           <none>

NAME                       READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
chatbot-7ccc557786-m2dcj   1/1     Running   0          4d   172.16.5.179   ip-10-0-1-39    <none>           <none>

```

## Pods (monitoring namespace)

```
NAME                          READY   STATUS      RESTARTS   AGE
grafana-ffc74586b-5gtq6       1/1     Running     0          4d18h
prometheus-849fb586fc-f4rtq   1/1     Running     0          33h
prometheus-849fb586fc-pfgrt   0/1     Completed   0          4d17h

```

## Pods (sock-shop namespace)

```
NAME                            READY   STATUS    RESTARTS   AGE
carts-778f4b564f-p2dts          1/1     Running   0          26d
carts-db-676c6b5865-8cnl2       1/1     Running   0          26d
catalogue-db-c948fd796-5t9pq    1/1     Running   0          26d
catalogue-f7687cb4-fzz4z        1/1     Running   0          26d
front-end-8674c7449f-wkj2m      1/1     Running   0          26d
orders-595bcdb56f-5zlx8         1/1     Running   0          26d
orders-db-658fc79675-2xnlc      1/1     Running   0          26d
payment-84bbbfd97f-77hpl        1/1     Running   0          26d
queue-master-76c64bb55f-llvf8   1/1     Running   0          26d
shipping-6c9c8c49f9-2k5s8       1/1     Running   0          26d
user-db-7d957b744f-7jx8r        1/1     Running   0          26d
users-f7c6c68d8-7tq4m          1/1     Running   0          26d

```

## Pods (kube-system - Tetragon)

```
NAME                          READY   STATUS    RESTARTS   AGE
tetragon-c8ktc                1/1     Running   0          4d18h
tetragon-fwtbs                1/1     Running   0          4d18h
tetragon-g4l5c                1/1     Running   0          4d18h
tetragon-h9fzd                1/1     Running   0          4d18h
tetragon-jhjmf                1/1     Running   0          4d18h
tetragon-k59qv                1/1     Running   0          4d18h
tetragon-l24qn                1/1     Running   0          4d18h
tetragon-operator-64d48cd56d-h56q7   1/1     Running   0          4d18h
tetragon-qm7wv                1/1     Running   0          4d18h
tetragon-wq99d                1/1     Running   0          4d18h
tetragon-ws4hm                1/1     Running   0          4d18h

```

## Services

### croc-shop Services
```
NAME       TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
frontend   ClusterIP   10.43.188.87   <none>        80/TCP    26d

NAME              TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)    AGE
product-catalog   ClusterIP   10.43.67.46   <none>        3001/TCP   26d

NAME   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
user   ClusterIP   10.43.158.48   <none>        3002/TCP   26d

NAME   TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)    AGE
cart   ClusterIP   10.43.18.2   <none>        3003/TCP   26d

NAME    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
order   ClusterIP   10.43.233.185   <none>        3004/TCP   26d

NAME       TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
postgres   ClusterIP   10.43.181.14   <none>        5432/TCP   26d
redis      ClusterIP   10.43.46.244   <none>        6379/TCP   26d

NAME       TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
chatbot    ClusterIP   10.43.123.45   <none>        3005/TCP   4d
```

### monitoring Services
```
NAME              TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
prometheus        ClusterIP   10.43.200.100   <none>        9090/TCP   5d
grafana           ClusterIP   10.43.200.101   <none>        3000/TCP   5d
```

### sock-shop Services
```
NAME            TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
carts           ClusterIP   10.43.150.50    <none>        80/TCP     26d
catalogue       ClusterIP   10.43.150.51    <none>        80/TCP     26d
front-end       ClusterIP   10.43.150.52    <none>        80/TCP     26d
orders          ClusterIP   10.43.150.53    <none>        80/TCP     26d
payment         ClusterIP   10.43.150.54    <none>        80/TCP     26d
queue-master    ClusterIP   10.43.150.55    <none>        80/TCP     26d
shipping        ClusterIP   10.43.150.56    <none>        80/TCP     26d
users           ClusterIP   10.43.150.57    <none>        80/TCP     26d
```

## Deployments

### croc-shop Deployments
```
NAME       READY   UP-TO-DATE   AVAILABLE   AGE
frontend   2/2     2            2           26d

NAME              READY   UP-TO-DATE   AVAILABLE   AGE
product-catalog   2/2     2            2           26d

NAME   READY   UP-TO-DATE   AVAILABLE   AGE
user   2/2     2            2           26d

NAME   READY   UP-TO-DATE   AVAILABLE   AGE
cart   2/2     2            2           26d

NAME    READY   UP-TO-DATE   AVAILABLE   AGE
order   2/2     2            2           26d

NAME       READY   UP-TO-DATE   AVAILABLE   AGE
postgres   1/1     1            1           26d
redis      1/1     1            1           26d

NAME       READY   UP-TO-DATE   AVAILABLE   AGE
chatbot    1/1     1            1           4d
```

### monitoring Deployments
```
NAME              READY   UP-TO-DATE   AVAILABLE   AGE
prometheus        1/1     1            1           5d
grafana           1/1     1            1           5d
```

### sock-shop Deployments
```
NAME            READY   UP-TO-DATE   AVAILABLE   AGE
carts           1/1     1            1           26d
catalogue       1/1     1            1           26d
front-end       1/1     1            1           26d
orders          1/1     1            1           26d
payment         1/1     1            1           26d
queue-master    1/1     1            1           26d
shipping        1/1     1            1           26d
users           1/1     1            1           26d
```

## Horizontal Pod Autoscalers

```
NAME                  REFERENCE                    TARGETS                        MINPODS   MAXPODS   REPLICAS   AGE
product-catalog-hpa   Deployment/product-catalog   cpu: 8%/70%, memory: 28%/80%   2         10        2          26d

NAME       REFERENCE         TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
user-hpa   Deployment/user   cpu: 8%/70%   2         10        2          26d

NAME       REFERENCE         TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
cart-hpa   Deployment/cart   cpu: 2%/70%   2         10        2          26d

NAME        REFERENCE          TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
order-hpa   Deployment/order   cpu: 1%/70%   2         10        2          26d
```

## ConfigMaps (non-default)

```
product-catalog-config   5     20d

user-config        5     20d

cart-config        3     20d

order-config       6     20d

postgres-config    2     20d


```

## Secrets (names only)

```
postgres-secret   Opaque   1     20d

user-secret   Opaque   2     20d

cart-secret   Opaque   1     20d

postgres-secret   Opaque   2     20d

postgres-secret   Opaque   1     20d

```

## Network Policies

```
NAMESPACE                   NAME                     POD-SELECTOR          AGE
cattle-fleet-system         default-allow-all        <none>                26d
croc-shop-cart              cart-policy              app=cart              5d
croc-shop-chatbot           chatbot-policy           app=chatbot           5d
croc-shop-data              postgres-policy          app=postgres          5d
croc-shop-data              redis-policy             app=redis             5d
croc-shop-frontend          frontend-policy          app=frontend          5d
croc-shop-order             order-policy             app=order             5d
croc-shop-product-catalog   product-catalog-policy   app=product-catalog   5d
croc-shop-user              user-policy              app=user              5d
monitoring                  grafana-policy           app=grafana           5d
monitoring                  prometheus-policy        app=prometheus        5d
```

## CiliumNetworkPolicies

```
No resources found
```

## Persistent Volume Claims

```
NAMESPACE        NAME                     STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
croc-shop-data   postgres-pvc             Bound    pvc-68f2fbe2-a18f-4ba6-b28e-1583fdff4685   5Gi        RWO            longhorn       <unset>                 26d
monitoring       grafana-pvc              Bound    pvc-18dd15c0-228b-47d6-964b-f002fc82955c   10Gi       RWO            longhorn       <unset>                 4d
monitoring       prometheus-storage-pvc   Bound    pvc-9ef65a55-74ed-4443-b27a-1e254269bfb3   10Gi       RWO            longhorn       <unset>                 4d
open-webui       open-webui               Bound    pvc-6ea66450-ef67-4410-b1d5-04c068240c98   2Gi        RWO            longhorn       <unset>                 26d
```

## Ingress Resources

```
No resources found
```

## Full Cilium Config

```
agent-not-ready-taint-key                         node.cilium.io/agent-not-ready
auto-direct-node-routes                           false
bpf-distributed-lru                               false
bpf-events-drop-enabled                           true
bpf-events-policy-verdict-enabled                 true
bpf-events-trace-enabled                          true
bpf-lb-acceleration                               disabled
bpf-lb-algorithm-annotation                       false
bpf-lb-external-clusterip                         false
bpf-lb-map-max                                    65536
bpf-lb-mode-annotation                            false
bpf-lb-sock                                       false
bpf-lb-source-range-all-types                     false
bpf-map-dynamic-size-ratio                        0.0025
bpf-policy-map-max                                16384
bpf-policy-stats-map-max                          65536
bpf-root                                          /sys/fs/bpf
cgroup-root                                       /run/cilium/cgroupv2
cilium-endpoint-gc-interval                       5m0s
cluster-id                                        1
cluster-name                                      cluster-1
cluster-pool-ipv4-cidr                            172.16.0.0/16
cluster-pool-ipv4-mask-size                       24
clustermesh-enable-endpoint-sync                  false
clustermesh-enable-mcs-api                        false
cni-exclusive                                     true
cni-log-file                                      /var/run/cilium/cilium-cni.log
custom-cni-conf                                   false
datapath-mode                                     veth
debug                                             false
default-lb-service-ipam                           lbipam
direct-routing-skip-unreachable                   false
dnsproxy-enable-transparent-mode                  true
dnsproxy-socket-linger-timeout                    10
egress-gateway-reconciliation-trigger-interval    1s
enable-auto-protect-node-port-range               true
enable-bpf-clock-probe                            false
enable-endpoint-health-checking                   true
enable-endpoint-lockdown-on-policy-overflow       false
enable-envoy-config                               true
enable-gateway-api                                true
enable-gateway-api-alpn                           false
enable-gateway-api-app-protocol                   false
enable-gateway-api-proxy-protocol                 false
enable-gateway-api-secrets-sync                   true
enable-health-check-loadbalancer-ip               false
enable-health-check-nodeport                      true
enable-health-checking                            true
enable-hubble                                     true
enable-internal-traffic-policy                    true
enable-ipv4                                       true
enable-ipv4-big-tcp                               false
enable-ipv4-masquerade                            true
enable-ipv6                                       false
enable-ipv6-big-tcp                               false
enable-ipv6-masquerade                            true
enable-k8s-networkpolicy                          true
enable-l2-neigh-discovery                         false
enable-l7-proxy                                   true
enable-lb-ipam                                    true
enable-masquerade-to-route-source                 false
enable-metrics                                    true
enable-node-port                                  true
enable-node-selector-labels                       false
enable-non-default-deny-policies                  true
enable-policy                                     default
enable-policy-secrets-sync                        true
enable-sctp                                       false
enable-source-ip-verification                     true
enable-svc-source-range-check                     true
enable-tcx                                        true
enable-vtep                                       false
enable-well-known-identities                      false
enable-xt-socket-fallback                         true
envoy-access-log-buffer-size                      4096
envoy-base-id                                     0
envoy-config-retry-interval                       15s
envoy-keep-cap-netbindservice                     true
envoy-secrets-namespace                           cilium-secrets
external-envoy-proxy                              true
gateway-api-hostnetwork-enabled                   true
gateway-api-hostnetwork-nodelabelselector         role=gateway
gateway-api-secrets-namespace                     cilium-secrets
gateway-api-service-externaltrafficpolicy         Cluster
gateway-api-xff-num-trusted-hops                  0
health-check-icmp-failure-threshold               3
http-retry-count                                  3
http-stream-idle-timeout                          300
hubble-disable-tls                                false
hubble-listen-address                             :4244
hubble-network-policy-correlation-enabled         true
hubble-socket-path                                /var/run/cilium/hubble.sock
hubble-tls-cert-file                              /var/lib/cilium/tls/hubble/server.crt
hubble-tls-client-ca-files                        /var/lib/cilium/tls/hubble/client-ca.crt
hubble-tls-key-file                               /var/lib/cilium/tls/hubble/server.key
identity-allocation-mode                          crd
identity-gc-interval                              15m0s
identity-heartbeat-timeout                        30m0s
identity-management-mode                          agent
install-no-conntrack-iptables-rules               false
ipam                                              cluster-pool
ipam-cilium-node-update-rate                      15s
iptables-random-fully                             false
k8s-require-ipv4-pod-cidr                         false
k8s-require-ipv6-pod-cidr                         false
kube-proxy-replacement                            false
max-connected-clusters                            255
mesh-auth-enabled                                 true
mesh-auth-gc-interval                             5m0s
mesh-auth-queue-size                              1024
mesh-auth-rotated-identities-queue-size           1024
metrics-sampling-interval                         5m
monitor-aggregation                               medium
monitor-aggregation-flags                         all
monitor-aggregation-interval                      5s
nat-map-stats-entries                             32
nat-map-stats-interval                            30s
node-port-bind-protection                         true
nodes-gc-interval                                 5m0s
operator-api-serve-addr                           127.0.0.1:9234
operator-prometheus-serve-addr                    :9963
policy-default-local-cluster                      false
policy-secrets-namespace                          cilium-secrets
policy-secrets-only-from-secrets-namespace        true
preallocate-bpf-maps                              false
procfs                                            /host/proc
proxy-connect-timeout                             2
proxy-idle-timeout-seconds                        60
proxy-initial-fetch-timeout                       30
proxy-max-concurrent-retries                      128
proxy-max-connection-duration-seconds             0
proxy-max-requests-per-connection                 0
proxy-xff-num-trusted-hops-egress                 0
proxy-xff-num-trusted-hops-ingress                0
remove-cilium-node-taints                         true
routing-mode                                      tunnel
service-no-backend-response                       reject
set-cilium-is-up-condition                        true
set-cilium-node-taints                            true
synchronize-k8s-nodes                             true
tofqdns-dns-reject-response-code                  refused
tofqdns-enable-dns-compression                    true
tofqdns-endpoint-max-ip-per-hostname              1000
tofqdns-idle-connection-grace-period              0s
tofqdns-max-deferred-connection-deletes           10000
tofqdns-preallocate-identities                    true
tofqdns-proxy-response-max-delay                  100ms
tunnel-protocol                                   vxlan
tunnel-source-port-range                          0-0
unmanaged-pod-watcher-interval                    15
vtep-cidr                                         
vtep-endpoint                                     
vtep-mac                                          
vtep-mask                                         
write-cni-conf-when-ready                         /host/etc/cni/net.d/05-cilium.conflist
```

## Cluster Summary

### Total Resources
- **Nodes**: 10 (3 control-plane, 7 workers)
- **Namespaces**: 13 active namespaces
- **Total Pods**: ~70 pods across all namespaces
- **Storage**: 27Gi allocated across 4 PVCs

### Key Components Added Since Last Update
- **Tetragon**: 11 pods for eBPF security monitoring
- **Monitoring Stack**: Prometheus + Grafana with persistent storage
- **Sock-shop**: 12 pods for reference microservices application
- **Chatbot**: 1 pod for AI service integration
- **Network Policies**: 12 policies for security segmentation

### Storage Breakdown
- **PostgreSQL**: 5Gi (croc-shop data)
- **Grafana**: 10Gi (monitoring dashboards)
- **Prometheus**: 10Gi (metrics storage)
- **Open-WebUI**: 2Gi (AI interface)

### Monitoring & Security
- **Cilium**: v1.18.6 with Hubble observability
- **Tetragon**: eBPF-based security monitoring
- **Prometheus**: 10-day metrics retention
- **Grafana: Persistent dashboards and alerts

### Microservices Applications
- **croc-shop**: 5 services + frontend + data layer
- **sock-shop**: 8 services + databases
- **chatbot**: AI integration service

### Network Segmentation
- **12 Network Policies** for security isolation
- **Cilium enforcement** with L7 proxy capabilities
- **Gateway API**: Ready for external access (needs re-layering)
