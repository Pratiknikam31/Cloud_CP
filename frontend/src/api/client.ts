import axios from 'axios';

// VITE_API_URL is the backend's /api base, e.g. https://hms-api.vercel.app/api.
// When it is not set (local dev), requests go to /api and Vite proxies them
// to the backend on http://localhost:5000 (see vite.config.ts).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smarthospital_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('smarthospital_token');
      localStorage.removeItem('smarthospital_user');
    }
    return Promise.reject(error);
  }
);

export default api;
