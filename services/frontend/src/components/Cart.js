import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';

const CART_API = process.env.REACT_APP_CART_API || '';
const ORDER_API = process.env.REACT_APP_ORDER_API || '';

function Cart({ user, setCartCount }) {
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      navigate('/login');
    }
  }, [user, navigate]);

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${CART_API}/api/cart/${user.id}`);
      setCart(response.data);
      setCartCount(response.data.items.length);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load cart:', err);
      setLoading(false);
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`${CART_API}/api/cart/${user.id}/items/${productId}`);
      fetchCart();
    } catch (err) {
      alert('Failed to remove item');
    }
  };

  const checkout = async () => {
    try {
      await axios.post(`${ORDER_API}/api/orders`, {
        userId: user.id,
        items: cart.items,
        total: cart.total
      });
      
      await axios.delete(`${CART_API}/api/cart/${user.id}`);
      
      alert('Order placed successfully!');
      navigate('/orders');
    } catch (err) {
      alert('Failed to place order');
    }
  };

  if (loading) return <div className="text-center py-8">Loading cart...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
      
      {cart.items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">Your cart is empty</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {cart.items.map((item) => (
              <div key={item.productId} className="bg-white rounded-lg shadow-md p-6 mb-4">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-gray-600">Quantity: {item.quantity}</p>
                    <p className="text-indigo-600 font-bold">${item.price} each</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xl font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">${cart.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-semibold">Free</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-lg font-bold text-indigo-600">${cart.total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={checkout}
                className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 font-semibold"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;
