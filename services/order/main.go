package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/cors"
)

type Order struct {
	ID        int       `json:"id"`
	UserID    int       `json:"userId"`
	Items     []Item    `json:"items"`
	Total     float64   `json:"total"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type Item struct {
	ProductID int     `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
}

type CreateOrderRequest struct {
	UserID int     `json:"userId"`
	Items  []Item  `json:"items"`
	Total  float64 `json:"total"`
}

var (
	orders      = make(map[int]*Order)
	ordersMutex sync.RWMutex
	nextOrderID = 1

	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "Duration of HTTP requests in seconds",
		},
		[]string{"method", "endpoint"},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "order",
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func getOrdersHandler(w http.ResponseWriter, r *http.Request) {
	timer := prometheus.NewTimer(httpRequestDuration.WithLabelValues("GET", "/api/orders"))
	defer timer.ObserveDuration()

	ordersMutex.RLock()
	defer ordersMutex.RUnlock()

	userIDStr := r.URL.Query().Get("userId")
	var orderList []*Order

	if userIDStr != "" {
		userID, err := strconv.Atoi(userIDStr)
		if err != nil {
			httpRequestsTotal.WithLabelValues("GET", "/api/orders", "400").Inc()
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		for _, order := range orders {
			if order.UserID == userID {
				orderList = append(orderList, order)
			}
		}
	} else {
		for _, order := range orders {
			orderList = append(orderList, order)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orderList)
	httpRequestsTotal.WithLabelValues("GET", "/api/orders", "200").Inc()
}

func createOrderHandler(w http.ResponseWriter, r *http.Request) {
	timer := prometheus.NewTimer(httpRequestDuration.WithLabelValues("POST", "/api/orders"))
	defer timer.ObserveDuration()

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpRequestsTotal.WithLabelValues("POST", "/api/orders", "400").Inc()
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ordersMutex.Lock()
	order := &Order{
		ID:        nextOrderID,
		UserID:    req.UserID,
		Items:     req.Items,
		Total:     req.Total,
		Status:    "pending",
		CreatedAt: time.Now(),
	}
	orders[nextOrderID] = order
	nextOrderID++
	ordersMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
	httpRequestsTotal.WithLabelValues("POST", "/api/orders", "201").Inc()
}

func getOrderHandler(w http.ResponseWriter, r *http.Request) {
	timer := prometheus.NewTimer(httpRequestDuration.WithLabelValues("GET", "/api/orders/:id"))
	defer timer.ObserveDuration()

	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		httpRequestsTotal.WithLabelValues("GET", "/api/orders/:id", "400").Inc()
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	ordersMutex.RLock()
	order, exists := orders[orderID]
	ordersMutex.RUnlock()

	if !exists {
		httpRequestsTotal.WithLabelValues("GET", "/api/orders/:id", "404").Inc()
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
	httpRequestsTotal.WithLabelValues("GET", "/api/orders/:id", "200").Inc()
}

func updateOrderStatusHandler(w http.ResponseWriter, r *http.Request) {
	timer := prometheus.NewTimer(httpRequestDuration.WithLabelValues("PATCH", "/api/orders/:id/status"))
	defer timer.ObserveDuration()

	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		httpRequestsTotal.WithLabelValues("PATCH", "/api/orders/:id/status", "400").Inc()
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpRequestsTotal.WithLabelValues("PATCH", "/api/orders/:id/status", "400").Inc()
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ordersMutex.Lock()
	order, exists := orders[orderID]
	if !exists {
		ordersMutex.Unlock()
		httpRequestsTotal.WithLabelValues("PATCH", "/api/orders/:id/status", "404").Inc()
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}
	order.Status = req.Status
	ordersMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
	httpRequestsTotal.WithLabelValues("PATCH", "/api/orders/:id/status", "200").Inc()
}

func main() {
	r := mux.NewRouter()

	r.HandleFunc("/health", healthHandler).Methods("GET")
	r.HandleFunc("/ready", readyHandler).Methods("GET")
	r.Handle("/metrics", promhttp.Handler()).Methods("GET")

	r.HandleFunc("/api/orders", getOrdersHandler).Methods("GET")
	r.HandleFunc("/api/orders", createOrderHandler).Methods("POST")
	r.HandleFunc("/api/orders/{id}", getOrderHandler).Methods("GET")
	r.HandleFunc("/api/orders/{id}/status", updateOrderStatusHandler).Methods("PATCH")

	handler := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	}).Handler(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3004"
	}

	log.Printf("Order Service running on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), handler))
}
