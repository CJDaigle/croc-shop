import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';

const USER_API = process.env.REACT_APP_USER_API || '';

function Profile({ user }) {
  const [address, setAddress] = useState({
    shippingAddress: '',
    shippingCity: '',
    shippingState: '',
    shippingZip: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${USER_API}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAddress({
        shippingAddress: response.data.shippingAddress || '',
        shippingCity: response.data.shippingCity || '',
        shippingState: response.data.shippingState || '',
        shippingZip: response.data.shippingZip || ''
      });
      setLoading(false);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${USER_API}/api/users/me/address`, address, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Shipping address saved!');
    } catch (err) {
      setMessage('Failed to save address');
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-8">Loading profile...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center mb-4">
          <div className="bg-indigo-100 rounded-full p-3 mr-4">
            <MapPin className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Shipping Address</h2>

        {message && (
          <div className={`px-4 py-3 rounded mb-4 ${message.includes('Failed') ? 'bg-red-100 border border-red-400 text-red-700' : 'bg-green-100 border border-green-400 text-green-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input
              type="text"
              name="shippingAddress"
              value={address.shippingAddress}
              onChange={handleChange}
              placeholder="123 Main St"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="shippingCity"
                value={address.shippingCity}
                onChange={handleChange}
                placeholder="New York"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="shippingState"
                value={address.shippingState}
                onChange={handleChange}
                placeholder="NY"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                name="shippingZip"
                value={address.shippingZip}
                onChange={handleChange}
                placeholder="10001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Address'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
