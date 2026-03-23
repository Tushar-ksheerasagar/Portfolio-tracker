import axios from "axios";

const API_BASE_URL = "http://localhost:5000";
const TOKEN_KEY = "portfolio_token";
const USER_KEY = "portfolio_user";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setAuthData = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthData = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const getStoredUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const registerUser = async (email, password) => {
  const response = await api.post("/auth/register", { email, password });
  return response.data;
};

export const loginUser = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const uploadPortfolio = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getCompanyDetails = async (symbol) => {
  const response = await api.get(`/company-details/${symbol}`);
  return response.data;
};

export const getStockRecommendation = async (symbol) => {
  const response = await api.get(`/recommendation/${symbol}`);
  return response.data;
};

export const getStockSentiment = async (symbol) => {
  const response = await api.get(`/sentiment/${symbol}`);
  return response.data;
};

export const healthCheck = async () => {
  const response = await api.get("/health");
  return response.data;
};

export const refreshPortfolio = async (holdings) => {
  const response = await api.post("/refresh-portfolio", holdings);
  return response.data;
};

export const getUserPortfolio = async () => {
  const response = await api.get("/portfolio");
  return response.data;
};

export default api;
