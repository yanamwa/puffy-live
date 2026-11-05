import { useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiTrash2,
  FiSearch,
} from "react-icons/fi";
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
import "../notification/NotificationPage.css"
import Swal from "sweetalert2";

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
  const [searchQuery, setSearchQuery] = useState("");
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
  const query = searchQuery.trim().toLowerCase();

  return notifications
    .filter((item) => {
      const searchableText = [
        item.title,
        item.message,
        formatNotificationTarget(item.target),
        formatNotificationCreator(item),
        formatDate(item.createdAt),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    })
    .sort((a, b) => {
      if (sortBy === "oldest")
        return new Date(a.createdAt) - new Date(b.createdAt);

      if (sortBy === "az")
        return String(a.title).localeCompare(String(b.title));

      if (sortBy === "za")
        return String(b.title).localeCompare(String(a.title));

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}, [notifications, sortBy, searchQuery]);

  


const addNotification = async (event) => {
  event.preventDefault();

  if (!title.trim() || !message.trim()) {
    await Swal.fire({
      icon: "warning",
      title: "Missing Information",
      text: "Please enter both a title and message.",
      confirmButtonText: "OK",
      confirmButtonColor: "#7fa8d6",
    });
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

    const savedNotifications =
      await fetchManagedNotificationsFromServer();

    if (!Array.isArray(savedNotifications)) {
      throw new Error("Invalid notification response from server.");
    }

    setNotifications(savedNotifications);
    setTitle("");
    setMessage("");
    setTarget("all");

    await Swal.fire({
      icon: "success",
      title: "Announcement Posted!",
      text: "Your announcement has been posted successfully.",
      confirmButtonText: "OK",
      confirmButtonColor: "#7fa8d6",
    });
  } catch (error) {
    console.error("Failed to post notification:", error);

    await Swal.fire({
      icon: "error",
      title: "Unable to Confirm",
      text: "Please refresh and check the posted announcements before trying again.",
      confirmButtonText: "OK",
      confirmButtonColor: "#7fa8d6",
    });
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
    await Swal.fire({
      icon: "warning",
      title: "Permission Denied",
      text: "You do not have permission to delete this announcement.",
      confirmButtonColor: "#7fa8d6",
    });
    return;
  }

  const result = await Swal.fire({
    icon: "warning",
    title: "Delete Announcement?",
    text: "Are you sure you want to delete this announcement? This action cannot be undone.",
    showCancelButton: true,
    confirmButtonText: "Yes, Delete",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d33",
    cancelButtonColor: "#7fa8d6",
    reverseButtons: true,
  });

  if (!result.isConfirmed) return;

  try {
    const nextNotifications =
      await deleteManagedNotificationFromServer(notification.id);

    setNotifications(nextNotifications);

    await Swal.fire({
      icon: "success",
      title: "Announcement Deleted!",
      text: "The announcement has been deleted successfully.",
      confirmButtonColor: "#7fa8d6",
    });
  } catch (error) {
    console.error("Unable to delete announcement:", error);

    await Swal.fire({
      icon: "error",
      title: "Deletion Failed",
      text: "Unable to confirm deletion. Please refresh and check the list.",
      confirmButtonColor: "#7fa8d6",
    });
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

                <div className="notification-toolbar">
                  <div className="notification-search">
                    <FiSearch className="notification-search-icon" />

                    <input
                      type="search"
                      placeholder="Search..."
                      aria-label="Search notifications"
                      value={searchQuery}
                      onChange={(event) =>
                        setSearchQuery(event.target.value)
                      }
                    />
                  </div>

                  <label className="sort-control">
                    <span>Sort by</span>

                    <select
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(event.target.value)
                      }
                      aria-label="Sort notifications"
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="az">A-Z</option>
                      <option value="za">Z-A</option>
                    </select>

                    <FiChevronDown />
                  </label>
                </div>
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
