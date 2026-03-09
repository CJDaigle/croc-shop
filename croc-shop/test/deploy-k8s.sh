#!/bin/bash

# Kubernetes JMeter Test Deployment Script
# Deploys JMeter load testing as a pod inside the cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="testing"
DOMAIN="testing.apo-llm-test.com"
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/.kube/config}"

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Kubernetes JMeter Test Deployment${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}Error: kubectl is not installed${NC}"
        exit 1
    fi
    
    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Error: Cannot access Kubernetes cluster${NC}"
        exit 1
    fi
    
    # Check cert-manager
    if ! kubectl get crd certificates.cert-manager.io &> /dev/null; then
        echo -e "${YELLOW}Warning: cert-manager not found - TLS certificates will not be auto-generated${NC}"
    fi
    
    # Check Cilium Gateway API
    if ! kubectl get gatewayclass cilium &> /dev/null; then
        echo -e "${YELLOW}Warning: Cilium GatewayClass not found - Gateway routing may not work${NC}"
    fi
    
    echo -e "${GREEN}✓ Prerequisites checked${NC}"
}

create_namespace() {
    echo "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        echo -e "${YELLOW}Namespace $NAMESPACE already exists${NC}"
    else
        kubectl apply -f k8s/namespace.yaml
        echo -e "${GREEN}✓ Namespace $NAMESPACE created${NC}"
    fi
}

create_secrets() {
    echo "Creating secrets..."
    
    # Create kubeconfig secret
    if [[ -f "$KUBECONFIG_PATH" ]]; then
        echo "Creating kubeconfig secret..."
        
        # Create a temporary kubeconfig with cluster-internal access
        temp_kubeconfig=$(mktemp)
        cp "$KUBECONFIG_PATH" "$temp_kubeconfig"
        
        # Convert to base64
        kubeconfig_b64=$(base64 -w 0 "$temp_kubeconfig")
        
        # Update the secret with actual kubeconfig
        cat > k8s/kubeconfig-secret.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: jmeter-kubeconfig
  namespace: $NAMESPACE
type: Opaque
data:
  config: $kubeconfig_b64
EOF
        
        kubectl apply -f k8s/kubeconfig-secret.yaml
        rm -f "$temp_kubeconfig"
        echo -e "${GREEN}✓ Kubeconfig secret created${NC}"
    else
        echo -e "${YELLOW}Warning: No kubeconfig found at $KUBECONFIG_PATH${NC}"
    fi
    
    # Apply certificate configuration
    kubectl apply -f k8s/secrets.yaml
    echo -e "${GREEN}✓ Secrets applied${NC}"
}

create_gateway() {
    echo "Creating Gateway configuration..."
    
    kubectl apply -f k8s/gateway.yaml
    echo -e "${GREEN}✓ Gateway configuration applied${NC}"
    
    # Wait for gateway to be ready
    echo "Waiting for Gateway to be ready..."
    kubectl wait --for=condition=programmed gateway/testing-gateway -n $NAMESPACE --timeout=300s || {
        echo -e "${YELLOW}Warning: Gateway may not be fully programmed yet${NC}"
    }
}

create_configmaps() {
    echo "Creating ConfigMaps..."
    
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/jmx-configmap.yaml
    echo -e "${GREEN}✓ ConfigMaps created${NC}"
}

deploy_jmeter() {
    echo "Deploying JMeter test pod..."
    
    # Deploy the Job (preferred approach)
    kubectl apply -f k8s/jmeter-pod.yaml
    echo -e "${GREEN}✓ JMeter test Job deployed${NC}"
}

wait_for_completion() {
    echo "Waiting for test completion..."
    
    # Wait for the job to complete
    kubectl wait --for=condition=complete job/jmeter-load-test -n $NAMESPACE --timeout=1800s || {
        echo -e "${YELLOW}Warning: Test job may still be running or failed${NC}"
        return 1
    }
    
    echo -e "${GREEN}✓ Test job completed${NC}"
}

show_results() {
    echo "Retrieving test results..."
    
    # Get the pod name
    pod_name=$(kubectl get pods -n $NAMESPACE -l app=jmeter-test -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod_name" ]]; then
        echo "Test results from pod: $pod_name"
        
        # Show summary
        echo ""
        echo -e "${BLUE}=== Test Summary ===${NC}"
        kubectl logs $pod_name -n $NAMESPACE | grep -A 20 "=== Test Summary ===" || echo "Summary not found"
        
        # Copy results locally
        results_dir="./results-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$results_dir"
        
        echo ""
        echo "Copying results to $results_dir..."
        kubectl cp $pod_name:/results -n $NAMESPACE "$results_dir/" 2>/dev/null || echo "Could not copy results"
        
        if [[ -f "$results_dir/summary.txt" ]]; then
            echo -e "${GREEN}✓ Results copied to $results_dir${NC}"
            cat "$results_dir/summary.txt"
        fi
    else
        echo -e "${YELLOW}No test pod found${NC}"
        
        # Show job status
        echo ""
        echo "Job status:"
        kubectl get job jmeter-load-test -n $NAMESPACE -o wide || echo "Job not found"
        
        echo ""
        echo "Pods in $NAMESPACE namespace:"
        kubectl get pods -n $NAMESPACE || echo "No pods found"
    fi
}

cleanup() {
    echo "Cleaning up..."
    
    # Optional cleanup - uncomment if you want to clean up after test
    # kubectl delete namespace $NAMESPACE --ignore-not-found=true
    
    echo -e "${GREEN}✓ Cleanup completed${NC}"
}

show_status() {
    echo ""
    echo -e "${BLUE}=== Deployment Status ===${NC}"
    
    echo "Namespace:"
    kubectl get namespace $NAMESPACE || echo "Namespace not found"
    
    echo ""
    echo "Gateway:"
    kubectl get gateway testing-gateway -n $NAMESPACE -o wide || echo "Gateway not found"
    
    echo ""
    echo "HTTPRoutes:"
    kubectl get httproute -n $NAMESPACE || echo "No HTTPRoutes found"
    
    echo ""
    echo "Certificate:"
    kubectl get certificate testing-apo-llm-test-com-tls -n $NAMESPACE || echo "Certificate not found"
    
    echo ""
    echo "Job:"
    kubectl get job jmeter-load-test -n $NAMESPACE || echo "Job not found"
    
    echo ""
    echo "Pods:"
    kubectl get pods -n $NAMESPACE || echo "No pods found"
}

main() {
    print_header
    
    # Parse command line arguments
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            create_namespace
            create_secrets
            create_gateway
            create_configmaps
            deploy_jmeter
            wait_for_completion
            show_results
            ;;
        "status")
            show_status
            ;;
        "results")
            show_results
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [COMMAND]"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy JMeter test (default)"
            echo "  status   - Show deployment status"
            echo "  results  - Show test results"
            echo "  cleanup  - Clean up resources"
            echo "  help     - Show this help"
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
