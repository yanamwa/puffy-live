import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../config.js";
import { getStoredStudentToken } from "../../pages/student/settings/studentProfileData.js";
import { onPageResume } from "../../utils/onPageResume.js";

export function useStudentNotifications(enabled = true) {
  const token = enabled ? getStoredStudentToken() : "";
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const pending = useRef(null);

  const refresh = useCallback(async () => {
    if (!token || pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/notifications`, {
        credentials: "include",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        signal: request.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to fetch notifications.");
      if (!request.signal.aborted && getStoredStudentToken() === token) {
        setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      }
    } catch (error) {
      if (!request.signal.aborted) console.error("Unable to load notifications:", error);
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    setNotifications([]);
    setLoading(Boolean(token));
    if (!token) return;
    void refresh();
    const unsubscribe = onPageResume(refresh);
    return () => {
      unsubscribe();
      pending.current?.abort();
      pending.current = null;
    };
  }, [token, refresh]);

  async function markAsRead(id) {
    if (!token) return;
    const action = id == null ? "read-all" : `${encodeURIComponent(id)}/read`;
    try {
      const response = await fetch(`${API_BASE}/notifications/${action}`, {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to mark notifications as read.");
      }
      if (getStoredStudentToken() !== token) return;
      // A GET issued before this write could otherwise restore the old badge.
      pending.current?.abort();
      pending.current = null;
      setLoading(false);
      setNotifications((current) => current.map((item) => {
        const itemId = item.notificationId ?? item.notification_id ?? item.id;
        return id == null || String(itemId) === String(id)
          ? { ...item, unread: false, isRead: true, is_read: true }
          : item;
      }));
    } catch (error) {
      console.error("Unable to mark notifications as read:", error);
    }
  }

  return { notifications, loading, refresh, markAsRead };
}
