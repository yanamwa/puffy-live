const configuredApiBase = (
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api"
).trim().replace(/\/+$/, "");

// Accept either a backend origin or an API URL that already ends in /api.
export const API_BASE = configuredApiBase.endsWith("/api")
  ? configuredApiBase
  : `${configuredApiBase}/api`;
