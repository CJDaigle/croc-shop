# Croc-Shop Load Testing with JMeter

## Overview

This JMeter test plan simulates realistic e-commerce traffic for the Croc-Shop application:

- **User Registration**: Generates fake users and registers them through the current auth API
- **Checkout Flow**: Updates shipping address, fetches products, adds items to cart, creates orders, and marks them shipped
- **Total Test Volume**: 100 customers × 10 orders = 1,000 orders
- **Data Privacy**: All data is fake/test data only - no real PII

## Prerequisites

### 1. JMeter Installation
```bash
# Download and install JMeter 5.6.3+
# Visit: https://jmeter.apache.org/download_jmeter.cgi
# Or use Homebrew (macOS):
brew install jmeter
```

### 2. Cluster Access
Ensure you have access to the Croc-Shop Kubernetes cluster:
```bash
# Set up kubectl access
export KUBECONFIG=/path/to/your/kubeconfig
kubectl get ns
```

### 3. Port Forwarding (Optional)
For local testing, set up port forwarding:
```bash
# User Service
kubectl port-forward -n croc-shop-user svc/user 3002:3002 &

# Product Catalog Service  
kubectl port-forward -n croc-shop-product-catalog svc/product-catalog 3001:3001 &

# Cart Service
kubectl port-forward -n croc-shop-cart svc/cart 3003:3003 &

# Order Service
kubectl port-forward -n croc-shop-order svc/order 3004:3004 &
```

## Test Configuration

### Variables
The test uses these configurable variables (in the JMX file):

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `NUM_CUSTOMERS` | 100 | Number of customers to create |
| `ORDERS_PER_CUSTOMER` | 10 | Orders each customer places |
| `USER_SERVICE_HOST` | localhost | User service hostname |
| `PRODUCT_SERVICE_HOST` | localhost | Product service hostname |
| `CART_SERVICE_HOST` | localhost | Cart service hostname |
| `ORDER_SERVICE_HOST` | localhost | Order service hostname |

### Test Data Generation

- **Users**: Random names with unique generated email addresses
- **Addresses**: Fake shipping address, city, state, and ZIP values
- **Products**: Product data fetched from the live `GET /api/products` endpoint
- **Payment**: Test payment method identifiers such as `visa_4242`

## Running the Test

### 1. Command Line
```bash
# Navigate to test directory
cd croc-shop-testing

# Run the local test with automatic port-forwarding
./run-jmeter-test.sh -p

# Small verification run
./run-jmeter-test.sh -p -c 2 -o 1 -t 1 -r 1
```

### 2. GUI Mode
```bash
# Open JMeter GUI
jmeter

# File -> Open -> croc-shop-load-test-current-api.jmx
# Click "Run" button or press Ctrl+R
```

### 3. Scripted Local Runner (Recommended)
```bash
# Use the provided test runner script
./run-jmeter-test.sh -p
```

## Test Phases

### Phase 1: User Setup
- **Thread Group**: Single thread
- **Iterations**: 100 users
- **Actions**: Register user accounts and update shipping address

### Phase 2: Shopping and Checkout
- **Thread Group**: 10 parallel threads
- **Iterations**: 100 customers × 10 orders each
- **Actions**: Fetch products, add items to cart, place orders, and mark them shipped

## Output Files

### Test Results
- `results/croc-shop-test-*.jtl`: Detailed test results
- `results/test-*.log`: JMeter execution log
- `results/report-*/`: HTML reports

### Active JMX Files
- `croc-shop-load-test-current-api.jmx`: Current local flow for the live APIs
- `croc-shop-load-test.jmx`: Older legacy plan kept for reference

## Performance Metrics

The test measures:
- **Response Times**: API response latency
- **Throughput**: Requests per second
- **Error Rates**: Failed request percentages
- **Resource Usage**: Service performance under load

## Customization

### Adjusting Test Volume
```xml
<!-- In the JMX file, modify these variables: -->
<stringProp name="NUM_CUSTOMERS">200</stringProp>      <!-- More customers -->
<stringProp name="ORDERS_PER_CUSTOMER">20</stringProp> <!-- More orders per customer -->
```

### Changing Concurrency
```xml
<!-- Modify thread group settings: -->
<stringProp name="ThreadGroup.num_threads">20</stringProp>  <!-- More concurrent users -->
<stringProp name="ThreadGroup.ramp_time">30</stringProp>    <!-- Slower ramp-up -->
```

### Adding Think Time
```xml
<!-- Add a Uniform Random Timer between requests: -->
<UniformRandomTimer guiclass="UniformRandomTimerGui" testclass="UniformRandomTimer" testname="Think Time" enabled="true">
  <stringProp name="ConstantTimer.delay">1000</stringProp>  <!-- 1-3 seconds think time -->
  <stringProp name="RandomTimer.range">2000</stringProp>
</UniformRandomTimer>
```

## Troubleshooting

### Common Issues

#### Connection Refused
```bash
# Check service endpoints
kubectl get svc -n croc-shop-user
kubectl get svc -n croc-shop-product-catalog
kubectl get svc -n croc-shop-cart
kubectl get svc -n croc-shop-order

# Verify port forwarding
netstat -an | grep 300[1-4]
```

#### High Error Rates
```bash
# Check pod status
kubectl get pods -n croc-shop-user
kubectl get pods -n croc-shop-product-catalog
kubectl get pods -n croc-shop-cart
kubectl get pods -n croc-shop-order

# View service logs
kubectl logs -n croc-shop-user -l app=user
kubectl logs -n croc-shop-order -l app=order
```

#### Memory Issues
```bash
# Increase JMeter heap size
export JVM_ARGS="-Xms2g -Xmx4g"
./run-jmeter-test.sh -p -c 10 -o 2 -t 2 -r 5
```

### Debug Mode
```bash
# Run with debug logging
jmeter -n -t croc-shop-load-test-current-api.jmx -l results/debug-results.jtl -j results/debug.log -LDEBUG
```

## Clean Up

After testing, clean up generated files:
```bash
# Remove generated JMX files and result artifacts
rm -f croc-shop-load-test-*.jmx
rm -f results/*.jtl results/*.log
rm -rf results/report-*
```

## Security Notes

- **No Real PII**: All test data is fake and randomly generated
- **Test Environment Only**: Run against test/development environments
- **Network Isolation**: Consider running in isolated network segments
- **Data Cleanup**: Clean up test data after completion

## Extending the Test

### Additional Scenarios
1. **Cart Operations**: Add/remove items from cart
2. **Product Search**: Search functionality testing
3. **User Authentication**: Login/logout flows
4. **Concurrent Users**: Simulate realistic user behavior
5. **Peak Load**: Holiday shopping scenarios

### Monitoring Integration
- **Prometheus Metrics**: Export JMeter metrics
- **Grafana Dashboards**: Real-time performance visualization
- **Alerting**: Set up performance alerts
- **SLA Monitoring**: Service level agreement tracking

## Support

For issues or questions:
1. Check JMeter logs (`test.log`)
2. Verify Kubernetes cluster connectivity
3. Review service endpoints and health
4. Consult Croc-Shop service documentation
