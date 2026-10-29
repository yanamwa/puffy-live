import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FiBell,
  FiBookOpen,
  FiCheckCircle,
  FiMessageSquare,
} from "react-icons/fi";

import Swal from "sweetalert2";

import "../layout/ProfessorLayout.css";

/* =====================================================
   API
===================================================== */

import { API_BASE as API_BASE_URL } from "../../../config.js";

/* =====================================================
   TABS
===================================================== */

const tabs = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Unread",
    value: "unread",
  },
  {
    label: "Announcements",
    value: "announcement",
  },
];

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
   ICON TYPE
===================================================== */

function getNotificationIconType(type = "") {
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

  return "system";
}

/* =====================================================
   ICON
===================================================== */

function getIcon(type) {
  if (type === "announcement") {
    return <FiMessageSquare />;
  }

  if (type === "course") {
    return <FiBookOpen />;
  }

  if (type === "system") {
    return <FiCheckCircle />;
  }

  return <FiBell />;
}

/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeNotificationHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =====================================================
   SWEETALERT ICON
===================================================== */

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

/* =====================================================
   NORMALIZE NOTIFICATION
===================================================== */

function normalizeNotification(notification) {
  const isRead = notification.isRead ?? notification.is_read ?? false;

  const type = notification.type || "notification";

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

    type,

    iconType: getNotificationIconType(type),

    unread: notification.unread ?? !Boolean(isRead),

    isRead: Boolean(isRead),

    course:
      notification.course ||
      notification.courseName ||
      notification.course_name ||
      "",

    time:
      notification.time ||
      formatNotificationTime(notification.createdAt || notification.created_at),
  };
}

/* =====================================================
   PROFESSOR NOTIFICATIONS
===================================================== */

export default function ProfessorNotifications() {
  const [activeTab, setActiveTab] = useState("all");

  const [notifications, setNotifications] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  /* ===================================================
     LOAD NOTIFICATIONS
  =================================================== */

  const loadNotifications = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setNotifications([]);
      setIsLoading(false);
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
      console.error("Unable to load professor notifications:", error);

      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ===================================================
     LOAD + AUTO REFRESH
  =================================================== */

  useEffect(() => {
    loadNotifications();

    /*
      Same behavior as the notification bell.

      It checks the server every 30 seconds,
      so no manual page reload is required.
    */

    const intervalId = window.setInterval(loadNotifications, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  /* ===================================================
     FILTER NOTIFICATIONS
  =================================================== */

  const visibleNotifications = useMemo(() => {
    if (activeTab === "all") {
      return notifications;
    }

    if (activeTab === "unread") {
      return notifications.filter((notification) => notification.unread);
    }

    if (activeTab === "announcement") {
      return notifications.filter(
        (notification) => notification.type === "announcement",
      );
    }

    return notifications;
  }, [activeTab, notifications]);

  /* ===================================================
     UNREAD COUNT
  =================================================== */

  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  /* ===================================================
     MARK ALL AS READ
  =================================================== */

  const markAllRead = async () => {
    if (unreadCount === 0) {
      return;
    }

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
     OPEN NOTIFICATION
  =================================================== */

  const openNotification = async (notification) => {
    if (!notification) {
      return;
    }

    /* ===============================================
         MARK ONE AS READ
      =============================================== */

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
                Accept: "application/json",

                Authorization: `Bearer ${token}`,
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

    /* ===============================================
         SEPARATE MESSAGE + REASON
      =============================================== */

    const fullMessage = String(notification.message || "").trim();

    let mainMessage = fullMessage;

    let reason = "";

    const reasonMatch = fullMessage.match(/(?:^|\s)Reason:\s*(.*)$/i);

    if (reasonMatch) {
      reason = reasonMatch[1].trim();

      mainMessage = fullMessage.replace(/(?:^|\s)Reason:\s*.*$/i, "").trim();
    }

    /* ===============================================
         SWEETALERT
      =============================================== */

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

                    background: #fff9e6;

                    border:
                      1px solid #f6df9b;

                    border-left:
                      4px solid #f4b400;

                    border-radius: 8px;
                  ">

                    <div style="
                      margin-bottom: 6px;

                      color: #92700c;

                      font-size: 12px;
                      font-weight: 700;

                      text-transform:
                        uppercase;

                      letter-spacing:
                        0.5px;
                    ">
                      Reason
                    </div>

                    <div style="
                      color: #334155;

                      font-size: 14px;
                      line-height: 1.6;
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
                    margin-top: 18px;
                    padding-top: 12px;

                    border-top:
                      1px solid #e5e7eb;

                    color: #9ca3af;

                    font-size: 13px;
                  ">
                    ${escapeNotificationHtml(notification.time)}
                  </div>
                `
                : ""
            }

          </div>
        `,

      icon: getSweetAlertIcon(notification.type),

      confirmButtonText: "Okay",

      confirmButtonColor: "#2563eb",

      width: 480,

      showCloseButton: true,
    });
  };

  /* ===================================================
     PAGE
  =================================================== */

  return (
    <section className="professor-page professor-notifications">
      {/* =============================================
          PAGE HEADER
      ============================================= */}

      <div>
        <h1>Notifications</h1>

        <p>Review your course, enrollment, and platform notifications.</p>
      </div>

      {/* =============================================
          TOOLBAR
      ============================================= */}

      <div className="professor-notification-toolbar">
        <div className="professor-notification-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"

              className={activeTab === tab.value ? "active" : ""}

              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          className="professor-mark-read"
          type="button"

          onClick={markAllRead}

          disabled={unreadCount === 0}
        >
          Mark all as read ({unreadCount})
        </button>
      </div>

      {/* =============================================
          NOTIFICATION LIST
      ============================================= */}

      <div className="professor-notification-list">
        {isLoading && notifications.length === 0 ? (
          <div className="professor-card">Loading notifications...</div>
        ) : visibleNotifications.length === 0 ? (
          <div className="professor-card">No notifications found.</div>
        ) : (
          visibleNotifications.map((notification) => {
            const iconType = notification.iconType || "system";

            return (
              <article
                className={`professor-notification-item ${
                  notification.unread ? "unread" : ""
                }`}

                key={notification.id}

                role="button"

                tabIndex={0}

                onClick={() => openNotification(notification)}

                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();

                    openNotification(notification);
                  }
                }}
              >
                {/* ICON */}

                <div className={`professor-notification-icon ${iconType}`}>
                  {getIcon(iconType)}
                </div>

                {/* CONTENT */}

                <div className="professor-notification-content">
                  <h2>{notification.title}</h2>

                  <p>{notification.message}</p>

                  <div className="professor-notification-meta">
                    {notification.course && <span>{notification.course}</span>}

                    <span>{notification.time}</span>
                  </div>
                </div>

                {/* TYPE */}

                <div className={`professor-notification-badge ${iconType}`}>
                  {String(notification.type || "notification").replace(
                    /_/g,
                    " ",
                  )}
                </div>

                {/* UNREAD DOT */}

                {notification.unread && (
                  <span className="professor-unread-dot" aria-label="Unread" />
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
