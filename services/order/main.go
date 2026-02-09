package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/cors"
)

var db *sql.DB

type Order struct {
	ID              int       `json:"id"`
	UserID          int       `json:"userId"`
	Items           []Item    `json:"items"`
	Total           float64   `json:"total"`
	Status          string    `json:"status"`
	ShippingAddress string    `json:"shippingAddress"`
	ShippingCity    string    `json:"shippingCity"`
	ShippingState   string    `json:"shippingState"`
	ShippingZip     string    `json:"shippingZip"`
	PaymentMethod   string    `json:"paymentMethod"`
	PaidAt          *string   `json:"paidAt"`
	ShippedAt       *string   `json:"shippedAt"`
	CreatedAt       time.Time `json:"createdAt"`
}

type Item struct {
	ProductID int     `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
}

type CreateOrderRequest struct {
	UserID          int     `json:"userId"`
	Items           []Item  `json:"items"`
	Total           float64 `json:"total"`
	ShippingAddress string  `json:"shippingAddress"`
	ShippingCity    string  `json:"shippingCity"`
	ShippingState   string  `json:"shippingState"`
	ShippingZip     string  `json:"shippingZip"`
	PaymentMethod   string  `json:"paymentMethod"`
}

var (
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

func ensureSchema() error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS orders (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			items JSONB NOT NULL DEFAULT '[]',
			total NUMERIC(10,2) NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'pending',
			shipping_address TEXT,
			shipping_city TEXT,
			shipping_state TEXT,
			shipping_zip TEXT,
			payment_method TEXT,
			paid_at TIMESTAMPTZ,
			shipped_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW()
		);
	`)
	if err != nil {
		return err
	}
	cols := []struct{ name, typ string }{
		{"shipping_address", "TEXT"},
		{"shipping_city", "TEXT"},
		{"shipping_state", "TEXT"},
		{"shipping_zip", "TEXT"},
		{"payment_method", "TEXT"},
		{"paid_at", "TIMESTAMPTZ"},
		{"shipped_at", "TIMESTAMPTZ"},
	}
	for _, c := range cols {
		db.Exec(fmt.Sprintf("ALTER TABLE orders ADD COLUMN IF NOT EXISTS %s %s;", c.name, c.typ))
	}
	return nil
}

func scanOrder(row interface {
	Scan(dest ...interface{}) error
}) (*Order, error) {
	var o Order
	var itemsJSON []byte
	var paidAt, shippedAt sql.NullString
	err := row.Scan(&o.ID, &o.UserID, &itemsJSON, &o.Total, &o.Status,
		&o.ShippingAddress, &o.ShippingCity, &o.ShippingState, &o.ShippingZip,
		&o.PaymentMethod, &paidAt, &shippedAt, &o.CreatedAt)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(itemsJSON, &o.Items)
	if paidAt.Valid {
		o.PaidAt = &paidAt.String
	}
	if shippedAt.Valid {
		o.ShippedAt = &shippedAt.String
	}
	return &o, nil
}

const orderCols = `id, user_id, items, total::float8, status, 
	COALESCE(shipping_address,''), COALESCE(shipping_city,''), COALESCE(shipping_state,''), COALESCE(shipping_zip,''),
	COALESCE(payment_method,''), paid_at, shipped_at, created_at`

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "order",
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func getOrdersHandler(w http.ResponseWriter, r *http.Request) {
	timer := prometheus.NewTimer(httpRequestDuration.WithLabelValues("GET", "/api/orders"))
	defer timer.ObserveDuration()

	userIDStr := r.URL.Query().Get("userId")
	var rows *sql.Rows
	var err error

	if userIDStr != "" {
		userID, convErr := strconv.Atoi(userIDStr)
		if convErr != nil {
			httpRequestsTotal.WithLabelValues("GET", "/api/orders", "400").Inc()
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}
		rows, err = db.Query(fmt.Sprintf("SELECT %s FROM orders WHERE user_id = $1 ORDER BY created_at DESC", orderCols), userID)
	} else {
		rows, err = db.Query(fmt.Sprintf("SELECT %s FROM orders ORDER BY created_at DESC", orderCols))
	}

	if err != nil {
		httpRequestsTotal.WithLabelValues("GET", "/api/orders", "500").Inc()
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	orderList := make([]*Order, 0)
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			log.Printf("Error scanning order: %v", err)
			continue
		}
		orderList = append(orderList, o)
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

	itemsJSON, _ := json.Marshal(req.Items)

	status := "paid"
	row := db.QueryRow(
		fmt.Sprintf(`INSERT INTO orders (user_id, items, total, status, shipping_address, shipping_city, shipping_state, shipping_zip, payment_method, paid_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING %s`, orderCols),
		req.UserID, itemsJSON, req.Total, status,
		req.ShippingAddress, req.ShippingCity, req.ShippingState, req.ShippingZip,
		req.PaymentMethod,
	)

	order, err := scanOrder(row)
	if err != nil {
		log.Printf("Error creating order: %v", err)
		httpRequestsTotal.WithLabelValues("POST", "/api/orders", "500").Inc()
		http.Error(w, "Failed to create order", http.StatusInternalServerError)
		return
	}

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

	row := db.QueryRow(fmt.Sprintf("SELECT %s FROM orders WHERE id = $1", orderCols), orderID)
	order, err := scanOrder(row)
	if err != nil {
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

	var extra string
	if req.Status == "shipped" {
		extra = ", shipped_at = NOW()"
	} else if req.Status == "paid" {
		extra = ", paid_at = NOW()"
	}

	row := db.QueryRow(
		fmt.Sprintf("UPDATE orders SET status = $1%s WHERE id = $2 RETURNING %s", extra, orderCols),
		req.Status, orderID,
	)
	order, err := scanOrder(row)
	if err != nil {
		httpRequestsTotal.WithLabelValues("PATCH", "/api/orders/:id/status", "404").Inc()
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
	httpRequestsTotal.WithLabelValues("PATCH", "/api/orders/:id/status", "200").Inc()
}

func main() {
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "postgres"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "crocshop"
	}
	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "postgres"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	if err := ensureSchema(); err != nil {
		log.Fatalf("Failed to ensure schema: %v", err)
	}

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
