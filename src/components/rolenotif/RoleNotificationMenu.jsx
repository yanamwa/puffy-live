import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiBookOpen, FiCheckCircle, FiMessageSquare } from "react-icons/fi";
import Swal from "sweetalert2";
import "./RoleNotificationMenu.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const REFRESH_INTERVAL_MS = 30000;

const notificationSets = {
  admin: { viewAllPath: "/admin/notification" },
  superAdmin: { viewAllPath: "/super-admin/announcements" },
  professor: { viewAllPath: "/professor/notifications" },
  student: { viewAllPath: "/student/notifications" },
};

function normalizeRole(role = "") {
  const value = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (value === "superadmin" || value === "super_admin") return "superAdmin";
  if (value === "administrator") return "admin";
  if (value === "instructor") return "professor";
  if (value === "learner") return "student";
  return value;
}

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("puffy-token") ||
    ""
  );
}

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getNotificationIcon(type = "") {
  const value = String(type || "").trim().toLowerCase();
  if (["course_archived", "enrollment_request", "enrollment_approved", "enrollment_declined", "student_unenrolled", "course_unenrollment"].includes(value)) {
    return "course";
  }
  if (value === "announcement") return "announcement";
  return "sparkle";
}

function parseBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeNotification(notification) {
  // The API returns isRead/is_read as the authoritative status.
  const explicitRead = notification.isRead ?? notification.is_read;
  const isRead = explicitRead != null
    ? parseBoolean(explicitRead)
    : notification.readAt != null || notification.read_at != null
      ? true
      : notification.unread != null
        ? !parseBoolean(notification.unread)
        : false;

  const notificationId = notification.notificationId ?? notification.notification_id ?? notification.id;
  return {
    ...notification,
    id: String(notification.id ?? notificationId),
    notificationId,
    title: notification.title || "Notification",
    message: notification.message || "",
    type: notification.type || "notification",
    icon: notification.icon || getNotificationIcon(notification.type),
    isRead,
    is_read: isRead,
    unread: !isRead,
    source: notification.source || "user",
    createdByRole: normalizeRole(notification.createdByRole ?? notification.created_by_role ?? notification.creatorRole ?? notification.creator_role ?? ""),
    createdByUserId: notification.createdByUserId ?? notification.created_by_user_id ?? notification.creatorId ?? notification.creator_id ?? null,
    createdByName: String(notification.createdByName ?? notification.created_by_name ?? "").trim(),
    time: notification.time || formatNotificationTime(notification.createdAt || notification.created_at),
  };
}

function NotificationIcon({ type }) {
  if (type === "course") return <FiBookOpen />;
  if (type === "announcement") return <FiMessageSquare />;
  return <FiCheckCircle />;
}

function escapeNotificationHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function requestNotifications(path, options = {}) {
  const token = getStoredToken();
  if (!token) throw new Error("Your session has expired. Please log in again.");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Notification request failed (${response.status}).`);
  }
  return data;
}

export default function RoleNotificationMenu({ role = "admin" }) {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const mountedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const mutationPendingRef = useRef(0);
  const pendingIdsRef = useRef(new Set());
  const markAllPendingRef = useRef(false);
  // Keep successfully read notifications stable during subsequent polling.
  // This is a UI safeguard, not a substitute for database persistence.
  const confirmedReadIdsRef = useRef(new Set());
  const lastTokenRef = useRef(getStoredToken());
  const normalizedRole = normalizeRole(role) || "admin";
  const config = notificationSets[normalizedRole] || notificationSets.admin;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [pendingIds, setPendingIds] = useState([]);

  const loadNotifications = useCallback(async () => {
    // Do not allow polling to compete with an in-progress PATCH.
    if (mutationPendingRef.current > 0) return;
    const currentToken = getStoredToken();
    if (lastTokenRef.current !== currentToken) {
      confirmedReadIdsRef.current.clear();
      lastTokenRef.current = currentToken;
    }
    const sequence = ++requestSequenceRef.current;
    const versionAtStart = mutationVersionRef.current;
    const tokenAtStart = getStoredToken();
    if (!tokenAtStart) {
      if (mountedRef.current) setNotifications([]);
      return;
    }

    if (mountedRef.current) setIsLoading(true);
    try {
      const data = await requestNotifications("/notifications");
      if (!mountedRef.current || sequence !== requestSequenceRef.current) return;
      if (versionAtStart !== mutationVersionRef.current || mutationPendingRef.current > 0) return;
      if (tokenAtStart !== getStoredToken()) return;
      const incoming = Array.isArray(data.notifications) ? data.notifications : [];
      const normalized = incoming.map(normalizeNotification);
      const returnedIds = new Set(normalized.map((item) => String(item.notificationId)));
      for (const id of confirmedReadIdsRef.current) {
        if (!returnedIds.has(id)) confirmedReadIdsRef.current.delete(id);
      }
      const staleIds = normalized.filter((item) =>
        confirmedReadIdsRef.current.has(String(item.notificationId)) && item.unread
      );
      if (staleIds.length) {
        console.warn("Notification API returned unread after successful PATCH. Check notification_reads / notifications persistence:", staleIds.map((item) => item.notificationId));
      }
      setNotifications(normalized.map((item) =>
        confirmedReadIdsRef.current.has(String(item.notificationId))
          ? { ...item, isRead: true, is_read: true, unread: false }
          : item
      ));
    } catch (error) {
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        console.error("Unable to load notifications:", error);
      }
    } finally {
      if (mountedRef.current && sequence === requestSequenceRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  useEffect(() => {
    setActiveTab("all");
    setIsOpen(false);
    // The role is only used for routing; the API determines access from the token.
  }, [normalizedRole]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const visibleNotifications = useMemo(
    () => activeTab === "unread" ? notifications.filter((notification) => notification.unread) : notifications,
    [activeTab, notifications],
  );

  const markAllRead = async () => {
    if (markAllPendingRef.current || mutationPendingRef.current > 0) return;
    markAllPendingRef.current = true;
    mutationPendingRef.current += 1;
    // Invalidate GETs that started before this mutation.
    mutationVersionRef.current += 1;
    requestSequenceRef.current += 1;
    setIsMarkingAll(true);
    try {
      await requestNotifications("/notifications/read-all", { method: "PATCH" });
      for (const item of notifications) confirmedReadIdsRef.current.add(String(item.notificationId));
      if (mountedRef.current) {
        setNotifications((current) => current.map((item) => ({ ...item, unread: false, isRead: true, is_read: true })));
      }
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
      if (mountedRef.current) {
        await Swal.fire({ icon: "error", title: "Unable to update notifications", text: error.message, confirmButtonColor: "#2563eb" });
      }
    } finally {
      mutationPendingRef.current -= 1;
      markAllPendingRef.current = false;
      if (mountedRef.current) {
        setIsMarkingAll(false);
        loadNotifications();
      }
    }
  };

  const openNotification = async (notification) => {
    if (!notification) return;
    const id = String(notification.id);
    if (pendingIdsRef.current.has(id) || markAllPendingRef.current) return;

    if (notification.unread) {
      pendingIdsRef.current.add(id);
      setPendingIds((current) => [...current, id]);
      mutationPendingRef.current += 1;
      mutationVersionRef.current += 1;
      requestSequenceRef.current += 1;
      try {
        await requestNotifications(`/notifications/${encodeURIComponent(notification.notificationId)}/read`, { method: "PATCH" });
        confirmedReadIdsRef.current.add(String(notification.notificationId));
        if (mountedRef.current) {
          setNotifications((current) => current.map((item) =>
            String(item.id) === id ? { ...item, unread: false, isRead: true, is_read: true } : item
          ));
        }
      } catch (error) {
        console.error("Unable to mark notification as read:", error);
        if (mountedRef.current) {
          await Swal.fire({ icon: "error", title: "Unable to mark as read", text: error.message, confirmButtonColor: "#2563eb" });
        }
        return;
      } finally {
        mutationPendingRef.current -= 1;
        pendingIdsRef.current.delete(id);
        if (mountedRef.current) {
          setPendingIds((current) => current.filter((value) => value !== id));
          if (mutationPendingRef.current === 0) loadNotifications();
        }
      }
    }

    if (!mountedRef.current) return;
    setIsOpen(false);
    const fullMessage = String(notification.message || "").trim();
    const creatorLabel = notification.createdByName
      ? `${notification.createdByName}${notification.createdByRole ? ` (${notification.createdByRole === "superAdmin" ? "Super Admin" : notification.createdByRole})` : ""}`
      : "";
    const reasonMatch = fullMessage.match(/(?:^|\s)Reason:\s*(.*)$/i);
    const reason = reasonMatch ? reasonMatch[1].trim() : "";
    const mainMessage = reasonMatch ? fullMessage.replace(/(?:^|\s)Reason:\s*.*$/i, "").trim() : fullMessage;

    await Swal.fire({
      title: notification.title || "Notification",
      html: `
        <div style="text-align:left;padding:4px 6px">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">${escapeNotificationHtml(mainMessage)}</p>
          ${reason ? `<div style="margin-top:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:8px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:6px">Reason</div><div style="font-size:14px;line-height:1.6;color:#334155">${escapeNotificationHtml(reason)}</div></div>` : ""}
          ${creatorLabel ? `<div style="margin-top:14px;font-size:13px;color:#64748b">Posted by <strong>${escapeNotificationHtml(creatorLabel)}</strong></div>` : ""}
          ${notification.time ? `<div style="border-top:1px solid #e5e7eb;margin-top:18px;padding-top:12px;font-size:13px;color:#9ca3af">${escapeNotificationHtml(notification.time)}</div>` : ""}
        </div>`,
      customClass: {
        container: "student-notification-overlay",
        popup: "student-notification-dialog",
      },
      target: document.body,
      confirmButtonText: "Close",
      confirmButtonColor: "#2563eb",
      width: 480,
      showCloseButton: false,
    });
  };

  return (
    <div className="role-notification-menu" ref={menuRef}>
      <button
        type="button"
        className={`role-notification-button ${isOpen ? "active" : ""}`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          const nextIsOpen = !isOpen;
          setIsOpen(nextIsOpen);
          if (nextIsOpen) loadNotifications();
        }}
      >
        <FiBell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="role-notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <section className="role-notification-dropdown" role="dialog" aria-label="Notifications">
          <div className="role-notification-header">
            <div>
              <h2>Notifications</h2>
              <span>{unreadCount > 0 ? `${unreadCount} unread` : "You are all caught up"}</span>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} disabled={isMarkingAll || pendingIds.length > 0}>
                {isMarkingAll ? "Marking..." : "Mark all as read"}
              </button>
            )}
          </div>

          <div className="role-notification-tabs">
            <button type="button" className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>All</button>
            <button type="button" className={activeTab === "unread" ? "active" : ""} onClick={() => setActiveTab("unread")}>Unread</button>
          </div>

          <div className="role-notification-list">
            {isLoading && notifications.length === 0 ? (
              <div className="role-notification-empty">
                <span><FiBell aria-hidden="true" /></span>
                <strong>Loading notifications...</strong>
                <p>Please wait.</p>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="role-notification-empty">
                <span><FiBell aria-hidden="true" /></span>
                <strong>{activeTab === "unread" ? "No unread notifications" : "No notifications yet"}</strong>
                <p>{activeTab === "unread" ? "You are all caught up." : "New updates will appear here."}</p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  disabled={pendingIds.includes(String(notification.id)) || isMarkingAll}
                  className={`role-notification-item ${notification.unread ? "unread" : ""}`}
                  onClick={() => openNotification(notification)}
                >
                  <span className={`role-notification-icon ${notification.icon}`} aria-hidden="true">
                    <NotificationIcon type={notification.icon} />
                  </span>
                  <span className="role-notification-copy">
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    {notification.createdByName && (
                      <small>Posted by {notification.createdByName}{notification.createdByRole ? ` (${notification.createdByRole === "superAdmin" ? "Super Admin" : notification.createdByRole})` : ""}</small>
                    )}
                    <small>{notification.time}</small>
                  </span>
                  {notification.unread && <span className="role-notification-unread-dot" aria-label="Unread" />}
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="role-notification-view-all"
            onClick={() => { setIsOpen(false); navigate(config.viewAllPath); }}
          >
            See all notifications
          </button>
        </section>
      )}
    </div>
  );
}
