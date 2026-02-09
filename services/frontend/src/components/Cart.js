import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Trash2, CreditCard, Truck, CheckCircle } from 'lucide-react';

const CART_API = process.env.REACT_APP_CART_API || '';
const ORDER_API = process.env.REACT_APP_ORDER_API || '';
const USER_API = process.env.REACT_APP_USER_API || '';

function Cart({ user, setCartCount }) {
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('cart');
  const [processing, setProcessing] = useState(false);
  const [shippingAddress, setShippingAddress] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('visa_4242');
  const [orderResult, setOrderResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      navigate('/login');
    }
  }, [user, navigate]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${CART_API}/api/cart/${user.id}`, getAuthHeaders());
      setCart(response.data);
      setCartCount(response.data.items.length);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load cart:', err);
      setLoading(false);
    }
  };

  const fetchAddress = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${USER_API}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShippingAddress(response.data);
    } catch (err) {
      console.error('Failed to load address:', err);
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`${CART_API}/api/cart/${user.id}/items/${productId}`, getAuthHeaders());
      fetchCart();
    } catch (err) {
      alert('Failed to remove item');
    }
  };

  const proceedToCheckout = async () => {
    await fetchAddress();
    setStep('checkout');
  };

  const processPayment = async () => {
    if (!shippingAddress?.shippingAddress) {
      alert('Please add a shipping address in your Profile first.');
      navigate('/profile');
      return;
    }

    setProcessing(true);
    setStep('processing');

    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const token = localStorage.getItem('token');
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

      const orderResponse = await axios.post(`${ORDER_API}/api/orders`, {
        items: cart.items,
        total: cart.total,
        shippingAddress: shippingAddress.shippingAddress,
        shippingCity: shippingAddress.shippingCity,
        shippingState: shippingAddress.shippingState,
        shippingZip: shippingAddress.shippingZip,
        paymentMethod: paymentMethod
      }, authHeaders);

      setOrderResult(orderResponse.data);

      await new Promise(resolve => setTimeout(resolve, 1000));

      await axios.patch(`${ORDER_API}/api/orders/${orderResponse.data.id}/status`, {
        status: 'shipped'
      }, authHeaders);

      setOrderResult(prev => ({ ...prev, status: 'shipped' }));

      await axios.delete(`${CART_API}/api/cart/${user.id}`, authHeaders);
      setCartCount(0);

      setStep('complete');
    } catch (err) {
      console.error('Checkout failed:', err);
      alert('Checkout failed. Please try again.');
      setStep('checkout');
    }
    setProcessing(false);
  };

  if (loading) return <div className="text-center py-8">Loading cart...</div>;

  if (step === 'processing') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment...</h2>
        <p className="text-gray-600">Please wait while we process your order.</p>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
        <p className="text-gray-600 mb-2">Order #{orderResult?.id} has been placed and shipped.</p>
        <p className="text-gray-600 mb-6">
          Shipping to: {shippingAddress?.shippingAddress}, {shippingAddress?.shippingCity}, {shippingAddress?.shippingState} {shippingAddress?.shippingZip}
        </p>
        <div className="space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            View Orders
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  if (step === 'checkout') {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <Truck className="w-5 h-5 mr-2 text-indigo-600" />
            Shipping Address
          </h2>
          {shippingAddress?.shippingAddress ? (
            <div className="text-gray-700">
              <p>{shippingAddress.shippingAddress}</p>
              <p>{shippingAddress.shippingCity}, {shippingAddress.shippingState} {shippingAddress.shippingZip}</p>
            </div>
          ) : (
            <div>
              <p className="text-red-600 mb-2">No shipping address on file.</p>
              <button
                onClick={() => navigate('/profile')}
                className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm"
              >
                Add Shipping Address
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-indigo-600" />
            Payment Method
          </h2>
          <div className="space-y-2">
            {[
              { id: 'visa_4242', label: 'Visa ending in 4242', icon: 'VISA' },
              { id: 'mc_5555', label: 'Mastercard ending in 5555', icon: 'MC' },
              { id: 'amex_3782', label: 'Amex ending in 3782', icon: 'AMEX' }
            ].map((method) => (
              <label key={method.id} className={`flex items-center p-3 border rounded-md cursor-pointer ${paymentMethod === method.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="payment"
                  value={method.id}
                  checked={paymentMethod === method.id}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mr-3"
                />
                <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded mr-3">{method.icon}</span>
                <span className="text-gray-700">{method.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Order Summary</h2>
          {cart.items.map((item) => (
            <div key={item.productId} className="flex justify-between py-2">
              <span className="text-gray-700">{item.name} x {item.quantity}</span>
              <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between">
            <span className="text-lg font-bold">Total</span>
            <span className="text-lg font-bold text-indigo-600">${cart.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => setStep('cart')}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-md hover:bg-gray-300 font-semibold"
          >
            Back to Cart
          </button>
          <button
            onClick={processPayment}
            disabled={processing}
            className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-semibold disabled:opacity-50 flex items-center justify-center"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Pay ${cart.total.toFixed(2)}
          </button>
        </div>
      </div>
    );
  }

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
                onClick={proceedToCheckout}
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
