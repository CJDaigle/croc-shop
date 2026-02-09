import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, CreditCard, Truck } from 'lucide-react';

const ORDER_API = process.env.REACT_APP_ORDER_API || '';

function Orders({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      navigate('/login');
    }
  }, [user, navigate]);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${ORDER_API}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setLoading(false);
    }
  };

  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    paid: { color: 'bg-blue-100 text-blue-800', label: 'Paid' },
    shipped: { color: 'bg-purple-100 text-purple-800', label: 'Shipped' },
    delivered: { color: 'bg-green-100 text-green-800', label: 'Delivered' }
  };

  if (loading) return <div className="text-center py-8">Loading orders...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>
      
      {orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">No orders yet</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const cfg = statusConfig[order.status] || statusConfig.pending;
            return (
              <div key={order.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Order #{order.id}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {order.shippingAddress && (
                    <div className="flex items-start text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p>{order.shippingAddress}</p>
                        <p>{order.shippingCity}, {order.shippingState} {order.shippingZip}</p>
                      </div>
                    </div>
                  )}
                  {order.paymentMethod && (
                    <div className="flex items-center text-sm text-gray-600">
                      <CreditCard className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span>{order.paymentMethod.replace('_', ' **** ')}</span>
                    </div>
                  )}
                </div>

                {(order.paidAt || order.shippedAt) && (
                  <div className="flex items-center space-x-6 mb-4 text-xs text-gray-500">
                    {order.paidAt && (
                      <span className="flex items-center">
                        <CreditCard className="w-3 h-3 mr-1" />
                        Paid: {new Date(order.paidAt).toLocaleDateString()}
                      </span>
                    )}
                    {order.shippedAt && (
                      <span className="flex items-center">
                        <Truck className="w-3 h-3 mr-1" />
                        Shipped: {new Date(order.shippedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              
                <div className="border-t pt-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2">
                      <span className="text-gray-700">
                        {item.name} x {item.quantity}
                      </span>
                      <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between">
                    <span className="font-bold text-lg">Total</span>
                    <span className="font-bold text-lg text-indigo-600">${order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Orders;
