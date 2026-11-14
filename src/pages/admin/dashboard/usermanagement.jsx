import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./user.module.css";
import "boxicons/css/boxicons.min.css";
import Swal from "sweetalert2";
import confirmLogout from "../../../utils/confirmLogout.js";
import { API_BASE } from "../../config.js";
import AHeader from "../../components/AHeader";
import ASidebar from "../../components/ASidebar";
import LoadingState from "../../components/LoadingState.jsx";

export default function UserManagement() {
  const navigate = useNavigate();
  const fetchedOnce = useRef(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDecks, setSelectedUserDecks] = useState([]);
  const [selectedUserCourses, setSelectedUserCourses] = useState([]);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsToShow, setRowsToShow] = useState(10);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [bellNotifications, setBellNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const formatDate = (dateValue) => {
    if (!dateValue) return "No date";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "No date";
    }

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatVerified = (value) => {
    return Number(value) === 1 ? "True" : "False";
  };

  const isUserArchived = (user) => {
    const archived = String(user?.archived ?? "").toLowerCase();
    const isArchived = String(user?.is_archived ?? "").toLowerCase();
    const status = String(user?.status ?? "").toLowerCase();

    return (
      archived === "1" ||
      archived === "true" ||
      archived === "archived" ||
      isArchived === "1" ||
      isArchived === "true" ||
      isArchived === "archived" ||
      status === "archived"
    );
  };

  const fetchAdmin = async () => {
    try {
      const res = await fetch(`${API_BASE}/getAdminProfile.php`, {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();

      if (!data.success) {
        console.error(data.message || "Admin not found");
        return;
      }

      setAdmin({
        id: data.admin?.id || data.admin?.AdminID || "",
        username: data.admin?.username || data.admin?.Username || "Admin",
        full_name: data.admin?.full_name || data.admin?.FullName || "",
        email: data.admin?.email || data.admin?.Email || "",
        role: data.admin?.role || data.admin?.Role || "Administrator",
        profile_image:
          data.admin?.profile_image || "/images/temporary profile.jpg",
      });
    } catch (err) {
      console.error("Fetch admin error:", err);
    }
  };

  const fetchBellNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/getAdminNotifications.php`, {
        method: "GET",
        credentials: "include",
      });

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

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();

    try {
      const res = await fetch(`${API_BASE}/markAdminNotificationsRead.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.success) {
        await fetchBellNotifications();
        setNotificationOpen(true);
      } else {
        Swal.fire("Error", data.message || "Failed to mark as read.", "error");
      }
    } catch (err) {
      console.error("Mark all as read error:", err);
      Swal.fire("Server Error", "Failed to mark as read.", "error");
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

  const formatUserId = (user) => {
    const date = user.created_at ? new Date(user.created_at) : new Date();

    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const dd = String(date.getDate()).padStart(2, "0");

    const encrypted = (Number(user.id) * 92837)
      .toString(16)
      .toUpperCase()
      .substring(0, 4);

    return `STD${mm}${yyyy}${dd}${encrypted}`;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/getUsers.php`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
      } else {
        setError(data.message || "Failed to fetch users.");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Server error. Check getUsers.php.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setSelectedUserDecks([]);
    setSelectedUserCourses([]);
    setUserDetailsLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/getUserDetailsAdmin.php?user_id=${encodeURIComponent(
          user.id,
        )}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const data = await res.json();

      if (data.success) {
        setSelectedUser((prev) => ({
          ...prev,
          ...(data.user || {}),
        }));

        setSelectedUserDecks(data.decks || []);
        setSelectedUserCourses(data.courses || []);
      } else {
        setSelectedUserDecks([]);
        setSelectedUserCourses([]);
        Swal.fire(
          "Error",
          data.message || "Failed to fetch user details",
          "error",
        );
      }
    } catch (err) {
      console.error(err);
      setSelectedUserDecks([]);
      setSelectedUserCourses([]);
    } finally {
      setUserDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedOnce.current) return;

    fetchedOnce.current = true;

    fetchAdmin();
    fetchUsers();
    fetchBellNotifications();

    const handler = (e) => {
      const insideDropdown = e.target.closest('[class*="notificationWrapper"]');

      if (!insideDropdown) {
        setNotificationOpen(false);
      }
    };

    window.addEventListener("click", handler);

    return () => {
      window.removeEventListener("click", handler);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, rowsToShow]);

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.trim().toLowerCase();

    return (
      String(user.id || "")
        .toLowerCase()
        .includes(q) ||
      String(user.username || "")
        .toLowerCase()
        .includes(q) ||
      String(user.email || "")
        .toLowerCase()
        .includes(q) ||
      String(user.year_level || "")
        .toLowerCase()
        .includes(q) ||
      String(user.school || "")
        .toLowerCase()
        .includes(q)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === "newest") return Number(b.id) - Number(a.id);
    if (sortBy === "oldest") return Number(a.id) - Number(b.id);

    if (sortBy === "username") {
      return String(a.username || "").localeCompare(String(b.username || ""));
    }

    if (sortBy === "email") {
      return String(a.email || "").localeCompare(String(b.email || ""));
    }

    return 0;
  });

  const totalPages = Math.ceil(sortedUsers.length / rowsToShow);

  const currentUsers = sortedUsers.slice(
    (currentPage - 1) * rowsToShow,
    currentPage * rowsToShow,
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
        <div className={styles.pageTop}>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>User Management</h1>
            <p>Tracks the users of PuffyBrain.</p>
          </div>

          <div className={styles.sortBox}>
            <label>Sort by:</label>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest User</option>
              <option value="oldest">Oldest User</option>
              <option value="username">Username A-Z</option>
              <option value="email">Email A-Z</option>
            </select>
          </div>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div>User ID</div>
            <div>Username</div>
            <div>Email</div>
            <div>Action</div>
          </div>

          <div className={styles.tableContent}>
            {loading && (
              <div className={styles.message}>
                <LoadingState fullPage={false} />
              </div>
            )}

            {!loading && error && (
              <div className={styles.errorMessage}>{error}</div>
            )}

            {!loading && !error && currentUsers.length === 0 && (
              <div className={styles.message}>No users found.</div>
            )}

            {!loading &&
              !error &&
              currentUsers.map((user) => (
                <div className={styles.row} key={user.id}>
                  <div className={styles.userId}>{formatUserId(user)}</div>
                  <div>{user.username || "No username"}</div>
                  <div>{user.email || "No email found"}</div>

                  <button
                    type="button"
                    className={styles.viewBtn}
                    onClick={() => handleViewUser(user)}
                  >
                    View
                  </button>
                </div>
              ))}
          </div>

          <div className={styles.paginationWrapper}>
            <div className={styles.paginationCenter}>
              <button
                type="button"
                className={styles.navBtn}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              >
                {"<"}
              </button>

              {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    type="button"
                    key={page}
                    className={`${styles.pageBtn} ${
                      currentPage === page ? styles.pageActive : ""
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ),
              )}

              <button
                type="button"
                className={styles.navBtn}
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
              >
                {">"}
              </button>
            </div>

            <div className={styles.rowsControl}>
              <span>Show</span>

              <select
                value={rowsToShow}
                onChange={(e) => {
                  setRowsToShow(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>

              <span>Row</span>
            </div>
          </div>
        </div>
      </main>

      {selectedUser && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedUser(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              User Profile
              <span
                className={styles.close}
                onClick={() => setSelectedUser(null)}
              >
                ×
              </span>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.profileGrid}>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>ID</span>
                  <span className={styles.profileValue}>
                    {formatUserId(selectedUser)}
                  </span>
                </div>

                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Username</span>
                  <span className={styles.profileValue}>
                    {selectedUser.username || "No username"}
                  </span>
                </div>

                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Email</span>
                  <span className={styles.profileValue}>
                    {selectedUser.email || "No email found"}
                  </span>
                </div>

                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Year Level</span>
                  <span className={styles.profileValue}>
                    {selectedUser.year_level || "No year level"}
                  </span>
                </div>

                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>School</span>
                  <span className={styles.profileValue}>
                    {selectedUser.school || "No school"}
                  </span>
                </div>

                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Created At</span>
                  <span className={styles.profileValue}>
                    {formatDate(selectedUser.created_at)}
                  </span>
                </div>

                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Is Verified</span>
                  <span className={styles.profileValue}>
                    {formatVerified(selectedUser.is_verified)}
                  </span>
                </div>

                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Account Status</span>

                  <span
                    className={`${styles.accountStatusBadge} ${
                      isUserArchived(selectedUser)
                        ? styles.archivedAccount
                        : styles.activeAccount
                    }`}
                  >
                    {isUserArchived(selectedUser) ? "Archived" : "Active"}
                  </span>
                </div>
              </div>

              <div className={styles.userInfoSection}>
                <h3>Decks Made</h3>

                {userDetailsLoading ? (
                  <LoadingState fullPage={false} />
                ) : selectedUserDecks.length === 0 ? (
                  <p>No decks made by this user.</p>
                ) : (
                  <div className={styles.infoList}>
                    {selectedUserDecks.map((deck) => (
                      <div className={styles.infoItem} key={deck.deck_id}>
                        <p>
                          <strong>{deck.title || "No title"}</strong>
                        </p>
                        <p>{deck.description || "No description"}</p>
                        <p>Visibility: {deck.visibility || "Public"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.userInfoSection}>
                <h3>Courses Added</h3>

                {userDetailsLoading ? (
                  <LoadingState fullPage={false} />
                ) : selectedUserCourses.length === 0 ? (
                  <p>No courses added by this user.</p>
                ) : (
                  <div className={styles.infoList}>
                    {selectedUserCourses.map((course) => (
                      <div
                        className={styles.infoItem}
                        key={course.id || course.lesson_id}
                      >
                        <p>
                          <strong>{course.title || "No title"}</strong>
                        </p>
                        <p>{course.subject || "No subject"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
