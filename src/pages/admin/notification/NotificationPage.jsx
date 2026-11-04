import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import {
  createManagedNotification,
  deleteManagedNotificationFromServer,
  fetchManagedNotificationsFromServer,
  formatNotificationCreator,
  formatNotificationRoleLabel,
  formatNotificationTarget,
  managedNotificationTargetOptions,
  readManagedNotifications,
  saveManagedNotificationToServer,
  subscribeToManagedNotifications,
  writeManagedNotifications,
} from "../../../utils/notifications";
import "../Features/AdminFeaturePages.css";

const defaultCopy = {
  pageTitle: "Notifications & Announcements",
  pageDescription:
    "Create and manage notifications and announcements for PuffyBrain users.",
  createTitle: "Create Notification or Announcement",
  titlePlaceholder: "Enter notification or announcement title",
  messagePlaceholder: "Write your notification or announcement message",
  postLabel: "Post Notification",
  listTitle: "Posted Notifications & Announcements",
  emptyMessage: "No notifications or announcements found.",
  deleteConfirm: "Delete this notification or announcement?",
};

const announcementCopy = {
  ...defaultCopy,
  pageTitle: "Announcement & Notification Management",
  createTitle: "Create Announcement",
  titlePlaceholder: "Enter announcement title",
  messagePlaceholder: "Write your announcement message",
  postLabel: "Post Announcement",
};

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function readStoredSessionUser() {
  const storageSources = [
    typeof localStorage === "undefined" ? null : localStorage,
    typeof sessionStorage === "undefined" ? null : sessionStorage,
  ];

  for (const storage of storageSources) {
    if (!storage) continue;

    const candidates = [
      storage.getItem("puffy-user"),
      storage.getItem("user"),
      storage.getItem("currentUser"),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;

      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }
  }

  return null;
}

function getUserDisplayName(user = {}) {
  return String(
    user.displayName ||
      user.display_name ||
      user.fullName ||
      user.full_name ||
      user.name ||
      user.username ||
      "",
  ).replace(/^@+/, "");
}

function normalizeCreatorRole(role) {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  if (normalizedRole === "superadmin") {
    return "superAdmin";
  }

  if (normalizedRole === "admin") {
    return "admin";
  }

  return role || "admin";
}

function getAnnouncementCreator(authUser) {
  const user = authUser || readStoredSessionUser() || {};

  const role = normalizeCreatorRole(
    user.role || user.userRole || user.user_role || "",
  );

  const name = getUserDisplayName(user) || formatNotificationRoleLabel(role);

  return {
    name,
    role,
  };
}

export default function NotificationPage({ variant = "notification" }) {
  const { user: authUser } = useAuth() || {};
  const copy = variant === "announcement" ? announcementCopy : defaultCopy;
  const creator = useMemo(() => getAnnouncementCreator(authUser), [authUser]);
  const currentUserRole = normalizeCreatorRole(
    authUser?.role || authUser?.userRole || authUser?.user_role || creator.role,
  );

  const isSuperAdmin = currentUserRole === "superAdmin";

  const isAdmin = currentUserRole === "admin";
  const [notifications, setNotifications] = useState(() =>
    readManagedNotifications(),
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [isPosting, setIsPosting] = useState(false);

  
  useEffect(() => {
    let isMounted = true;

    async function syncNotificationsFromServer() {
      try {
        const nextNotifications = await fetchManagedNotificationsFromServer();

        if (!isMounted) return;

        setNotifications((currentNotifications) => {
          const currentValue = JSON.stringify(currentNotifications);
          const nextValue = JSON.stringify(nextNotifications);

          return currentValue === nextValue
            ? currentNotifications
            : nextNotifications;
        });
      } catch (error) {
        console.warn("Unable to sync notifications from the server.", error);
      }
    }

    syncNotificationsFromServer();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const refreshNotifications = () => {
      const nextNotifications = readManagedNotifications();

      setNotifications((currentNotifications) => {
        const currentValue = JSON.stringify(currentNotifications);
        const nextValue = JSON.stringify(nextNotifications);

        return currentValue === nextValue
          ? currentNotifications
          : nextNotifications;
      });
    };

    return subscribeToManagedNotifications(refreshNotifications);
  }, []);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      if (sortBy === "oldest")
        return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "az")
        return String(a.title).localeCompare(String(b.title));
      if (sortBy === "za")
        return String(b.title).localeCompare(String(a.title));
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [notifications, sortBy]);

  

