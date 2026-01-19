import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
client.interceptors.request.use(
  (config) => {
    console.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// API functions
export const api = {
  // Health check
  async getHealth() {
    const response = await client.get('/health');
    return response.data;
  },

  // Get all incident types
  async getTypes() {
    const response = await client.get('/incidents/types');
    return response.data;
  },

  // Search incidents
  async searchIncidents(params) {
    const response = await client.post('/incidents/search', params);
    return response.data;
  },

  // Get statistics
  async getStats(params) {
    const response = await client.post('/incidents/stats', params);
    return response.data;
  },

  // Export CSV
  async exportCsv(params) {
    const response = await client.post('/incidents/export', params, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Geocode address
  async geocode(address) {
    const response = await client.get('/geocode', {
      params: { address },
    });
    return response.data;
  },

  // Reverse geocode
  async reverseGeocode(lat, lon) {
    const response = await client.get('/reverse-geocode', {
      params: { lat, lon },
    });
    return response.data;
  },

  // Upload CSV
  async uploadCsv(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await client.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;
