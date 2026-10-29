import { useEffect, useState } from "react";

import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";

import { API_BASE } from "../../../config.js";

import {
  FiCalendar,
  FiGrid,
  FiUsers,
  FiBook,
  FiBell,
  FiActivity,
  FiSettings,
  FiUser,
  FiSearch,
  FiLogOut,
} from "react-icons/fi";

import RoleNotificationMenu from "../../../components/rolenotif/RoleNotificationMenu";

import HeaderProfileChip from "../../../components/HeaderProfileChip";

import "./AdminLayout.css";

/* =====================================================

   API CONFIG

/===================================================== */

const API_BASE_URL = API_BASE;

const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const DEFAULT_PROFILE_IMAGE = "/images/temporaryimg.png";

/* =====================================================

   MENU

/===================================================== */

const mainMenuItems = [

  {
    label: "Dashboard",

    path: "/admin/dashboard",

    icon: FiGrid,
  },
  {
    label: "Academic Calendar",
    path: "/admin/academic-calendar",
    icon: FiCalendar,
  },

  {
    label: "User Management",

    path: "/admin/users",

    icon: FiUsers,
  },

  {
    label: "Course Management",

    path: "/admin/courses",

    icon: FiBook,
  },

  {
    label: "Reports",

    path: "/admin/reports",

    icon: FiActivity,
  },

  {
    label: "Announcements & Notifications",

    path: "/admin/notification",

    icon: FiBell,
  },

  {
    label: "Profile",

    path: "/admin/profile",

    icon: FiUser,
  },

  {
    label: "Settings",

    path: "/admin/settings",

    icon: FiSettings,
  },
];

/* =====================================================

   GET TOKEN

/===================================================== */

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("puffy-token")
  );
}

/* =====================================================

   GET STORED USER

/===================================================== */

function getStoredUser() {
  try {
    const storedUser =
      localStorage.getItem("puffy-user") ||
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser");

    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Unable to read stored admin:", error);

    return null;
  }
}

/* =====================================================

   PROFILE IMAGE

/===================================================== */

function resolveProfileImage(imagePath) {
  if (!imagePath || typeof imagePath !== "string") {
    return DEFAULT_PROFILE_IMAGE;
  }

  const path = imagePath.trim().replace(/\\/g, "/");

  if (path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }

  let fixedPath = path;

  if (fixedPath.startsWith("http://") || fixedPath.startsWith("https://")) {
    const url = new URL(fixedPath);

    if (url.hostname !== "localhost") {
      return fixedPath;
    }

    fixedPath = url.pathname;
  }

  if (fixedPath.startsWith("/api/uploads/")) {
    fixedPath = fixedPath.replace("/api/uploads/", "/uploads/");
  }

  if (!fixedPath.startsWith("/")) {
    fixedPath = `/${fixedPath}`;
  }

  return `${API_BASE.replace(/\/api$/, "")}${fixedPath}`;
}

/* =====================================================

   DISPLAY NAME

\===================================================== */

function getDisplayName(user) {
  const name =
    user?.displayName ||
    user?.display_name ||
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Admin";

  return String(name).replace(/^@+/, "");
}

/* =====================================================

   COMPONENT

\===================================================== */

