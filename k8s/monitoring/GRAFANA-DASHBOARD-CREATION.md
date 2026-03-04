# Grafana Dashboard Creation Guide

## 🚀 Access Grafana

1. **Start port-forwarding** (if not already running):
   ```bash
   cd k8s/monitoring/
   ./access-monitoring.sh
   ```

2. **Open Grafana**: http://localhost:3000
   - **Username**: admin
   - **Password**: admin

## 📊 Dashboard Creation Steps

### Step 1: Verify Prometheus Data Source

1. Go to **Configuration → Data Sources**
2. Verify **Prometheus** is configured and working
3. Test connection: `http://prometheus.monitoring.svc.cluster.local:9090`

### Step 2: Create Overview Dashboard

1. **Click "+" → "Dashboard"**
2. **Add panels** using these PromQL queries:

#### Panel 1: Service Health (Stat Panel)
```
up{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}
```
- **Legend**: `{{kubernetes_namespace}}/{{kubernetes_pod_name}}`
- **Color mapping**: 1=green (UP), 0=red (DOWN)

#### Panel 2: Request Rate (Graph Panel)
```
sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}[5m])) by (kubernetes_namespace)
```
- **Legend**: `{{kubernetes_namespace}}`
- **Unit**: requests/sec

#### Panel 3: Response Time (Graph Panel)
```
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}[5m])) by (le, kubernetes_namespace))
```
- **Legend**: `95th percentile - {{kubernetes_namespace}}`
- **Unit**: seconds

#### Panel 4: Error Rate (Graph Panel)
```
sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*",status_code=~"5.."}[5m])) by (kubernetes_namespace) / sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace=~"croc-shop-.*"}[5m])) by (kubernetes_namespace) * 100
```
- **Legend**: `5xx Error Rate - {{kubernetes_namespace}}`
- **Unit**: percent (0-100)

### Step 3: Create Service-Specific Dashboards

#### User Service Dashboard
- **User Registration Rate**: `sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace="croc-shop-user",endpoint="/api/auth/register"}[5m]))`
- **Login Success Rate**: `sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace="croc-shop-user",endpoint="/api/auth/login",status_code="200"}[5m]))`
- **User Database Connections**: `pg_stat_database_numbackends{job="kubernetes-pods",kubernetes_namespace="croc-shop-user"}`

#### Cart Service Dashboard  
- **Cart Operations**: `sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace="croc-shop-cart"}[5m])) by (endpoint)`
- **Redis Connections**: `redis_connected_clients{job="kubernetes-pods",kubernetes_namespace="croc-shop-cart"}`
- **Cart Response Time**: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="kubernetes-pods",kubernetes_namespace="croc-shop-cart"}[5m])) by (le, endpoint))`

#### Product Catalog Dashboard
- **Product Views**: `sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace="croc-shop-product-catalog"}[5m])) by (endpoint)`
- **Database Query Performance**: `pg_stat_statements_mean_time{job="kubernetes-pods",kubernetes_namespace="croc-shop-product-catalog"}`

#### Order Service Dashboard
- **Order Creation Rate**: `sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace="croc-shop-order",endpoint=~"/api/orders.*"}[5m]))`
- **Order Processing Time**: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="kubernetes-pods",kubernetes_namespace="croc-shop-order"}[5m])) by (le, endpoint))`

#### Chatbot Service Dashboard
- **Chat Requests**: `sum(rate(http_requests_total{job="kubernetes-pods",kubernetes_namespace="croc-shop-chatbot"}[5m]))`
- **AI API Response Time**: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="kubernetes-pods",kubernetes_namespace="croc-shop-chatbot"}[5m])) by (le, endpoint))`

### Step 4: Export Dashboards

1. **Go to Dashboard Settings** (gear icon)
2. **Click "Save Dashboard"**
3. **Click "Export JSON"**
4. **Save to**: `k8s/monitoring/grafana-dashboards/`

## 🎨 Dashboard Templates

### Template 1: Service Overview
- **Purpose**: High-level health and performance across all services
- **Panels**: Health status, request rate, response time, error rate
- **Refresh**: 5 seconds
- **Time range**: Last 1 hour

### Template 2: Business Metrics
- **Purpose**: Business KPIs and user behavior
- **Panels**: User registrations, orders placed, cart operations
- **Refresh**: 10 seconds
- **Time range**: Last 24 hours

### Template 3: Infrastructure Health
- **Purpose**: System resources and database performance
- **Panels**: Memory usage, CPU, database connections, Redis
- **Refresh**: 15 seconds
- **Time range**: Last 6 hours

## 📋 Dashboard Naming Convention

- `croc-shop-overview.json` - Service health overview
- `croc-shop-user-service.json` - User service specific
- `croc-shop-cart-service.json` - Cart service specific
- `croc-shop-orders-service.json` - Order service specific
- `croc-shop-product-catalog.json` - Product catalog specific
- `croc-shop-chatbot-service.json` - Chatbot service specific
- `croc-shop-business-metrics.json` - Business KPIs
- `croc-shop-infrastructure.json` - Infrastructure health

## 🔧 Customization Tips

### Panel Configuration
- **Visualization**: Choose appropriate type (graph, stat, table, heatmap)
- **Legend**: Use meaningful labels with template variables
- **Axes**: Set proper units and scales
- **Thresholds**: Add visual alerts for critical metrics

### Alerting
1. **Create alert rules** for critical metrics
2. **Set thresholds** based on SLA requirements
3. **Configure notifications** (email, Slack, etc.)
4. **Test alerts** to ensure they work

### Variables
- **Namespace variable**: `kubernetes_namespace`
- **Service variable**: `kubernetes_pod_name`
- **Endpoint variable**: `endpoint`
- **Time range variables**: Custom time ranges

## 🚀 Next Steps

1. **Create the overview dashboard** first
2. **Test all queries** to ensure they return data
3. **Add service-specific dashboards** for detailed monitoring
4. **Set up alerting** for critical metrics
5. **Share dashboards** with the team via JSON export

## 📁 File Structure

```
k8s/monitoring/grafana-dashboards/
├── croc-shop-overview.json
├── croc-shop-user-service.json
├── croc-shop-cart-service.json
├── croc-shop-orders-service.json
├── croc-shop-product-catalog.json
├── croc-shop-chatbot-service.json
├── croc-shop-business-metrics.json
└── croc-shop-infrastructure.json
```

Start with the overview dashboard, then create service-specific ones as needed!
