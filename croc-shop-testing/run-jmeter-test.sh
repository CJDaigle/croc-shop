#!/bin/bash

# Croc-Shop JMeter Test Runner
# This script sets up the environment and runs the load test

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JMX_FILE="$TEST_DIR/croc-shop-load-test.jmx"
RESULTS_DIR="$TEST_DIR/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_FILE="$RESULTS_DIR/croc-shop-test-$TIMESTAMP.jtl"
LOG_FILE="$RESULTS_DIR/test-$TIMESTAMP.log"
HTML_REPORT="$RESULTS_DIR/report-$TIMESTAMP"

# Test parameters
NUM_CUSTOMERS=${NUM_CUSTOMERS:-100}
ORDERS_PER_CUSTOMER=${ORDERS_PER_CUSTOMER:-10}
THREADS=${THREADS:-10}
RAMP_TIME=${RAMP_TIME:-10}

# Service endpoints (can be overridden)
USER_SERVICE_HOST=${USER_SERVICE_HOST:-"croc-shop-user.croc-shop"}
USER_SERVICE_PORT=${USER_SERVICE_PORT:-"3002"}
PRODUCT_SERVICE_HOST=${PRODUCT_SERVICE_HOST:-"croc-shop-product-catalog.croc-shop"}
PRODUCT_SERVICE_PORT=${PRODUCT_SERVICE_PORT:-"3001"}
CART_SERVICE_HOST=${CART_SERVICE_HOST:-"croc-shop-cart.croc-shop"}
CART_SERVICE_PORT=${CART_SERVICE_PORT:-"3003"}
ORDER_SERVICE_HOST=${ORDER_SERVICE_HOST:-"croc-shop-order.croc-shop"}
ORDER_SERVICE_PORT=${ORDER_SERVICE_PORT:-"3004"}

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Croc-Shop Load Test Runner${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -c, --customers NUM        Number of customers (default: 100)"
    echo "  -o, --orders NUM           Orders per customer (default: 10)"
    echo "  -t, --threads NUM          Concurrent threads (default: 10)"
    echo "  -r, --ramp-time NUM        Ramp-up time in seconds (default: 10)"
    echo "  -g, --gui                  Run in GUI mode"
    echo "  -p, --port-forward         Set up port forwarding"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  NUM_CUSTOMERS              Number of customers to create"
    echo "  ORDERS_PER_CUSTOMER        Orders each customer places"
    echo "  USER_SERVICE_HOST          User service hostname"
    echo "  USER_SERVICE_PORT          User service port"
    echo "  PRODUCT_SERVICE_HOST       Product service hostname"
    echo "  PRODUCT_SERVICE_PORT       Product service port"
    echo "  CART_SERVICE_HOST          Cart service hostname"
    echo "  CART_SERVICE_PORT          Cart service port"
    echo "  ORDER_SERVICE_HOST         Order service hostname"
    echo "  ORDER_SERVICE_PORT         Order service port"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run with defaults"
    echo "  $0 -c 50 -o 5               # 50 customers, 5 orders each"
    echo "  $0 -g                       # Run in GUI mode"
    echo "  $0 -p                       # Set up port forwarding and run"
}

check_jmeter() {
    if ! command -v jmeter &> /dev/null; then
        echo -e "${RED}Error: JMeter is not installed or not in PATH${NC}"
        echo "Please install JMeter 5.6.3+ from https://jmeter.apache.org/"
        echo "Or use Homebrew: brew install jmeter"
        exit 1
    fi
    
    echo -e "${GREEN}✓ JMeter found: $(jmeter --version | head -n1)${NC}"
}

check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}Error: kubectl is not installed or not in PATH${NC}"
        echo "Please install kubectl from https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    
    echo -e "${GREEN}✓ kubectl found: $(kubectl version --client --short 2>/dev/null || echo 'version unknown')${NC}"
}

check_cluster_access() {
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Error: Cannot access Kubernetes cluster${NC}"
        echo "Please check your kubeconfig file"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Kubernetes cluster accessible${NC}"
}

check_services() {
    echo "Checking Croc-Shop services..."
    
    local services=(
        "croc-shop-user:3002"
        "croc-shop-product-catalog:3001"
        "croc-shop-cart:3003"
        "croc-shop-order:3004"
    )
    
    for service in "${services[@]}"; do
        local name=$(echo $service | cut -d: -f1)
        local port=$(echo $service | cut -d: -f2)
        
        if kubectl get svc $name -n croc-shop &> /dev/null; then
            echo -e "${GREEN}✓ Service $name found${NC}"
        else
            echo -e "${YELLOW}⚠ Service $name not found in croc-shop namespace${NC}"
        fi
    done
}

