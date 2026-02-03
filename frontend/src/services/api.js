// frontend/src/services/api.js

import axios from 'axios';

// Create an 'instance' of axios with the base URL of your backend
const api = axios.create({
  baseURL: 'http://localhost:5000/api', // This matches your server.js
});

// This "interceptor" automatically adds the auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- Authentication API ---
export const authAPI = {
  customerLogin: (credentials) => api.post('/customer/login', credentials),
  customerRegister: (signupData) => api.post('/customer/register', signupData),
  sellerLogin: (credentials) => api.post('/seller/login', credentials),
  sellerRegister: (signupData) => api.post('/seller/register', signupData),
};

// --- Dish API ---
export const dishAPI = {
  getAllDishes: () => api.get('/dishes'),
  
  // Sends FormData (with file)
  createDish: (formData) => api.post('/dishes', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }), 
  
  getSellerDishes: () => api.get('/seller/dishes'),
};

// --- Order API ---
export const orderAPI = {
  createOrder: (orderData) => api.post('/orders', orderData),
  getCustomerOrders: () => api.get('/customer/orders'),
  getSellerOrders: () => api.get('/seller/orders'),
  updateOrderStatus: (orderId, status) => api.patch(`/orders/${orderId}/status`, { status }),
};

// --- Seller API (Stats & Logo) ---
export const sellerAPI = {
  getSellerStats: () => api.get('/seller/stats'),
  
  // Sends FormData (with file)
  updateLogo: (formData) => api.patch('/seller/logo', formData, {
     headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
};

// --- Review API ---
export const reviewAPI = {
    createReview: (reviewData) => api.post('/reviews', reviewData),
    getSellerReviews: (sellerId) => api.get(`/seller/${sellerId}/reviews`),
};

// --- Chatbot API ---
export const chatbotAPI = {
    askBot: (message) => api.post('/chatbot', { message }),
};

// --- Recommendation API ---
export const recommendationAPI = {
  getRecommendations: (cartItems) => api.post('/recommendations', { cartItems }),
};