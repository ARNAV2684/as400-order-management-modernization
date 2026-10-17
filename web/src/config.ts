/** Runtime settings read from Vite env vars (see .env.example). */
export const config = {
  apiBase: import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000",
} as const
