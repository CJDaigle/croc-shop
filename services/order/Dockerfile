FROM golang:1.21-alpine3.20 AS builder

WORKDIR /app

COPY . .

RUN go mod tidy && go mod download

RUN CGO_ENABLED=0 GOOS=linux go build -o order-service .

FROM alpine:3.20

RUN apk --no-cache add ca-certificates && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/order-service .

USER appuser

EXPOSE 3004

CMD ["./order-service"]
