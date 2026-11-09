import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE } from "../config.js";

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

  useEffect(() => {
    let request;
    async function refresh() {
      request?.abort();
      request = new AbortController();
      const { signal } = request;
      try {
        const response = await fetch(`${API_BASE}/system-settings/status`, { signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!signal.aborted) setStatus({ ...defaults, ...data, loaded: true });
      } catch {
        // Keep the last known status if the connection is interrupted.
      } finally {
        if (!signal.aborted) {
          setStatus((current) => current.loaded ? current : { ...current, loaded: true });
        }
      }
    }

    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("puffy-system-settings-updated", refresh);
    return () => {
      request?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("puffy-system-settings-updated", refresh);
    };
  }, []);

  return (
    <SystemStatusContext.Provider value={status}>
      {children}
    </SystemStatusContext.Provider>
  );
}
