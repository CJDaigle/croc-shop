.PHONY: help build deploy deploy-istio deploy-monitoring clean test

help:
	@echo "Crocs Shop - Cloud Native Application"
	@echo ""
	@echo "Available targets:"
	@echo "  build              - Build all Docker images"
	@echo "  deploy             - Deploy to Kubernetes (without Istio)"
	@echo "  deploy-istio       - Deploy to Kubernetes with Istio"
	@echo "  deploy-monitoring  - Deploy monitoring stack (Prometheus + Grafana)"
	@echo "  clean              - Remove all Kubernetes resources"
	@echo "  test               - Run tests (placeholder)"
	@echo "  docker-up          - Start with Docker Compose"
	@echo "  docker-down        - Stop Docker Compose"
	@echo "  status             - Check deployment status"
	@echo "  logs               - Tail logs from all services"

build:
	@chmod +x scripts/build-images.sh
	@./scripts/build-images.sh

deploy:
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh

deploy-istio:
	@chmod +x scripts/deploy-istio.sh
	@./scripts/deploy-istio.sh

deploy-monitoring:
	@chmod +x scripts/deploy-monitoring.sh
	@./scripts/deploy-monitoring.sh

clean:
	@chmod +x scripts/cleanup.sh
	@./scripts/cleanup.sh

docker-up:
	docker-compose up --build -d

docker-down:
	docker-compose down -v

status:
	@echo "Checking deployment status across all namespaces..."
	@echo ""
	@echo "=== Namespaces ==="
	@kubectl get namespaces -l app=croc-shop
	@echo ""
	@echo "=== Pods ==="
	@kubectl get pods --all-namespaces -l app=croc-shop
	@echo ""
	@echo "=== Services ==="
	@kubectl get svc --all-namespaces -l app=croc-shop
	@echo ""
	@echo "=== HPAs ==="
	@kubectl get hpa -n croc-shop-product-catalog
	@kubectl get hpa -n croc-shop-user
	@kubectl get hpa -n croc-shop-cart
	@kubectl get hpa -n croc-shop-order

logs:
	@echo "Tailing logs from all services..."
	@kubectl logs -n croc-shop-product-catalog -l app=product-catalog --tail=50
	@kubectl logs -n croc-shop-user -l app=user --tail=50
	@kubectl logs -n croc-shop-cart -l app=cart --tail=50
	@kubectl logs -n croc-shop-order -l app=order --tail=50

test:
	@echo "Running tests..."
	@echo "Tests not yet implemented"
