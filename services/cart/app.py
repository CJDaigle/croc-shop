from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
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

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        token_str = auth_header[7:]
        try:
            payload = jwt.decode(token_str, JWT_SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        auth_user_id = str(payload.get('userId', ''))
        url_user_id = kwargs.get('user_id', '')
        if auth_user_id != url_user_id:
            return jsonify({'error': 'Forbidden'}), 403
        return f(*args, **kwargs)
    return decorated

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
@require_auth
def get_cart(user_id):
    with REQUEST_DURATION.labels(method='GET', endpoint='/api/cart').time():
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
@require_auth
def add_to_cart(user_id):
    with REQUEST_DURATION.labels(method='POST', endpoint='/api/cart/items').time():
        try:
            data = request.json
            product_id = int(data.get('productId'))
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
@require_auth
def remove_from_cart(user_id, product_id):
    with REQUEST_DURATION.labels(method='DELETE', endpoint='/api/cart/items').time():
        try:
            cart_data = redis_client.get(f'cart:{user_id}')
            if not cart_data:
                REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart/items', status=404).inc()
                return jsonify({'error': 'Cart not found'}), 404
            
            cart = json.loads(cart_data)
            pid = int(product_id)
            cart['items'] = [item for item in cart['items'] if item['productId'] != pid]
            cart['total'] = sum(item['price'] * item['quantity'] for item in cart['items'])
            
            redis_client.setex(f'cart:{user_id}', 86400, json.dumps(cart))
            
            REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart/items', status=200).inc()
            return jsonify(cart), 200
        except Exception as e:
            REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart/items', status=500).inc()
            return jsonify({'error': str(e)}), 500

@app.route('/api/cart/<user_id>', methods=['DELETE'])
@require_auth
def clear_cart(user_id):
    with REQUEST_DURATION.labels(method='DELETE', endpoint='/api/cart').time():
        try:
            redis_client.delete(f'cart:{user_id}')
            REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart', status=200).inc()
            return jsonify({'message': 'Cart cleared'}), 200
        except Exception as e:
            REQUEST_COUNT.labels(method='DELETE', endpoint='/api/cart', status=500).inc()
            return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 3003)))
