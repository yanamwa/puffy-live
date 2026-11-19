import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE } from "../config.js";
import { onPageResume } from "../utils/onPageResume.js";

const defaults = {
  academicYear: "",
  enrollmentApproval: true,
  maintenanceMode: false,
  loaded: false,
};
const SystemStatusContext = createContext({ ...defaults, loaded: true });

export function useSystemStatus() {
  return useContext(SystemStatusContext);
}

export function SystemStatusProvider({ children }) {
  const [status, setStatus] = useState(defaults);
  const { pathname } = useLocation();

  useEffect(() => {
    let request;
    async function refresh() {
      request?.abort();
      request = new AbortController();
      const { signal } = request;
      try {
        const token =
          localStorage.getItem("puffy-token") ||
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("puffy-token") ||
          sessionStorage.getItem("token") ||
          sessionStorage.getItem("authToken");
        const response = await fetch(`${API_BASE}/system-settings/status`, {
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!signal.aborted) setStatus({ ...defaults, ...data, loaded: true });
      } catch {
        // Keep the last known status if the connection is interrupted.
      } finally {
        if (!signal.aborted) {
          request = null;
          setStatus((current) => current.loaded ? current : { ...current, loaded: true });
        }
      }
    }

    refresh();
    const unsubscribe = onPageResume(() => {
      if (!request) void refresh();
    });
    window.addEventListener("puffy-system-settings-updated", refresh);
    return () => {
      request?.abort();
      unsubscribe();
      window.removeEventListener("puffy-system-settings-updated", refresh);
    };
  }, [pathname]);

  return (
    <SystemStatusContext.Provider value={status}>
      {children}
    </SystemStatusContext.Provider>
  );
}