setup_port_forwarding() {
    echo "Setting up port forwarding..."
    
    # Kill any existing port forwards
    pkill -f "kubectl.*port-forward.*300[1-4]" || true
    
    # Set up new port forwards
    kubectl port-forward -n croc-shop svc/user 3002:3002 &
    local pf1=$!
    
    kubectl port-forward -n croc-shop svc/product-catalog 3001:3001 &
    local pf2=$!
    
    kubectl port-forward -n croc-shop svc/cart 3003:3003 &
    local pf3=$!
    
    kubectl port-forward -n croc-shop svc/order 3004:3004 &
    local pf4=$!
    
    # Store PIDs for cleanup
    echo "$pf1 $pf2 $pf3 $pf4" > "$TEST_DIR/.port_forward_pids"
    
    # Wait for port forwards to be ready
    sleep 5
    
    echo -e "${GREEN}✓ Port forwarding set up (PIDs: $pf1, $pf2, $pf3, $pf4)${NC}"
    echo "Services accessible at:"
    echo "  - User Service: http://localhost:3002"
    echo "  - Product Service: http://localhost:3001"
    echo "  - Cart Service: http://localhost:3003"
    echo "  - Order Service: http://localhost:3004"
}

cleanup_port_forwarding() {
    if [[ -f "$TEST_DIR/.port_forward_pids" ]]; then
        local pids=$(cat "$TEST_DIR/.port_forward_pids")
        echo "Cleaning up port forwarding..."
        for pid in $pids; do
            kill $pid 2>/dev/null || true
        done
        rm -f "$TEST_DIR/.port_forward_pids"
        echo -e "${GREEN}✓ Port forwarding cleaned up${NC}"
    fi
}

create_results_dir() {
    mkdir -p "$RESULTS_DIR"
    echo -e "${GREEN}✓ Results directory created: $RESULTS_DIR${NC}"
}

update_jmx_parameters() {
    echo "Updating JMX test parameters..."
    
    # Create a temporary JMX file with updated parameters
    local temp_jmx="$TEST_DIR/croc-shop-load-test-$TIMESTAMP.jmx"
    
    sed "s/<stringProp name=\"NUM_CUSTOMERS\">.*<\/stringProp>/<stringProp name=\"NUM_CUSTOMERS\">$NUM_CUSTOMERS<\/stringProp>/g" "$JMX_FILE" | \
    sed "s/<stringProp name=\"ORDERS_PER_CUSTOMER\">.*<\/stringProp>/<stringProp name=\"ORDERS_PER_CUSTOMER\">$ORDERS_PER_CUSTOMER<\/stringProp>/g" | \
    sed "s/<stringProp name=\"ThreadGroup.num_threads\">.*<\/stringProp>/<stringProp name=\"ThreadGroup.num_threads\">$THREADS<\/stringProp>/g" | \
    sed "s/<stringProp name=\"ThreadGroup.ramp_time\">.*<\/stringProp>/<stringProp name=\"ThreadGroup.ramp_time\">$RAMP_TIME<\/stringProp>/g" | \
    sed "s/<stringProp name=\"USER_SERVICE_HOST\">.*<\/stringProp>/<stringProp name=\"USER_SERVICE_HOST\">$USER_SERVICE_HOST<\/stringProp>/g" | \
    sed "s/<stringProp name=\"USER_SERVICE_PORT\">.*<\/stringProp>/<stringProp name=\"USER_SERVICE_PORT\">$USER_SERVICE_PORT<\/stringProp>/g" | \
    sed "s/<stringProp name=\"PRODUCT_SERVICE_HOST\">.*<\/stringProp>/<stringProp name=\"PRODUCT_SERVICE_HOST\">$PRODUCT_SERVICE_HOST<\/stringProp>/g" | \
    sed "s/<stringProp name=\"PRODUCT_SERVICE_PORT\">.*<\/stringProp>/<stringProp name=\"PRODUCT_SERVICE_PORT\">$PRODUCT_SERVICE_PORT<\/stringProp>/g" | \
    sed "s/<stringProp name=\"CART_SERVICE_HOST\">.*<\/stringProp>/<stringProp name=\"CART_SERVICE_HOST\">$CART_SERVICE_HOST<\/stringProp>/g" | \
    sed "s/<stringProp name=\"CART_SERVICE_PORT\">.*<\/stringProp>/<stringProp name=\"CART_SERVICE_PORT\">$CART_SERVICE_PORT<\/stringProp>/g" | \
    sed "s/<stringProp name=\"ORDER_SERVICE_HOST\">.*<\/stringProp>/<stringProp name=\"ORDER_SERVICE_HOST\">$ORDER_SERVICE_HOST<\/stringProp>/g" | \
    sed "s/<stringProp name=\"ORDER_SERVICE_PORT\">.*<\/stringProp>/<stringProp name=\"ORDER_SERVICE_PORT\">$ORDER_SERVICE_PORT<\/stringProp>/g" > "$temp_jmx"
    
    echo "$temp_jmx"
}

