import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiBookOpen,
  FiCheckCircle,
  FiMessageSquare,
} from "react-icons/fi";

import "./RoleNotificationMenu.css";
import Swal from "sweetalert2";

/* =====================================================
   API CONFIG
===================================================== */

import { API_BASE as API_BASE_URL } from "../../config.js";

/* =====================================================
   ROLE CONFIG
===================================================== */

const notificationSets = {
  admin: {
    viewAllPath: "/admin/notification",
  },

  superAdmin: {
    viewAllPath: "/super-admin/announcements",
  },

  professor: {
    viewAllPath: "/professor/notifications",
  },

  student: {
    viewAllPath: "/student/notifications",
  },
};

/* =====================================================
   NORMALIZE ROLE
===================================================== */

function normalizeRole(role = "") {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "superadmin") {
    return "superAdmin";
  }

  if (normalized === "super_admin") {
    return "superAdmin";
  }

  if (normalized === "administrator") {
    return "admin";
  }

  if (normalized === "instructor") {
    return "professor";
  }

  if (normalized === "learner") {
    return "student";
  }

  return normalized;
}

/* =====================================================
   GET TOKEN
===================================================== */

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

/* =====================================================
   FORMAT TIME
===================================================== */

function formatNotificationTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const difference = Date.now() - date.getTime();

  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* =====================================================
   GET NOTIFICATION ICON
===================================================== */

function getNotificationIcon(type = "") {
  const normalizedType = String(type || "")
    .trim()
    .toLowerCase();

  if (
    normalizedType === "course_archived" ||
    normalizedType === "enrollment_request" ||
    normalizedType === "enrollment_approved" ||
    normalizedType === "enrollment_declined" ||
    normalizedType === "student_unenrolled" ||
    normalizedType === "course_unenrollment"
  ) {
    return "course";
  }

  if (normalizedType === "announcement") {
    return "announcement";
  }

  return "sparkle";
}

/* =====================================================
   NORMALIZE BACKEND NOTIFICATION
===================================================== */

function normalizeNotification(notification) {
  const isRead = notification.isRead ?? notification.is_read ?? false;

  return {
    ...notification,

    id:
      notification.id ??
      notification.notificationId ??
      notification.notification_id,

    notificationId:
      notification.notificationId ??
      notification.notification_id ??
      notification.id,

    title: notification.title || "Notification",

    message: notification.message || "",

    type: notification.type || "notification",

    icon: notification.icon || getNotificationIcon(notification.type),

    unread: notification.unread ?? !Boolean(isRead),

    isRead: Boolean(isRead),

    source: notification.source || "user",

    createdByRole: normalizeRole(
      notification.createdByRole ??
        notification.created_by_role ??
        notification.creatorRole ??
        notification.creator_role ??
        "",
    ),

    createdByUserId:
      notification.createdByUserId ??
      notification.created_by_user_id ??
      notification.creatorId ??
      notification.creator_id ??
      null,

    time:
      notification.time ||
      formatNotificationTime(notification.createdAt || notification.created_at),
  };
}

/* =====================================================
   ICON
===================================================== */

function NotificationIcon({ type }) {
  if (type === "course") {
    return <FiBookOpen />;
  }

  if (type === "announcement") {
    return <FiMessageSquare />;
  }

  return <FiCheckCircle />;
}

/* =====================================================
   COMPONENT
===================================================== */
function escapeNotificationHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSweetAlertIcon(type = "") {
  const normalizedType = String(type || "").toLowerCase();

  if (
    normalizedType === "enrollment_declined" ||
    normalizedType === "student_unenrolled" ||
    normalizedType === "course_unenrollment"
  ) {
    return "warning";
  }

  if (
    normalizedType === "enrollment_approved" ||
    normalizedType === "enrollment_request"
  ) {
    return "success";
  }

  return "info";
}

