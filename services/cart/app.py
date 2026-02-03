from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
import json
import os
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=0,
    decode_responses=True
)

REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'])

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'cart'}), 200

@app.route('/ready', methods=['GET'])
def ready():
    try:
        redis_client.ping()
        return jsonify({'status': 'ready'}), 200
    except Exception as e:
        return jsonify({'status': 'not ready', 'error': str(e)}), 503

@app.route('/metrics', methods=['GET'])
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/cart/<user_id>', methods=['GET'])
@REQUEST_DURATION.labels(method='GET', endpoint='/api/cart').time()
def get_cart(user_id):
    try:
        cart_data = redis_client.get(f'cart:{user_id}')
        if cart_data:
            cart = json.loads(cart_data)
        else:
            cart = {'items': [], 'total': 0}
        
        REQUEST_COUNT.labels(method='GET', endpoint='/api/cart', status=200).inc()
        return jsonify(cart), 200
    except Exception as e:
        REQUEST_COUNT.labels(method='GET', endpoint='/api/cart', status=500).inc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cart/<user_id>/items', methods=['POST'])
@REQUEST_DURATION.labels(method='POST', endpoint='/api/cart/items').time()
def add_to_cart(user_id):
    try:
        data = request.json
        product_id = data.get('productId')
        quantity = data.get('quantity', 1)
        price = data.get('price')
        name = data.get('name')
        
        if not all([product_id, price, name]):
            REQUEST_COUNT.labels(method='POST', endpoint='/api/cart/items', status=400).inc()
            return jsonify({'error': 'Missing required fields'}), 400
        
        cart_data = redis_client.get(f'cart:{user_id}')
        if cart_data:
            cart = json.loads(cart_data)
        else:
            cart = {'items': [], 'total': 0}
        
        existing_item = next((item for item in cart['items'] if item['productId'] == product_id), None)
        
        if existing_item:
            existing_item['quantity'] += quantity
        else:
            cart['items'].append({
                'productId': product_id,
                'name': name,
                'price': price,
                'quantity': quantity
            })
        
        cart['total'] = sum(item['price'] * item['quantity'] for item in cart['items'])
        
        redis_client.setex(f'cart:{user_id}', 86400, json.dumps(cart))
        
        REQUEST_COUNT.labels(method='POST', endpoint='/api/cart/items', status=200).inc()
        return jsonify(cart), 200
    except Exception as e:
        REQUEST_COUNT.labels(method='POST', endpoint='/api/cart/items', status=500).inc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cart/<user_id>/items/<product_id>', methods=['DELETE'])
@REQUEST_DURATION.labels(method='DELETE', endpoint='/api/cart/items').time()
def remove_from_cart(user_id, product_id):
    try:
        cart_data = redis_client.get(f'cart:{user_id}')
        if not cart_data:
            REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart/items', status=404).inc()
            return jsonify({'error': 'Cart not found'}), 404
        
        cart = json.loads(cart_data)
        cart['items'] = [item for item in cart['items'] if item['productId'] != int(product_id)]
        cart['total'] = sum(item['price'] * item['quantity'] for item in cart['items'])
        
        redis_client.setex(f'cart:{user_id}', 86400, json.dumps(cart))
        
        REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart/items', status=200).inc()
        return jsonify(cart), 200
    except Exception as e:
        REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart/items', status=500).inc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cart/<user_id>', methods=['DELETE'])
@REQUEST_DURATION.labels(method='DELETE', endpoint='/api/cart').time()
def clear_cart(user_id):
    try:
        redis_client.delete(f'cart:{user_id}')
        REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart', status=200).inc()
        return jsonify({'message': 'Cart cleared'}), 200
    except Exception as e:
        REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart', status=500).inc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 3003)))