export default function AdminLayout({ children }) {
  const { user: authUser, logout } = useAuth();

  const navigate = useNavigate();

  /* ===================================================

     HEADER USER

  =================================================== */

  const [headerUser, setHeaderUser] = useState(() => {
    return getStoredUser() || authUser || null;
  });

  /* ===================================================

     SIDEBAR

  =================================================== */

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("adminSidebarCollapsed") === "true";
  });

  /* ===================================================

     FETCH LOGGED-IN ADMIN

  =================================================== */

  useEffect(() => {
    const fetchCurrentAdmin = async () => {
      try {
        const token = getStoredToken();

        if (!token) {
          return;
        }

        const response = await fetch(`${API_BASE_URL}/users/me`, {
          method: "GET",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          console.error("Unable to load admin:", data.message);

          return;
        }

        const loggedInUser = data.user || data.data?.user || data.data || data;

        if (!loggedInUser) {
          return;
        }

        /*

         * Only accept an Admin account.

         *

         * If you also want super-admin to use

         * this layout, add:

         *

         * loggedInUser.role !== 'super-admin'

         */

        if (loggedInUser.role && loggedInUser.role !== "admin") {
          return;
        }

        setHeaderUser(loggedInUser);

        const serializedUser = JSON.stringify(loggedInUser);

        localStorage.setItem("puffy-user", serializedUser);

        localStorage.setItem("user", serializedUser);

        localStorage.setItem("currentUser", serializedUser);
      } catch (error) {
        console.error("Admin header loading error:", error);
      }
    };

    fetchCurrentAdmin();
  }, []);

  /* ===================================================

     SYNC AUTH USER

  =================================================== */

  useEffect(() => {
    if (!authUser) {
      return;
    }

    setHeaderUser((currentUser) => ({
      ...currentUser,

      ...authUser,
    }));
  }, [authUser]);

  /* ===================================================

     LISTEN FOR PROFILE CHANGES

  =================================================== */

  useEffect(() => {
    const handleUserUpdated = (event) => {
      const updatedUser = event.detail || getStoredUser();

      if (!updatedUser) {
        return;
      }

      setHeaderUser((currentUser) => ({
        ...currentUser,

        ...updatedUser,
      }));
    };

    const handleStorageChange = (event) => {
      if (
        event.key !== "puffy-user" &&
        event.key !== "user" &&
        event.key !== "currentUser"
      ) {
        return;
      }

      const updatedUser = getStoredUser();

      if (updatedUser) {
        setHeaderUser(updatedUser);
      }
    };

    const handleProfileImageUpdated = (event) => {
      const image = event.detail?.profileImage || event.detail?.profile_image;

      if (!image) {
        return;
      }

      setHeaderUser((currentUser) => ({
        ...currentUser,

        profileImage: image,

        profile_image: image,
      }));
    };

    window.addEventListener("puffy-user-updated", handleUserUpdated);

    window.addEventListener("profile-image-updated", handleProfileImageUpdated);

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("puffy-user-updated", handleUserUpdated);

      window.removeEventListener(
        "profile-image-updated",

        handleProfileImageUpdated,
      );

      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  /* ===================================================

     HEADER VALUES

  =================================================== */

  const profileImagePath =
    headerUser?.profileImage ||
    headerUser?.profile_image ||
    headerUser?.profileImageUrl ||
    headerUser?.profile_image_url ||
    headerUser?.avatar ||
    headerUser?.image ||
    "";

  const avatarSrc = resolveProfileImage(profileImagePath);

  const displayName = getDisplayName(headerUser);

  /* ===================================================

     TOGGLE SIDEBAR

  =================================================== */

  const toggleSidebar = () => {
    setSidebarCollapsed((currentValue) => {
      const newValue = !currentValue;

      localStorage.setItem("adminSidebarCollapsed", String(newValue));

      return newValue;
    });
  };

  /* ===================================================

     LOGOUT

  =================================================== */

  const handleLogout = () => {
    void logout();

    navigate("/login", {
      replace: true,
    });
  };

  /* ===================================================

     PAGE

  =================================================== */

  return (
    <div
      className={`admin-layout ${
        sidebarCollapsed ? "admin-sidebar-collapsed" : ""
      }`}
    >
      {/* ================================================

          SIDEBAR

      ================================================= */}

      <aside className="admin-sidebar">
        <div
          className="sidebar-brand"
          style={{
            height: 120,
            minHeight: 120,
            padding: "10px 12px",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"

            className="admin-logo-button"
            style={{
              width: "100%",
              maxWidth: sidebarCollapsed ? 65 : 280,
              height: sidebarCollapsed ? 65 : 100,
              flex: sidebarCollapsed ? "0 1 65px" : "0 1 280px",
              borderRadius: 0,
            }}

            onClick={toggleSidebar}

            aria-label={
              sidebarCollapsed
                ? "Expand admin sidebar"
                : "Collapse admin sidebar"
            }

            aria-expanded={!sidebarCollapsed}

            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <img
              src="/images/Admin.png"
              alt="PuffyBrain Admin"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </button>
        </div>

        <nav className="sidebar-menu" aria-label="Admin navigation">
          {mainMenuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}

                to={item.path}

                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }

                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="sidebar-icon" aria-hidden="true" />

                <span className="admin-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button
          type="button"

          onClick={handleLogout}

          className="logout-btn"

          title={sidebarCollapsed ? "Logout" : undefined}
        >
          <FiLogOut aria-hidden="true" />

          <span className="admin-logout-label">Logout</span>
        </button>
      </aside>

      {/* ================================================

          MAIN AREA

      ================================================= */}

      <main className="admin-main">
        {/* ==============================================

            HEADER

        =============================================== */}

        <header className="admin-header">
          <label className="admin-header-search">
            <input
              type="search"

              placeholder="Search..."

              aria-label="Search admin pages"
            />

            <span className="search-icon" aria-hidden="true">
              <FiSearch />
            </span>
          </label>

          <div className="admin-header-actions">
            <RoleNotificationMenu role="admin" />

            <HeaderProfileChip
              username={displayName}

              accountLabel="Admin account"

              avatarSrc={avatarSrc}

              profilePath="/admin/profile"

              menuItems={[
                {
                  label: "Profile",

                  path: "/admin/profile",

                  icon: "user",
                },

                {
                  label: "Settings",

                  path: "/admin/settings",

                  icon: "settings",
                },
              ]}

              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* ==============================================

            PAGE CONTENT

        =============================================== */}

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
