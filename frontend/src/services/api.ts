import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000', // Symfony
  withCredentials: true // 🔥 important pour les sessions Symfony
})

export default api