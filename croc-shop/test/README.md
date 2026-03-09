# Croc-Shop Load Testing with JMeter

## Overview

This JMeter test plan simulates realistic e-commerce traffic for the Croc-Shop application:

- **Customer Creation**: Generates 100 random customers with fake personal information
- **Order Processing**: Each customer places 10 orders with 2-3 random items each
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
kubectl get pods -n croc-shop
```

### 3. Port Forwarding (Optional)
For local testing, set up port forwarding:
```bash
# User Service
kubectl port-forward -n croc-shop svc/user 3002:3002 &

# Product Catalog Service  
kubectl port-forward -n croc-shop svc/product-catalog 3001:3001 &

# Cart Service
kubectl port-forward -n croc-shop svc/cart 3003:3003 &

# Order Service
kubectl port-forward -n croc-shop svc/order 3004:3004 &
```

## Test Configuration

### Variables
The test uses these configurable variables (in the JMX file):

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `NUM_CUSTOMERS` | 100 | Number of customers to create |
| `ORDERS_PER_CUSTOMER` | 10 | Orders each customer places |
| `USER_SERVICE_HOST` | croc-shop-user.croc-shop | User service hostname |
| `PRODUCT_SERVICE_HOST` | croc-shop-product-catalog.croc-shop | Product service hostname |
| `CART_SERVICE_HOST` | croc-shop-cart.croc-shop | Cart service hostname |
| `ORDER_SERVICE_HOST` | croc-shop-order.croc-shop | Order service hostname |

### Test Data Generation

#### Customer Data (Fake)
- **Names**: Random selection from 20 first names + 20 last names
- **Addresses**: Random street names + cities + states + ZIP codes
- **Contact**: Fake phone numbers and email addresses
- **Payment**: Test credit card numbers (4111 prefix)

#### Order Data
- **Items**: 2-3 random products per order
- **Quantity**: 1-3 units per item
- **Shipping**: Random test addresses
- **Payment**: Test credit card information

## Running the Test

### 1. Command Line
```bash
# Navigate to test directory
cd croc-shop/test

# Run the test
jmeter -n -t croc-shop-load-test.jmx -l results.jtl -j test.log

# With HTML report
jmeter -n -t croc-shop-load-test.jmx -l results.jtl -e -o report/
```

### 2. GUI Mode
```bash
# Open JMeter GUI
jmeter

# File -> Open -> croc-shop-load-test.jmx
# Click "Run" button or press Ctrl+R
```

### 3. Kubernetes Test Runner (Recommended)
```bash
# Use the provided test runner script
./run-jmeter-test.sh
```

## Test Phases

### Phase 1: Customer Creation
- **Thread Group**: Single thread
- **Iterations**: 100 customers
- **Actions**: Create customer accounts with fake data
- **Output**: `customer_data.csv` with customer IDs

### Phase 2: Order Processing  
- **Thread Group**: 10 parallel threads
- **Iterations**: 100 customers × 10 orders each
- **Actions**: Place orders with 2-3 random items
- **Output**: `order_data.csv` with order details

## Output Files

### Test Results
- `croc-shop-test-results.jtl`: Detailed test results
- `croc-shop-test-summary.jtl`: Summary statistics
- `report/`: HTML report (if generated with `-e -o`)

### Data Files
- `customer_data.csv`: Created customer records
- `order_data.csv`: Placed order records
- `test.log`: JMeter execution log

### CSV Formats

#### customer_data.csv
```csv
customerId,firstName,lastName,email
123,John,Smith,johnsmith123@testmail.com
124,Jane,Johnson,janejohnson456@testmail.com
```

#### order_data.csv
```csv
orderId,customerId,numItems,timestamp
4567,123,2,1694123456789
4568,124,3,1694123456790
```

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
kubectl get svc -n croc-shop

# Verify port forwarding
netstat -an | grep 300[1-4]
```

#### High Error Rates
```bash
# Check pod status
kubectl get pods -n croc-shop

# View service logs
kubectl logs -n croc-shop -l app=user
kubectl logs -n croc-shop -l app=order
```

#### Memory Issues
```bash
# Increase JMeter heap size
export JVM_ARGS="-Xms2g -Xmx4g"
jmeter -n -t croc-shop-load-test.jmx -l results.jtl
```

### Debug Mode
```bash
# Run with debug logging
jmeter -n -t croc-shop-load-test.jmx -l results.jtl -j test.log -LDEBUG
```

## Clean Up

After testing, clean up generated files:
```bash
# Remove test data files
rm -f customer_data.csv order_data.csv
rm -f *.jtl test.log

# Remove HTML report
rm -rf report/
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
