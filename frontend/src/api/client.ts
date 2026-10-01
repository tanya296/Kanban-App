import axios from "axios";

// This is a pre-configured version of axios.
// Instead of typing the full backend URL every time,
// we set it once here as "baseURL".
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api`,
});

// This runs before EVERY request made using `api`.
// It checks if we have a saved token, and if so, attaches it
// to the Authorization header automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});