run_test_cli() {
    echo "Running JMeter test in CLI mode..."
    
    local temp_jmx=$(update_jmx_parameters)
    
    echo "Test Configuration:"
    echo "  - Customers: $NUM_CUSTOMERS"
    echo "  - Orders per customer: $ORDERS_PER_CUSTOMER"
    echo "  - Total orders: $((NUM_CUSTOMERS * ORDERS_PER_CUSTOMER))"
    echo "  - Concurrent threads: $THREADS"
    echo "  - Ramp-up time: $RAMP_TIME seconds"
    echo "  - Results file: $RESULTS_FILE"
    echo "  - Log file: $LOG_FILE"
    echo ""
    
    # Run the test
    echo "Starting test..."
    jmeter -n -t "$temp_jmx" -l "$RESULTS_FILE" -j "$LOG_FILE"
    
    local exit_code=$?
    
    # Clean up temporary JMX file
    rm -f "$temp_jmx"
    
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}✓ Test completed successfully${NC}"
        
        # Generate HTML report
        echo "Generating HTML report..."
        jmeter -g "$RESULTS_FILE" -o "$HTML_REPORT" &> /dev/null
        
        if [[ -d "$HTML_REPORT" ]]; then
            echo -e "${GREEN}✓ HTML report generated: $HTML_REPORT/index.html${NC}"
        fi
        
        # Show summary
        show_summary
    else
        echo -e "${RED}✗ Test failed with exit code: $exit_code${NC}"
        echo "Check log file: $LOG_FILE"
        exit $exit_code
    fi
}

run_test_gui() {
    echo "Running JMeter in GUI mode..."
    
    local temp_jmx=$(update_jmx_parameters)
    
    echo "Opening JMeter GUI with test plan: $temp_jmx"
    echo "Configuration:"
    echo "  - Customers: $NUM_CUSTOMERS"
    echo "  - Orders per customer: $ORDERS_PER_CUSTOMER"
    echo "  - Total orders: $((NUM_CUSTOMERS * ORDERS_PER_CUSTOMER))"
    echo ""
    echo "Press 'Run' button in JMeter to start the test"
    
    jmeter -t "$temp_jmx"
    
    # Clean up temporary JMX file
    rm -f "$temp_jmx"
}

show_summary() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Test Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if [[ -f "$RESULTS_FILE" ]]; then
        local total_requests=$(grep -c "^[^#]" "$RESULTS_FILE" || echo "0")
        local successful_requests=$(grep ",true," "$RESULTS_FILE" | wc -l || echo "0")
        local failed_requests=$((total_requests - successful_requests))
        
        echo "Total Requests: $total_requests"
        echo "Successful: $successful_requests"
        echo "Failed: $failed_requests"
        
        if [[ $total_requests -gt 0 ]]; then
            local success_rate=$((successful_requests * 100 / total_requests))
            echo "Success Rate: ${success_rate}%"
        fi
    fi
    
    echo ""
    echo "Generated Files:"
    echo "  - Results: $RESULTS_FILE"
    echo "  - Log: $LOG_FILE"
    [[ -d "$HTML_REPORT" ]] && echo "  - HTML Report: $HTML_REPORT/index.html"
    
    if [[ -f "$TEST_DIR/customer_data.csv" ]]; then
        local customer_count=$(wc -l < "$TEST_DIR/customer_data.csv")
        echo "  - Customer Data: $TEST_DIR/customer_data.csv ($customer_count customers)"
    fi
    
    if [[ -f "$TEST_DIR/order_data.csv" ]]; then
        local order_count=$(wc -l < "$TEST_DIR/order_data.csv")
        echo "  - Order Data: $TEST_DIR/order_data.csv ($order_count orders)"
    fi
    
    echo ""
    echo -e "${BLUE}========================================${NC}"
}

cleanup() {
    echo ""
    echo "Cleaning up..."
    cleanup_port_forwarding
}

# Parse command line arguments
GUI_MODE=false
PORT_FORWARD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--customers)
            NUM_CUSTOMERS="$2"
            shift 2
            ;;
        -o|--orders)
            ORDERS_PER_CUSTOMER="$2"
            shift 2
            ;;
        -t|--threads)
            THREADS="$2"
            shift 2
            ;;
        -r|--ramp-time)
            RAMP_TIME="$2"
            shift 2
            ;;
        -g|--gui)
            GUI_MODE=true
            shift
            ;;
        -p|--port-forward)
            PORT_FORWARD=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_header
    
    # Validate inputs
    if ! [[ "$NUM_CUSTOMERS" =~ ^[0-9]+$ ]] || [[ "$NUM_CUSTOMERS" -lt 1 ]]; then
        echo -e "${RED}Error: Number of customers must be a positive integer${NC}"
        exit 1
    fi
    
    if ! [[ "$ORDERS_PER_CUSTOMER" =~ ^[0-9]+$ ]] || [[ "$ORDERS_PER_CUSTOMER" -lt 1 ]]; then
        echo -e "${RED}Error: Orders per customer must be a positive integer${NC}"
        exit 1
    fi
    
    # Check prerequisites
    check_jmeter
    check_kubectl
    check_cluster_access
    check_services
    
    # Set up environment
    create_results_dir
    
    if [[ "$PORT_FORWARD" == true ]]; then
        setup_port_forwarding
        # Set up trap to cleanup port forwarding on exit
        trap cleanup EXIT
    fi
    
    # Run test
    if [[ "$GUI_MODE" == true ]]; then
        run_test_gui
    else
        run_test_cli
    fi
    
    # Cleanup if port forwarding was set up
    if [[ "$PORT_FORWARD" == true ]]; then
        cleanup_port_forwarding
    fi
}

# Run main function
main
