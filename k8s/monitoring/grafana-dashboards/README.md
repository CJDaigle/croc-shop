# Grafana Dashboard Import Guide

## 📁 Available Dashboard Panels

### Overview Panels (Fixed for Grafana 12.4.0)
1. **01-service-health.json** - Service health status (UP/DOWN)
2. **02-request-rate.json** - Request rate by service
3. **03-response-time.json** - Response time percentiles
4. **04-error-rate.json** - Error rates (4xx/5xx)
5. **05-top-endpoints.json** - Top 10 endpoints by request rate

### Service-Specific Panels (Fixed for Grafana 12.4.0)
6. **06-user-service.json** - User service metrics
7. **07-cart-service.json** - Cart service metrics + Redis connections

### Complete Dashboard (Fixed for Grafana 12.4.0)
8. **croc-shop-overview.json** - Complete overview dashboard with all panels

### Simple Test Dashboards (Working)
9. **simple-health-dashboard.json** - Basic service health
10. **simple-request-rate-dashboard.json** - Basic request rate

### Sock-Shop Dashboards (New)
11. **sock-shop-health.json** - Sock-shop service health status
12. **sock-shop-overview.json** - Sock-shop complete overview with available metrics

## 🚀 Import Instructions

### Step 1: Access Grafana
```bash
# Start port-forwarding
cd k8s/monitoring/
./access-monitoring.sh

# Open Grafana
http://localhost:3000
# Username: admin
# Password: admin
```

### Step 2: Import Individual Panels

1. **Go to Grafana UI**
2. **Click "+" → "Import"**
3. **Click "Upload JSON file"**
4. **Select the panel JSON file** from `k8s/monitoring/grafana-dashboards/panels/`
5. **Click "Import"**

### Step 3: Create Custom Dashboards

After importing panels, you can:

1. **Combine panels** - Create new dashboards with multiple panels
2. **Arrange layouts** - Drag and resize panels as needed
3. **Customize queries** - Modify PromQL expressions for your needs
4. **Add variables** - Create template variables for dynamic filtering

## 📊 Panel Descriptions

### 1. Service Health
- **Type**: Stat panel with color coding
- **Query**: `up{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}`
- **Shows**: Green (UP) or Red (DOWN) for each service
- **Use**: Quick health check of all services

### 2. Request Rate
- **Type**: Time series graph
- **Query**: `sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}[5m])) by (kubernetes_namespace)`
- **Shows**: Requests per second per service
- **Use**: Traffic patterns and load analysis

### 3. Response Time
- **Type**: Time series graph
- **Query**: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}[5m])) by (le, kubernetes_namespace))`
- **Shows**: 95th and 50th percentile response times
- **Use**: Performance monitoring and SLA tracking

### 4. Error Rate
- **Type**: Time series graph
- **Query**: Error rate calculations for 4xx and 5xx responses
- **Shows**: Percentage of errors per service
- **Use**: Error tracking and quality monitoring

### 5. Top Endpoints
- **Type**: Table
- **Query**: `topk(10, sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}[5m])) by (kubernetes_namespace, endpoint))`
- **Shows**: Top 10 busiest endpoints
- **Use**: Identify hotspots and popular features

### 6. User Service
- **Type**: Combined graphs
- **Shows**: User service request rates and response times
- **Use**: User authentication and profile performance

### 7. Cart Service
- **Type**: Combined graphs and stats
- **Shows**: Cart service metrics and Redis connection count
- **Use**: Shopping cart performance and database health

### 8. Sock-Shop Health
- **Type**: Stat panel with color coding
- **Query**: `up{job="kubernetes-services",kubernetes_namespace="sock-shop"}`
- **Shows**: Green/Red status for sock-shop services
- **Use**: Quick health check of sock-shop microservices

### 9. Sock-Shop Overview
- **Type**: Combined panels
- **Shows**: Service health, HTTP responses, error rates, response times
- **Use**: Complete sock-shop application monitoring

## 🎨 Customization Tips

### Modify Time Ranges
- **Dashboard settings**: Change default time range
- **Panel settings**: Override time range per panel
- **Recommended**: Last 1 hour for real-time, Last 24 hours for trends

### Add Alerts
1. **Go to panel settings**
2. **Click "Alert" tab**
3. **Create alert rule**
4. **Set thresholds** (e.g., error rate > 5%, response time > 1s)
5. **Configure notifications**

### Create Variables
1. **Dashboard settings → Variables**
2. **Add namespace variable**: `kubernetes_namespace`
3. **Add service variable**: `kubernetes_pod_name`
4. **Use in queries**: `$namespace`, `$service`

## 📋 Recommended Dashboard Combinations

### Executive Dashboard
- Service Health
- Request Rate
- Error Rate
- Top Endpoints

### Operations Dashboard
- Service Health
- Response Time
- Error Rate
- User Service + Cart Service panels

### Development Dashboard
- All service-specific panels
- Top Endpoints
- Request Rate

## 🔧 Troubleshooting

### No Data Showing?
1. **Check Prometheus targets**: Verify services are being scraped
2. **Check time range**: Adjust to appropriate time window
3. **Verify queries**: Test PromQL in Prometheus UI first
4. **Check annotations**: Ensure services have `prometheus.io/scrape=true`

### Import Errors?
1. **Validate JSON**: Check JSON syntax
2. **Check Grafana version**: Ensure compatibility
3. **Verify data source**: Prometheus must be configured

### Performance Issues?
1. **Reduce refresh rate**: Change from 5s to 30s or 1m
2. **Simplify queries**: Remove complex aggregations
3. **Limit time range**: Use shorter time windows

## 🚀 Next Steps

1. **Import overview panels** first
2. **Test data availability** in Prometheus
3. **Add service-specific panels** as needed
4. **Create custom dashboards** for different teams
5. **Set up alerting** for critical metrics
6. **Share dashboards** with team members

## 📁 File Structure

```
k8s/monitoring/grafana-dashboards/
├── panels/
│   ├── 01-service-health.json
│   ├── 02-request-rate.json
│   ├── 03-response-time.json
│   ├── 04-error-rate.json
│   ├── 05-top-endpoints.json
│   ├── 06-user-service.json
│   └── 07-cart-service.json
└── README.md (this file)
```

Start importing these panels into Grafana now! 🎯
