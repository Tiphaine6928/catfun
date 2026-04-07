import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', // ton backend Symfony
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // utile si tu utilises les sessions/cookies
});

export default api;