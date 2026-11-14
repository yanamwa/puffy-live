import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import confirmLogout from "../../utils/confirmLogout.js";
import styles from "./notification.module.css";
import "boxicons/css/boxicons.min.css";
import { API_BASE } from "../../config.js";

import AHeader from "../../components/AHeader";
import ASidebar from "../../components/ASidebar";

export default function NotificationManagement() {
  const navigate = useNavigate();

  const [bellNotifications, setBellNotifications] = useState([]);
  const [historyNotifications, setHistoryNotifications] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOpen, setSortOpen] = useState(false);

  const notificationsPerPage = 3;
  const fetchedOnce = useRef(false);

  const [admin, setAdmin] = useState({
    id: "",
    username: "Admin",
    full_name: "",
    email: "",
    role: "",
    profile_image: "/images/temporary profile.jpg",
  });

  const adminImage =
    admin.profile_image &&
    !admin.profile_image.includes("temporary profile.jpg")
      ? admin.profile_image.startsWith("http")
        ? admin.profile_image
        : `${API_BASE}/${admin.profile_image.replace(/^\/+/, "")}`
      : "/images/temporary profile.jpg";

  const showNotifSwal = (config = {}) => {
    return Swal.fire({
      buttonsStyling: false,
      customClass: {
        popup: styles.swalPopup,
        image: styles.swalImage,
        actions: styles.swalActions,
        confirmButton: styles.confirmBtnSwal,
        cancelButton: styles.cancelBtnSwal,
        ...(config.customClass || {}),
      },
      ...config,
    });
  };

  const fetchAdmin = async () => {
    try {
      const res = await fetch(`${API_BASE}/getAdminProfile.php`, {
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setAdmin({
          id: data.admin?.id || data.admin?.AdminID || "",
          username: data.admin?.username || data.admin?.Username || "Admin",
          full_name: data.admin?.full_name || data.admin?.FullName || "",
          email: data.admin?.email || data.admin?.Email || "",
          role: data.admin?.role || data.admin?.Role || "",
          profile_image:
            data.admin?.profile_image || "/images/temporary profile.jpg",
        });
      }
    } catch (err) {
      console.error("Fetch admin error:", err);
    }
  };

  const fetchBellNotifications = async () => {
    try {
      const storedAdmin = JSON.parse(localStorage.getItem("admin") || "{}");
      const adminId = storedAdmin.id || localStorage.getItem("admin_id");

      const res = await fetch(
        `${API_BASE}/getAdminNotifications.php?admin_id=${adminId || ""}`,
        { credentials: "include" },
      );

      const data = await res.json();

      if (data.success) {
        setBellNotifications(data.notifications || []);
      } else {
        setBellNotifications([]);
      }
    } catch (err) {
      console.error("Bell notification fetch error:", err);
      setBellNotifications([]);
    }
  };

  const fetchHistoryNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/getAllNotifications.php`, {
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setHistoryNotifications(data.notifications || []);
      } else {
        setHistoryNotifications([]);
      }
    } catch (err) {
      console.error("History notification fetch error:", err);
      setHistoryNotifications([]);
    }
  };

  useEffect(() => {
    if (fetchedOnce.current) return;

    fetchedOnce.current = true;

    fetchAdmin();
    fetchBellNotifications();
    fetchHistoryNotifications();

    const handler = (e) => {
      const insideDropdown = e.target.closest(
        '[class*="notificationWrapper"], [class*="customSort"]',
      );

      if (!insideDropdown) {
        setNotificationOpen(false);
        setSortOpen(false);
      }
    };

    window.addEventListener("click", handler);

    return () => {
      window.removeEventListener("click", handler);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy]);

  const handleAddNotification = async (e) => {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      await showNotifSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        title: "Missing Fields",
        text: "Please enter both title and message.",
        confirmButtonText: "OK",
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/addNotification.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          recipient_type: targetRole,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await showNotifSwal({
          imageUrl: "/images/success.png",
          imageWidth: 190,
          imageHeight: 190,
          title: "Notification Added",
          text: "Your notification has been posted.",
          confirmButtonText: "OK",
        });

        setTitle("");
        setMessage("");
        setTargetRole("all");

        fetchBellNotifications();
        fetchHistoryNotifications();
      } else {
        await showNotifSwal({
          imageUrl: "/images/error.png",
          imageWidth: 190,
          imageHeight: 190,
          title: "Error",
          text: data.message || "Failed to add notification.",
          confirmButtonText: "OK",
        });
      }
    } catch (err) {
      console.error("Add notification error:", err);

      await showNotifSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        title: "Server Error",
        text: "Failed to add notification.",
        confirmButtonText: "OK",
      });
    }
  };

  const handleDelete = async (notificationId) => {
    const result = await showNotifSwal({
      imageUrl: "/images/asking.png",
      imageWidth: 190,
      imageHeight: 190,
      title: "Delete notification?",
      text: "This cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}/deleteNotification.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notification_id: notificationId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await showNotifSwal({
          imageUrl: "/images/success.png",
          imageWidth: 190,
          imageHeight: 190,
          title: "Deleted",
          text: "Notification removed successfully.",
          confirmButtonText: "OK",
        });

        fetchBellNotifications();
        fetchHistoryNotifications();
      } else {
        await showNotifSwal({
          imageUrl: "/images/error.png",
          imageWidth: 190,
          imageHeight: 190,
          title: "Error",
          text: data.message || "Failed to delete notification.",
          confirmButtonText: "OK",
        });
      }
    } catch (err) {
      console.error("Delete notification error:", err);

      await showNotifSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        title: "Server Error",
        text: "Failed to delete notification.",
        confirmButtonText: "OK",
      });
    }
  };

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();

    const storedAdmin = JSON.parse(localStorage.getItem("admin") || "{}");
    const adminId = storedAdmin.id || localStorage.getItem("admin_id");

    if (!adminId) {
      await showNotifSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        title: "Error",
        text: "Admin ID not found. Please log in again.",
        confirmButtonText: "OK",
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/markAdminNotificationsRead.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          admin_id: adminId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await fetchBellNotifications();
        await fetchHistoryNotifications();
        setNotificationOpen(true);
      } else {
        await showNotifSwal({
          imageUrl: "/images/error.png",
          imageWidth: 190,
          imageHeight: 190,
          title: "Error",
          text: data.message || "Failed to mark as read.",
          confirmButtonText: "OK",
        });
      }
    } catch (err) {
      console.error("Mark all as read error:", err);

      await showNotifSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        title: "Server Error",
        text: "Failed to mark as read.",
        confirmButtonText: "OK",
      });
    }
  };

  const handleLogout = async (e) => {
    e.preventDefault();

    if (!(await confirmLogout())) return;

    try {
      await fetch(`${API_BASE}/adminLogout.php`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout API error:", err);
    }

    localStorage.removeItem("admin");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("admin_username");
    localStorage.removeItem("admin_email");
    sessionStorage.clear();

    navigate("/pb-admin-access", { replace: true });
  };

  const filteredNotifications = historyNotifications
    .filter((item) => {
      const q = search.toLowerCase();

      return (
        String(item.title || "")
          .toLowerCase()
          .includes(q) ||
        String(item.message || "")
          .toLowerCase()
          .includes(q) ||
        String(item.recipient_type || "")
          .toLowerCase()
          .includes(q) ||
        String(item.created_by || "")
          .toLowerCase()
          .includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at) - new Date(a.created_at);
      }

      if (sortBy === "oldest") {
        return new Date(a.created_at) - new Date(b.created_at);
      }

      if (sortBy === "az") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }

      if (sortBy === "za") {
        return String(b.title || "").localeCompare(String(a.title || ""));
      }

      return 0;
    });

  const totalPages = Math.ceil(
    filteredNotifications.length / notificationsPerPage,
  );

  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * notificationsPerPage,
    currentPage * notificationsPerPage,
  );

  return (
    <div
      className={`${styles.gridContainer} ${
        isCollapsed ? styles.collapsedGrid : ""
      }`}
    >
      <ASidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        handleLogout={handleLogout}
      />

      <AHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        notificationOpen={notificationOpen}
        setNotificationOpen={setNotificationOpen}
        bellNotifications={bellNotifications}
        handleMarkAllAsRead={handleMarkAllAsRead}
        admin={admin}
        adminImage={adminImage}
      />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1>Notification Management</h1>
          <p>Create and manage announcements for PuffyBrain users.</p>
        </div>

        <div className={styles.notificationGrid}>
          <form className={styles.formCard} onSubmit={handleAddNotification}>
            <div className={styles.formContent}>
              <div className={styles.formHeader}>
                <h2>Create Notification</h2>
              </div>

              <div className={styles.formGroup}>
                <label>Title</label>
                <input
                  type="text"
                  placeholder="Enter notification title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Message</label>
                <textarea
                  placeholder="Write your notification message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Send To</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="user">Users</option>
                  <option value="admin">Admins</option>
                </select>
              </div>

              <button className={styles.postBtn} type="submit">
                Post Notification
              </button>
            </div>
          </form>

          <div className={styles.listCard}>
            <div className={styles.listTop}>
              <h2>Posted Notifications</h2>

              <div className={styles.customSort}>
                <button
                  type="button"
                  className={styles.customSortBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSortOpen((prev) => !prev);
                  }}
                >
                  <i className="bx bx-sort-alt-2"></i>
                  <span>Sort by</span>
                  <i className="bx bx-chevron-down"></i>
                </button>

                {sortOpen && (
                  <div className={styles.customSortMenu}>
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("newest");
                        setSortOpen(false);
                      }}
                    >
                      Recently Added
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("oldest");
                        setSortOpen(false);
                      }}
                    >
                      Oldest
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("az");
                        setSortOpen(false);
                      }}
                    >
                      A-Z
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("za");
                        setSortOpen(false);
                      }}
                    >
                      Z-A
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.notificationsList}>
              {filteredNotifications.length > 0 ? (
                paginatedNotifications.map((item) => (
                  <div
                    className={styles.notificationCard}
                    key={item.notification_id}
                  >
                    <div className={styles.notificationCardTop}>
                      <h3>{item.title}</h3>

                      <span className={styles.notificationRole}>
                        {item.recipient_type}
                      </span>
                    </div>

                    <p className={styles.notificationMessage}>{item.message}</p>

                    <small className={styles.notificationDate}>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString("en-PH", {
                            timeZone: "Asia/Manila",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "No date"}
                    </small>

                    <br />

                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.notification_id)}
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div className={styles.noNotifications}>
                  <p>No notifications found.</p>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                >
                  Prev
                </button>

                <span>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
