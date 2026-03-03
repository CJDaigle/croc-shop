# Croc-Shop Cluster Configuration Dump
Generated: 2026-03-03 14:21:32 UTC

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
croc-shop                     Active   20d
croc-shop-cart                Active   20d
croc-shop-data                Active   20d
croc-shop-frontend            Active   20d
croc-shop-monitoring          Active   20d
croc-shop-order               Active   20d
croc-shop-product-catalog     Active   20d
croc-shop-user                Active   20d
```

## Pods (all croc-shop namespaces)

```
NAME                        READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
frontend-599ff4fc98-d6f77   1/1     Running   0          20d   172.16.6.129   ip-10-0-1-248   <none>           <none>
frontend-599ff4fc98-p8bmc   1/1     Running   0          20d   172.16.5.123   ip-10-0-1-39    <none>           <none>

NAME                               READY   STATUS    RESTARTS   AGE   IP            NODE            NOMINATED NODE   READINESS GATES
product-catalog-7699c8b777-58xlm   1/1     Running   0          20d   172.16.8.73   ip-10-0-1-23    <none>           <none>
product-catalog-7699c8b777-r4rjp   1/1     Running   0          20d   172.16.6.58   ip-10-0-1-248   <none>           <none>

NAME                    READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
user-576f8bc899-bxz98   1/1     Running   0          20d   172.16.6.128   ip-10-0-1-248   <none>           <none>
user-576f8bc899-zh4qz   1/1     Running   0          20d   172.16.4.117   ip-10-0-1-103   <none>           <none>

NAME                    READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
cart-77d748f6f4-22mnc   1/1     Running   0          20d   172.16.8.246   ip-10-0-1-23    <none>           <none>
cart-77d748f6f4-kjwsg   1/1     Running   0          20d   172.16.4.9     ip-10-0-1-103   <none>           <none>

NAME                    READY   STATUS    RESTARTS   AGE   IP             NODE            NOMINATED NODE   READINESS GATES
order-7f895d6c5-bj8hf   1/1     Running   0          20d   172.16.5.239   ip-10-0-1-39    <none>           <none>
order-7f895d6c5-z7ll9   1/1     Running   0          20d   172.16.4.119   ip-10-0-1-103   <none>           <none>

NAME                        READY   STATUS    RESTARTS   AGE   IP             NODE           NOMINATED NODE   READINESS GATES
postgres-588cb7f7bd-9zxhc   1/1     Running   0          20d   172.16.7.242   ip-10-0-1-82   <none>           <none>
redis-599d6dc8bd-6z7tw      1/1     Running   0          20d   172.16.5.119   ip-10-0-1-39   <none>           <none>

No resources found in croc-shop-monitoring namespace.

```

## Services

```
NAME       TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
frontend   ClusterIP   10.43.188.87   <none>        80/TCP    20d

NAME              TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)    AGE
product-catalog   ClusterIP   10.43.67.46   <none>        3001/TCP   20d

NAME   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
user   ClusterIP   10.43.158.48   <none>        3002/TCP   20d

NAME   TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)    AGE
cart   ClusterIP   10.43.18.2   <none>        3003/TCP   20d

NAME    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
order   ClusterIP   10.43.233.185   <none>        3004/TCP   20d

NAME       TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
postgres   ClusterIP   10.43.181.14   <none>        5432/TCP   20d
redis      ClusterIP   10.43.46.244   <none>        6379/TCP   20d

No resources found in croc-shop-monitoring namespace.

```

## Deployments

```
NAME       READY   UP-TO-DATE   AVAILABLE   AGE
frontend   2/2     2            2           20d

NAME              READY   UP-TO-DATE   AVAILABLE   AGE
product-catalog   2/2     2            2           20d

NAME   READY   UP-TO-DATE   AVAILABLE   AGE
user   2/2     2            2           20d

NAME   READY   UP-TO-DATE   AVAILABLE   AGE
cart   2/2     2            2           20d

NAME    READY   UP-TO-DATE   AVAILABLE   AGE
order   2/2     2            2           20d

NAME       READY   UP-TO-DATE   AVAILABLE   AGE
postgres   1/1     1            1           20d
redis      1/1     1            1           20d

No resources found in croc-shop-monitoring namespace.

```

## Horizontal Pod Autoscalers

```
NAME                  REFERENCE                    TARGETS                        MINPODS   MAXPODS   REPLICAS   AGE
product-catalog-hpa   Deployment/product-catalog   cpu: 8%/70%, memory: 27%/80%   2         10        2          20d

NAME       REFERENCE         TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
user-hpa   Deployment/user   cpu: 8%/70%   2         10        2          20d

NAME       REFERENCE         TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
cart-hpa   Deployment/cart   cpu: 1%/70%   2         10        2          20d

NAME        REFERENCE          TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
order-hpa   Deployment/order   cpu: 1%/70%   2         10        2          20d

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
NAMESPACE             NAME                POD-SELECTOR   AGE
cattle-fleet-system   default-allow-all   <none>         20d
```

## CiliumNetworkPolicies

```
No resources found
```

## Persistent Volume Claims

```
NAME           STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
postgres-pvc   Bound    pvc-68f2fbe2-a18f-4ba6-b28e-1583fdff4685   5Gi        RWO            longhorn       <unset>                 20d
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
