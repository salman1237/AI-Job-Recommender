import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const api = axios.create({ baseURL: API_URL });

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post("/auth/login", new URLSearchParams({ username: email, password }), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

export const register = (email: string, password: string, full_name: string) =>
  api.post("/auth/register", { email, password, full_name });

// ── User ──────────────────────────────────────────────────────────────
export const getMe = () => api.get("/users/me");

export const uploadAvatar = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/users/me/avatar", fd);
};

export const uploadCV = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/users/me/cv", fd);
};

// ── Opportunities ──────────────────────────────────────────────────────
export const getRecommended = (refresh = false) =>
  api.get("/opportunities/recommended", { params: { top_n: 30, refresh } });

export const getOpportunityTypes = () =>
  api.get("/opportunities/types");

export const getOpportunities = (params: Record<string, unknown>) =>
  api.get("/opportunities", { params });

export const getAdminOpportunities = (params: Record<string, unknown>) =>
  api.get("/opportunities", { params: { ...params, active_only: false } });

export const getStats = () => api.get("/stats");

// ── Admin ──────────────────────────────────────────────────────────────
export const triggerIngest = () => api.post("/admin/ingest");
export const triggerEmails = () => api.post("/admin/trigger-emails");
export const getIngestionRuns = () => api.get("/admin/runs");
export const getEmailLogs = () => api.get("/admin/email-logs");
