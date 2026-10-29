import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FiBell,
  FiBookOpen,
  FiCheckCircle,
  FiMessageSquare,
} from "react-icons/fi";

import Swal from "sweetalert2";

import StudentSidebar from "../../../components/students/StudentSidebar";
import StudentHeader from "../../../components/students/StudentHeader";

import "./StudentNotifications.css";

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
  if (!value) return "";

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
   NOTIFICATION ICON TYPE
===================================================== */

function getNotificationIconType(type = "") {
  const normalizedType = String(type || "")
    .trim()
    .toLowerCase();

  if (
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
  const normalizedType = String(type || "")
    .trim()
    .toLowerCase();

  if (
    normalizedType === "enrollment_declined" ||
    normalizedType === "student_unenrolled" ||
    normalizedType === "course_unenrollment"
  ) {
    return "warning";
  }

  if (normalizedType === "enrollment_approved") {
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
      customClass: { container: "student-notification-overlay", popup: "student-notification-dialog" },

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
   STUDENT NOTIFICATIONS PAGE
===================================================== */

export default function StudentNotifications() {
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
      console.error("Unable to load student notifications:", error);

      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ===================================================
     AUTO REFRESH
  =================================================== */

  useEffect(() => {
    loadNotifications();

    const intervalId = window.setInterval(loadNotifications, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  /* ===================================================
     FILTER
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
     MARK ALL READ
  =================================================== */

  const markAllRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    const token = getStoredToken();

    if (!token) return;

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
    if (!notification) return;

    /* MARK ONE AS READ */

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
         SEPARATE REASON FROM MESSAGE
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
              color: #374151;
              font-size: 15px;
              line-height: 1.7;
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

      confirmButtonColor: "#4f67d8",

      width: 480,

      showCloseButton: true,
    });
  };

  /* ===================================================
     PAGE
  =================================================== */
  return (
    <div className="student-notifications-layout">
      {/* SIDEBAR */}
      <StudentSidebar />

      {/* MAIN AREA */}
      <div className="student-notifications-main-area">
        {/* HEADER */}
        <StudentHeader searchPlaceholder="Search notifications" />

        {/* PAGE BODY */}
        <main className="student-notifications-body">
          <section className="student-notifications-page">
            {/* PAGE HEADING */}
            <div className="student-notifications-heading">
              <div>
                <p className="student-notifications-eyebrow">Student</p>

                <h1>Notifications</h1>

                <p className="student-notifications-description">
                  Review your course, enrollment, and platform notifications.
                </p>
              </div>

              {unreadCount > 0 && (
                <div className="student-notifications-summary">
                  <FiBell />

                  <div>
                    <strong>{unreadCount}</strong>
                    <span>
                      {unreadCount === 1
                        ? "Unread notification"
                        : "Unread notifications"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* TOOLBAR */}
            <div className="student-notification-toolbar">
              <div className="student-notification-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={activeTab === tab.value ? "active" : ""}
                    onClick={() => setActiveTab(tab.value)}
                  >
                    {tab.label}

                    {tab.value === "unread" && unreadCount > 0 && (
                      <span className="student-tab-count">{unreadCount}</span>
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="student-mark-read"
                onClick={markAllRead}
                disabled={unreadCount === 0}
              >
                Mark all as read ({unreadCount})
              </button>
            </div>

            {/* NOTIFICATIONS */}
            <div className="student-notification-list">
              {isLoading && notifications.length === 0 ? (
                <div className="student-notification-empty">
                  <span className="student-empty-icon">
                    <FiBell />
                  </span>

                  <strong>Loading notifications...</strong>
                </div>
              ) : visibleNotifications.length === 0 ? (
                <div className="student-notification-empty">
                  <span className="student-empty-icon">
                    <FiBell />
                  </span>

                  <strong>No notifications found</strong>

                  <p>New updates will appear here.</p>
                </div>
              ) : (
                visibleNotifications.map((notification) => {
                  const iconType = notification.iconType || "system";

                  return (
                    <article
                      key={notification.id}
                      className={`student-notification-item ${
                        notification.unread ? "unread" : ""
                      }`}
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
                      <div className={`student-notification-icon ${iconType}`}>
                        {getIcon(iconType)}
                      </div>

                      {/* CONTENT */}
                      <div className="student-notification-content">
                        <h2>{notification.title}</h2>

                        <p>{notification.message}</p>

                        <div className="student-notification-meta">
                          {notification.course && (
                            <span>{notification.course}</span>
                          )}

                          <span>{notification.time}</span>
                        </div>
                      </div>

                      {/* TYPE */}
                      <div className={`student-notification-type ${iconType}`}>
                        {String(notification.type || "notification").replace(
                          /_/g,
                          " ",
                        )}
                      </div>

                      {/* UNREAD */}
                      {notification.unread && (
                        <span
                          className="student-notification-unread-dot"
                          aria-label="Unread"
                        />
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