export default function RoleNotificationMenu({ role = "admin" }) {
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const normalizedRole = normalizeRole(role) || "admin";

  const config = notificationSets[normalizedRole] || notificationSets.admin;

  const [isOpen, setIsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("all");

  const [notifications, setNotifications] = useState([]);

  const [isLoading, setIsLoading] = useState(false);

  /* ===================================================
     LOAD NOTIFICATIONS
  =================================================== */

  const loadNotifications = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setNotifications([]);
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },

        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch notifications.");
      }

      const incoming = Array.isArray(data?.notifications)
        ? data.notifications
        : [];

      setNotifications(incoming.map(normalizeNotification));
    } catch (error) {
      console.error("Unable to load notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ===================================================
     INITIAL LOAD + AUTO REFRESH
  =================================================== */

  useEffect(() => {
    loadNotifications();

    const intervalId = window.setInterval(loadNotifications, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  /* ===================================================
     RESET WHEN ROLE CHANGES
  =================================================== */

  useEffect(() => {
    setActiveTab("all");
    setIsOpen(false);

    loadNotifications();
  }, [normalizedRole, loadNotifications]);

  /* ===================================================
     CLOSE ON OUTSIDE CLICK
  =================================================== */

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, []);

  /* ===================================================
     UNREAD COUNT
  =================================================== */

  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  /* ===================================================
     FILTER
  =================================================== */

  const visibleNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((notification) => notification.unread);
    }

    return notifications;
  }, [activeTab, notifications]);

  /* ===================================================
     MARK ALL AS READ
  =================================================== */

  const markAllRead = async () => {
    const token = getStoredToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "PATCH",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },

        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to mark notifications as read.",
        );
      }

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          unread: false,
          isRead: true,
          is_read: true,
        })),
      );
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
    }
  };

  /* ===================================================
     OPEN / MARK ONE AS READ
  =================================================== */

  const openNotification = async (notification) => {
    if (!notification) return;

    /* =========================================
     MARK NOTIFICATION AS READ
  ========================================= */

    if (notification.unread) {
      const token = getStoredToken();

      if (token) {
        try {
          const notificationId = notification.notificationId || notification.id;

          const response = await fetch(
            `${API_BASE_URL}/notifications/${notificationId}/read`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
              credentials: "include",
            },
          );

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data?.message || "Failed to mark notification as read.",
            );
          }

          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? {
                    ...item,
                    unread: false,
                    isRead: true,
                    is_read: true,
                  }
                : item,
            ),
          );
        } catch (error) {
          console.error("Unable to mark notification as read:", error);
        }
      }
    }

    /* =========================================
     CLOSE DROPDOWN
  ========================================= */

    setIsOpen(false);

    /* =========================================
     SEPARATE MESSAGE AND REASON
  ========================================= */

    const fullMessage = String(notification.message || "").trim();

    let mainMessage = fullMessage;
    let reason = "";

    const reasonMatch = fullMessage.match(/(?:^|\s)Reason:\s*(.*)$/i);

    if (reasonMatch) {
      reason = reasonMatch[1].trim();

      mainMessage = fullMessage.replace(/(?:^|\s)Reason:\s*.*$/i, "").trim();
    }

    /* =========================================
     SHOW SWEETALERT
  ========================================= */

    await Swal.fire({
      title: notification.title || "Notification",

      html: `
      <div style="
        text-align: left;
        padding: 4px 6px;
      ">
        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
        ">
          ${escapeNotificationHtml(mainMessage)}
        </p>

        ${
          reason
            ? `
              <div style="
                margin-top: 18px;
                padding: 14px 16px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-left: 4px solid #2563eb;
                border-radius: 8px;
              ">
                <div style="
                  font-size: 12px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  color: #64748b;
                  margin-bottom: 6px;
                ">
                  Reason
                </div>

                <div style="
                  font-size: 14px;
                  line-height: 1.6;
                  color: #334155;
                ">
                  ${escapeNotificationHtml(reason)}
                </div>
              </div>
            `
            : ""
        }

        ${
          notification.time
            ? `
              <div style="
                border-top: 1px solid #e5e7eb;
                margin-top: 18px;
                padding-top: 12px;
                font-size: 13px;
                color: #9ca3af;
              ">
                ${escapeNotificationHtml(notification.time)}
              </div>
            `
            : ""
        }
      </div>
    `,

      customClass: { container: "student-notification-overlay", popup: "student-notification-dialog" },
      target: document.body,
      confirmButtonText: "Close",
      confirmButtonColor: "#2563eb",
      width: 480,
      showCloseButton: false,
    });
  };

  /* ===================================================
     PAGE
  =================================================== */

  return (
    <div className="role-notification-menu" ref={menuRef}>
      <button
        type="button"
        className={`role-notification-button ${isOpen ? "active" : ""}`}
        aria-label={`Notifications${
          unreadCount > 0 ? `, ${unreadCount} unread` : ""
        }`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          const nextIsOpen = !isOpen;

          setIsOpen(nextIsOpen);

          if (nextIsOpen) {
            loadNotifications();
          }
        }}
      >
        <FiBell aria-hidden="true" />

        {unreadCount > 0 && (
          <span className="role-notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className="role-notification-dropdown"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="role-notification-header">
            <div>
              <h2>Notifications</h2>

              <span>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You are all caught up"}
              </span>
            </div>

            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="role-notification-tabs">
            <button
              type="button"
              className={activeTab === "all" ? "active" : ""}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>

            <button
              type="button"
              className={activeTab === "unread" ? "active" : ""}
              onClick={() => setActiveTab("unread")}
            >
              Unread
            </button>
          </div>

          <div className="role-notification-list">
            {isLoading && notifications.length === 0 ? (
              <div className="role-notification-empty">
                <span>
                  <FiBell aria-hidden="true" />
                </span>

                <strong>Loading notifications...</strong>

                <p>Please wait.</p>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="role-notification-empty">
                <span>
                  <FiBell aria-hidden="true" />
                </span>

                <strong>No notifications yet</strong>

                <p>New updates will appear here.</p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`role-notification-item ${
                    notification.unread ? "unread" : ""
                  }`}
                  onClick={() => openNotification(notification)}
                >
                  <span
                    className={`role-notification-icon ${notification.icon}`}
                    aria-hidden="true"
                  >
                    <NotificationIcon type={notification.icon} />
                  </span>

                  <span className="role-notification-copy">
                    <strong>{notification.title}</strong>

                    <span>{notification.message}</span>

                    <small>{notification.time}</small>
                  </span>

                  {notification.unread && (
                    <span
                      className="role-notification-unread-dot"
                      aria-label="Unread"
                    />
                  )}
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="role-notification-view-all"
            onClick={() => {
              setIsOpen(false);

              navigate(config.viewAllPath);
            }}
          >
            See all notifications
          </button>
        </section>
      )}
    </div>
  );
}
