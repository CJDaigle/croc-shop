import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import { ShoppingCart, User, Package } from 'lucide-react';
import ProductList from './components/ProductList';
import Cart from './components/Cart';
import Login from './components/Login';
import Orders from './components/Orders';
import Profile from './components/Profile';
import ChatbotWidget from './components/ChatbotWidget';

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCartCount(0);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      if (isTokenExpired(token)) {
        handleLogout();
      } else {
        setUser(JSON.parse(userData));
      }
    }
  }, [handleLogout]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [handleLogout]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="text-2xl font-bold text-indigo-600">
                  Crocs Shop
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link to="/" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">
                  Products
                </Link>
                {user && (
                  <>
                    <Link to="/profile" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      Profile
                    </Link>
                    <Link to="/orders" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                      <Package className="w-4 h-4 mr-1" />
                      Orders
                    </Link>
                    <Link to="/cart" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      Cart {cartCount > 0 && <span className="ml-1 bg-indigo-600 text-white rounded-full px-2 py-0.5 text-xs">{cartCount}</span>}
                    </Link>
                  </>
                )}
                {user ? (
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{user.name}</span>
                    <button
                      onClick={handleLogout}
                      className="ml-2 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link to="/login" className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<ProductList user={user} setCartCount={setCartCount} />} />
            <Route path="/cart" element={<Cart user={user} setCartCount={setCartCount} />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/orders" element={<Orders user={user} />} />
            <Route path="/profile" element={<Profile user={user} />} />
          </Routes>
        </main>

        <ChatbotWidget />
      </div>
    </Router>
  );
}

export default App;