const addNotification = async (event) => {
  event.preventDefault();

  if (!title.trim() || !message.trim()) {
    window.alert("Please enter both title and message.");
    return;
  }

  const nextNotification = createManagedNotification({
    title: title.trim(),
    message: message.trim(),
    target,
    createdByName: creator.name,
    createdByRole: creator.role,
  });

  setIsPosting(true);

  try {
    await saveManagedNotificationToServer(nextNotification);

    // Reload notifications from the database.
    const savedNotifications =
      await fetchManagedNotificationsFromServer();

    if (!Array.isArray(savedNotifications)) {
      throw new Error("Invalid notification response from server.");
    }

    setNotifications(savedNotifications);

    setTitle("");
    setMessage("");
    setTarget("all");

  } catch (error) {
    console.error("Failed to post notification:", error);

    window.alert(
      "Unable to confirm that the notification was saved. Please refresh and check the list before trying again."
    );
  } finally {
    setIsPosting(false);
  }
};



  const canDeleteNotification = (notification) => {
    const creatorRole = normalizeCreatorRole(
      notification.createdByRole || notification.created_by_role || "",
    );

    // Super Admin can delete any notification.
    if (isSuperAdmin) {
      return true;
    }

    // Admin cannot delete Super Admin notifications.
    if (isAdmin && creatorRole === "superAdmin") {
      return false;
    }

    // Admin may delete Admin-created notifications.
    if (isAdmin && creatorRole === "admin") {
      return true;
    }

    return false;
  };

  const deleteNotification = async (notification) => {
    if (!canDeleteNotification(notification)) {
      window.alert("You do not have permission to delete this notification.");

      return;
    }

    const ok = window.confirm(copy.deleteConfirm);

    if (!ok) return;

    try {
      const nextNotifications = await deleteManagedNotificationFromServer(
        notification.id,
      );

      setNotifications(nextNotifications);
    } catch (error) {
      console.warn("Unable to delete notification from the server.", error);

      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id),
      );
    }
  };

  return (
    <div className="admin-page feature-page notification-management-page">
      <header className="super-page-heading super-standalone-heading"><div>
        <h1>{copy.pageTitle}</h1>
        <p>{copy.pageDescription}</p>
      </div></header>

      <div className="notification-management-grid">
        <form
          className="feature-card notification-form"
          onSubmit={addNotification}
        >
          <div className="feature-card-top" />
          <div className="feature-card-body">
            <h2>{copy.createTitle}</h2>

            <label className="feature-field">
              <span>Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={copy.titlePlaceholder}
              />
            </label>

            <label className="feature-field">
              <span>Message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={copy.messagePlaceholder}
              />
            </label>

            <label className="feature-field">
              <span>Send To</span>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                {managedNotificationTargetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="primary-feature-btn"
              type="submit"
              disabled={isPosting}
            >
              {isPosting ? "Posting..." : copy.postLabel}
            </button>
          </div>
        </form>

        <section className="feature-card notification-list-card">
          <div className="feature-card-top" />
          <div className="feature-card-body">
            <div className="feature-section-top">
              <h2>{copy.listTitle}</h2>
              <label className="sort-control">
                <span>Sort by</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="az">A-Z</option>
                  <option value="za">Z-A</option>
                </select>
                <FiChevronDown />
              </label>
            </div>

            <div className="notification-list">
              {sortedNotifications.length === 0 ? (
                <div className="feature-empty">{copy.emptyMessage}</div>
              ) : (
                sortedNotifications.map((item) => (
                  <article className="notification-item" key={item.id}>
                    <div className="notification-item-top">
                      <h3>{item.title}</h3>
                      <span>{formatNotificationTarget(item.target)}</span>
                    </div>
                    <p>{item.message}</p>
                    <div className="notification-item-meta">
                      <small className="notification-creator-meta">
                        {formatNotificationCreator(item)}
                      </small>
                      <small>{formatDate(item.createdAt)}</small>
                    </div>
                    {canDeleteNotification(item) && (
                      <button
                        className="danger-feature-btn"
                        type="button"
                        onClick={() => deleteNotification(item)}
                      >
                        <FiTrash2 />
                        Delete
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
