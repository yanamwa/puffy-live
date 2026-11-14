import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import confirmLogout from "../../utils/confirmLogout.js";
import styles from "./backuprestore.module.css";
import "boxicons/css/boxicons.min.css";
import { API_BASE } from "../../config.js";

import AHeader from "../../components/AHeader";
import ASidebar from "../../components/ASidebar";

export default function AdminBackupRestore() {
  const navigate = useNavigate();

  const [restoreFile, setRestoreFile] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [bellNotifications, setBellNotifications] = useState([]);

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

  const showBackupSwal = (config = {}) => {
    return Swal.fire({
      buttonsStyling: false,
      customClass: {
        popup: styles.swalPopup,
        image: styles.swalImage,
        actions: styles.swalActions,
        confirmButton: styles.restoreBtnSwal,
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

  useEffect(() => {
    fetchAdmin();
    fetchBellNotifications();

    const handler = (e) => {
      const insideDropdown = e.target.closest('[class*="notificationWrapper"]');

      if (!insideDropdown) {
        setNotificationOpen(false);
      }
    };

    window.addEventListener("click", handler);

    return () => window.removeEventListener("click", handler);
  }, []);

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();

    const storedAdmin = JSON.parse(localStorage.getItem("admin") || "{}");
    const adminId = storedAdmin.id || localStorage.getItem("admin_id");

    if (!adminId) {
      showBackupSwal({
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
        setNotificationOpen(true);
      } else {
        showBackupSwal({
          imageUrl: "/images/error.png",
          imageWidth: 190,
          imageHeight: 190,
          title: "Error",
          text: data.message || "Failed to mark as read.",
          confirmButtonText: "OK",
        });
      }
    } catch (err) {
      showBackupSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        title: "Server Error",
        text: "Failed to mark as read.",
        confirmButtonText: "OK",
      });
    }
  };

  const handleBackup = () => {
    window.location.href = `${API_BASE}/backupDatabase.php`;
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      await showBackupSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        imageAlt: "Missing File",
        title: "Missing File",
        text: "Please choose a .sql backup file.",
        confirmButtonText: "OK",
      });
      return;
    }

    const result = await showBackupSwal({
      imageUrl: "/images/asking.png",
      imageWidth: 190,
      imageHeight: 190,
      imageAlt: "Restore Warning",
      title: "Restore Database?",
      text: "This will overwrite current database data.",
      showCancelButton: true,
      confirmButtonText: "Yes, restore",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const formData = new FormData();
    formData.append("backup_file", restoreFile);

    try {
      setIsRestoring(true);

      const res = await fetch(`${API_BASE}/restoreDatabase.php`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Server returned invalid JSON.");
      }

      if (data.success) {
        await showBackupSwal({
          imageUrl: "/images/success.png",
          imageWidth: 190,
          imageHeight: 190,
          imageAlt: "Success",
          title: "Success",
          text: data.message || "Database restored successfully.",
          confirmButtonText: "OK",
        });

        setRestoreFile(null);
      } else {
        await showBackupSwal({
          imageUrl: "/images/error.png",
          imageWidth: 190,
          imageHeight: 190,
          imageAlt: "Restore Failed",
          title: data.title || "Failed to Upload",
          text: data.message || "The data is up-to-date.",
          confirmButtonText: "OK",
        });
      }
    } catch (err) {
      console.error("Restore error:", err);

      await showBackupSwal({
        imageUrl: "/images/error.png",
        imageWidth: 190,
        imageHeight: 190,
        imageAlt: "Server Error",
        title: "Server Error",
        text: err.message || "Could not restore database.",
        confirmButtonText: "OK",
      });
    } finally {
      setIsRestoring(false);
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
          <h1>Backup & Restore</h1>
          <p>
            Manage database backups and restore your PuffyBrain system safely.
          </p>
        </div>

        <div className={styles.backupGrid}>
          <div className={styles.card}>
            <div className={styles.cardTop}></div>

            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <h2>Backup Database</h2>
              </div>

              <p className={styles.cardDescription}>
                Download a copy of the current database.
              </p>

              <button
                type="button"
                className={styles.backupBtn}
                onClick={handleBackup}
              >
                Download Backup
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTop}></div>

            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <h2>Restore Database</h2>
              </div>

              <p className={styles.cardDescription}>
                Upload a .sql file to restore the database.
              </p>

              <input
                type="file"
                accept=".sql"
                className={styles.fileInput}
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              />

              <button
                type="button"
                className={styles.restoreBtn}
                onClick={handleRestore}
                disabled={isRestoring}
              >
                {isRestoring ? "Restoring..." : "Restore Database"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
