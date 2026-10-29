import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import "./StudentHeader.css";

import { API_BASE as API_BASE_URL } from "../../config.js";
const DEFAULT_PROFILE_IMAGE = "/images/temporary profile.jpg";
/* =====================================================
   GET STORED USER
===================================================== */
function getStoredUser() {
  try {
    const storedUser =
      localStorage.getItem("puffy-user") ||
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("user") ||
      sessionStorage.getItem("currentUser");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Unable to read stored user:", error);
    return null;
  }
}
/* =====================================================
   RESOLVE PROFILE IMAGE
===================================================== */
function resolveProfileImage(imagePath) {
  if (!imagePath) {
    return DEFAULT_PROFILE_IMAGE;
  }
  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }
  const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${serverOrigin}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
}
function getAuthToken() {
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
function formatNotificationTime(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const difference = Date.now() - date.getTime();
  const minutes = Math.floor(difference / 60000);
  if (minutes < 1) return "Just now";
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
function getNotificationIcon(type = "") {
  const normalizedType = String(type).toLowerCase();
  if (
    normalizedType === "enrollment_approved" ||
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
function normalizeNotification(notification) {
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
    unread:
      notification.unread ??
      !(notification.isRead ?? notification.is_read ?? false),
    time: formatNotificationTime(
      notification.createdAt || notification.created_at,
    ),
    icon: getNotificationIcon(notification.type),
    source: notification.source || "user",
  };
}
/* =====================================================
   STUDENT HEADER
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

  if (normalizedType === "enrollment_approved") {
    return "success";
  }

  return "info";
}

export default function StudentHeader({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search your course",
  onJoinCourse,
  showSearch = true,
  showJoinCourse = true,
}) {
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  /* =====================================================
     LOAD NOTIFICATIONS FROM BACKEND
  ===================================================== */
  const loadNotifications = async () => {
    const token = getAuthToken();
    if (!token) {
      setNotifications([]);
      return;
    }
    try {
      setNotificationsLoading(true);
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch notifications.");
      }
      const incomingNotifications = Array.isArray(data?.notifications)
        ? data.notifications
        : [];
      setNotifications(incomingNotifications.map(normalizeNotification));
    } catch (error) {
      console.error("Unable to load notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };
  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 5000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);
  /* =====================================================
     USER PROFILE LISTENER
  ===================================================== */
  useEffect(() => {
    const handleUserUpdated = (event) => {
      const updatedUser = event.detail || getStoredUser();
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    };
    const handleStorageUpdate = (event) => {
      if (!["puffy-user", "user", "currentUser"].includes(event.key)) {
        return;
      }
      const updatedUser = getStoredUser();
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    };
    window.addEventListener("puffy-user-updated", handleUserUpdated);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("puffy-user-updated", handleUserUpdated);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);
  /* =====================================================
     CLOSE DROPDOWNS
  ===================================================== */
  useEffect(() => {
    const closeDropdowns = (event) => {
      if (!event.target.closest(".notification-menu-wrapper")) {
        setNotificationMenuOpen(false);
      }
      if (!event.target.closest(".profile-menu-wrapper")) {
        setProfileMenuOpen(false);
      }
    };
    const closeWithEscape = (event) => {
      if (event.key === "Escape") {
        setNotificationMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeDropdowns);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeDropdowns);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);
  /* =====================================================
     USER INFORMATION
  ===================================================== */
  const displayName =
    currentUser?.displayName ||
    currentUser?.display_name ||
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.full_name ||
    currentUser?.username ||
    "Student";
  const profileHandle = displayName.replace(/^@/, "");
  const accountLabel = currentUser?.email || "Student account";
  const profileImage = useMemo(
    () =>
      resolveProfileImage(
        currentUser?.profileImage ||
          currentUser?.profile_image ||
          currentUser?.avatar ||
          currentUser?.image ||
          "",
      ),
    [currentUser],
  );
  /* =====================================================
     NOTIFICATIONS
  ===================================================== */
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.unread,
  ).length;
  const visibleNotifications =
    notificationFilter === "unread"
      ? notifications.filter((notification) => notification.unread)
      : notifications;
  const markAllNotificationsAsRead = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        credentials: "include",
      });
      const data = await response.json();
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

  const openNotification = async (notification) => {
    if (!notification) return;

    /* =========================================
     MARK NOTIFICATION AS READ
  ========================================= */

    if (notification.unread) {
      const token = getAuthToken();

      if (token) {
        try {
          const notificationId =
            notification.notificationId ||
            notification.notification_id ||
            notification.id;

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
     CLOSE NOTIFICATION DROPDOWN
  ========================================= */

    setNotificationMenuOpen(false);

    /* =========================================
     SHOW NOTIFICATION DETAILS
  ========================================= */

    const notificationTitle = notification.title || "Notification";

    const notificationMessage =
      notification.message || "No additional information available.";

    const notificationReason =
      notification.reason ||
      notification.declineReason ||
      notification.decline_reason ||
      "";

    const notificationTime = notification.time || "";

    let html = `
    <div style="
      text-align: left;
      line-height: 1.6;
    ">
      <p style="
        margin: 0 0 12px;
      ">
        ${notificationMessage}
      </p>
  `;

    if (notificationReason) {
      html += `
      <div style="
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: 10px;
        background: #f5f6f7;
      ">
        <strong>Reason:</strong>
        <div style="margin-top: 5px;">
          ${notificationReason}
        </div>
      </div>
    `;
    }

    if (notificationTime) {
      html += `
      <div style="
        margin-top: 14px;
        color: #7b8189;
        font-size: 12px;
      ">
        ${notificationTime}
      </div>
    `;
    }

    html += `</div>`;

    await Swal.fire({
      title: notificationTitle,
      customClass: { container: "student-notification-overlay", popup: "student-notification-dialog" },
      html,
      confirmButtonText: "Close",
      confirmButtonColor: "#7fa9d6",
    });
  };

  /* =====================================================
     LOGOUT
  ===================================================== */
  const handleLogout = () => {
    setProfileMenuOpen(false);
    setNotificationMenuOpen(false);
    [
      "token",
      "authToken",
      "puffy-token",
      "puffy-user",
      "user",
      "currentUser",
      "user_email",
      "user_role",
      "username",
      "year_level",
      "section_name",
      "school_name",
    ].forEach((key) => localStorage.removeItem(key));
    ["token", "authToken", "puffy-token", "user", "currentUser"].forEach(
      (key) => sessionStorage.removeItem(key),
    );
    navigate("/login", {
      replace: true,
    });
  };
  /* =====================================================
     JSX
  ===================================================== */
  return (
    <header className="student-header">
      {/* SEARCH */}
      {showSearch && (
        <form className="student-header-search" role="search" onSubmit={(event) => {
          event.preventDefault();
          if (!onSearchChange) navigate(`/student/enrolled-courses?search=${encodeURIComponent(localSearch.trim())}`);
        }}>
          <input
            type="search"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={onSearchChange ? searchValue : localSearch}
            onChange={(event) => {
              if (onSearchChange) {
                onSearchChange(event.target.value);
              } else {
                setLocalSearch(event.target.value);
              }
            }}
          />
          <button type="submit" className="student-header-search-icon" aria-label="Search courses">
            <svg viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="5.5" />
              <path d="m15 15 4 4" />
            </svg>
          </button>
        </form>
      )}
      {/* RIGHT SIDE */}
      <div className="student-header-actions">
        {/* NOTIFICATION */}
        <div className="notification-menu-wrapper">
          <button
            type="button"
            className={`notification-button ${
              notificationMenuOpen ? "active" : ""
            }`}
            aria-label="Notifications"
            aria-expanded={notificationMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setProfileMenuOpen(false);
              setNotificationMenuOpen((current) => !current);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.6 17.4h10.8l-.9-1.6v-4.5a4.5 4.5 0 0 0-9 0v4.5l-.9 1.6Z" />
              <path d="M10 19.2h4" />
            </svg>
            {unreadNotificationCount > 0 && (
              <span className="notification-badge">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </button>
          {/* NOTIFICATION DROPDOWN */}
          {notificationMenuOpen && (
            <section
              className="notification-dropdown-menu"
              role="dialog"
              aria-label="Notifications"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="notification-dropdown-header">
                <div>
                  <h2>Notifications</h2>
                  <span>
                    {unreadNotificationCount > 0
                      ? `${unreadNotificationCount} unread`
                      : "You are all caught up"}
                  </span>
                </div>
                {unreadNotificationCount > 0 && (
                  <button
                    type="button"
                    className="mark-all-read-button"
                    onClick={markAllNotificationsAsRead}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {/* FILTER */}
              <div className="notification-dropdown-tabs">
                <button
                  type="button"
                  className={notificationFilter === "all" ? "active" : ""}
                  onClick={() => setNotificationFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={notificationFilter === "unread" ? "active" : ""}
                  onClick={() => setNotificationFilter("unread")}
                >
                  Unread
                </button>
              </div>
              {/* NOTIFICATION LIST */}
              <div className="notification-list">
                {notificationsLoading ? (
                  <div className="notification-empty-state">
                    <strong>Loading notifications...</strong>
                  </div>
                ) : visibleNotifications.length === 0 ? (
                  <div className="notification-empty-state">
                    <span className="notification-empty-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6.6 17.4h10.8l-.9-1.6v-4.5a4.5 4.5 0 0 0-9 0v4.5l-.9 1.6Z" />
                        <path d="M10 19.2h4" />
                      </svg>
                    </span>
                    <strong>No notifications</strong>
                    <p>New updates will appear here.</p>
                  </div>
                ) : (
                  visibleNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`notification-item ${
                        notification.unread ? "unread" : ""
                      }`}
                      onClick={() => openNotification(notification)}
                    >
                      {/* ICON */}
                      <span
                        className={`notification-item-icon ${notification.icon}`}
                        aria-hidden="true"
                      >
                        {notification.icon === "course" ? (
                          <svg viewBox="0 0 24 24">
                            <path d="m3.5 8.2 8.5-4.7 8.5 4.7-8.5 4.7-8.5-4.7Z" />
                            <path d="M6.5 10.2v5c0 1.3 2.5 3 5.5 3s5.5-1.7 5.5-3v-5" />
                          </svg>
                        ) : notification.icon === "announcement" ? (
                          <svg viewBox="0 0 24 24">
                            <path d="M4 11v2h3l7 4V7l-7 4H4Z" />
                            <path d="m17 9 3-2M17 12h3M17 15l3 2" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24">
                            <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
                          </svg>
                        )}
                      </span>
                      {/* COPY */}
                      <span className="notification-item-copy">
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                        <small>{notification.time}</small>
                      </span>
                      {notification.unread && (
                        <span
                          className="notification-unread-dot"
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                className="notification-view-all-button"
                onClick={() => {
                  setNotificationMenuOpen(false);
                  navigate("/student/notifications");
                }}
              >
                See all notifications
              </button>
            </section>
          )}
        </div>
        {/* JOIN COURSE */}
        {showJoinCourse && (
          <button
            type="button"
            className="student-join-course-button"
            onClick={() => {
              if (onJoinCourse) {
                onJoinCourse();
              }
            }}
          >
            + Join course
          </button>
        )}
        {/* PROFILE */}
        <div className="profile-menu-wrapper">
          <div className="profile-chip">
            <button
              type="button"
              className="profile-main-button"
              onClick={() => navigate("/student/profile")}
            >
              <span className="profile-avatar">
                <img
                  src={profileImage}
                  alt={`${displayName}'s profile`}
                  className="profile-header-image"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                />
                <span className="profile-status-dot" />
              </span>
              <span className="profile-user-info">
                <strong>{profileHandle}</strong>
                <small>Student</small>
              </span>
            </button>
            {/* THREE DOT BUTTON */}
            <button
              type="button"
              className={`profile-dropdown-button ${
                profileMenuOpen ? "open" : ""
              }`}
              aria-label="Profile menu"
              aria-expanded={profileMenuOpen}
              onClick={(event) => {
                event.stopPropagation();
                setNotificationMenuOpen(false);
                setProfileMenuOpen((current) => !current);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="19" r="1.6" />
              </svg>
            </button>
          </div>
          {/* PROFILE DROPDOWN */}
          {profileMenuOpen && (
            <div
              className="profile-dropdown-menu"
              role="menu"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="profile-dropdown-header">
                <img
                  src={profileImage}
                  alt={`${displayName}'s profile`}
                  className="profile-dropdown-image"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                />
                <div>
                  <strong>{profileHandle}</strong>
                  <span>{accountLabel}</span>
                </div>
              </div>
              <div className="profile-dropdown-divider" />
              {/* VIEW PROFILE */}
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  navigate("/student/profile");
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" />
                </svg>
                <span>View profile</span>
              </button>
              {/* SETTINGS */}
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  navigate("/student/settings");
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19 13.5v-3l-2-.6a7 7 0 0 0-.7-1.6l1-1.8-2.1-2.1-1.8 1a7 7 0 0 0-1.6-.7L11.5 3h-3l-.6 2a7 7 0 0 0-1.6.7l-1.8-1-2.1 2.1 1 1.8a7 7 0 0 0-.7 1.6L1 10.5v3l2 .6a7 7 0 0 0 .7 1.6l-1 1.8 2.1 2.1 1.8-1a7 7 0 0 0 1.6.7l.6 2h3l.6-2a7 7 0 0 0 1.6-.7l1.8 1 2.1-2.1-1-1.8a7 7 0 0 0 .7-1.6Z" />
                </svg>
                <span>Settings</span>
              </button>
              <div className="profile-dropdown-divider" />
              {/* LOGOUT */}
              <button
                type="button"
                className="profile-logout-option"
                onClick={handleLogout}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 5H5v14h5" />
                  <path d="m14 8 4 4-4 4" />
                  <path d="M18 12H9" />
                </svg>
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
