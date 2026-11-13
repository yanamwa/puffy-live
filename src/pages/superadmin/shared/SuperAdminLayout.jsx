import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE } from "../../../config.js";
import { useAuth } from "../../../context/AuthContext";

import SuperAdminSidebar from "../../../components/superadmin/SuperAdminSidebar.jsx";
import SuperAdminHeader from "../../../components/superadmin/SuperAdminHeader.jsx";
import { confirmLogout } from "../../../utils/confirmLogout.js";

import "../../admin/shared/AdminLayout.css";
import "./SuperAdminLayout.css";

const DEFAULT_PROFILE_IMAGE = "/images/temporaryimg.png";

/* =====================================================
   PROFILE IMAGE
===================================================== */

function resolveProfileImage(imagePath) {
  if (!imagePath) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:") ||
    imagePath.startsWith("/images/")
  ) {
    return imagePath;
  }

  let fixedPath = imagePath;

  if (fixedPath.startsWith("/api/uploads/profile-images/")) {
    fixedPath = fixedPath.replace(
      "/api/uploads/profile-images/",
      "/uploads/profile-images/",
    );
  }

  if (!fixedPath.startsWith("/")) {
    fixedPath = `/${fixedPath}`;
  }

  const serverOrigin = API_BASE.replace(/\/api\/?$/, "");

  return `${serverOrigin}${fixedPath}`;
}

/* =====================================================
   SUPER ADMIN LAYOUT
===================================================== */

export default function SuperAdminLayout({ children }) {
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  /* ===================================================
     SIDEBAR STATE
  =================================================== */

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("superAdminSidebarCollapsed") === "true";
  });

  /* ===================================================
     USER INFORMATION
  =================================================== */

  const avatarSrc = resolveProfileImage(
    user?.profileImage || user?.profile_image || user?.avatar || "",
  );

  const displayUsername = String(
    user?.displayName ||
      user?.display_name ||
      user?.name ||
      user?.fullName ||
      user?.full_name ||
      user?.username ||
      "Super Admin",
  ).replace(/^@+/, "");

  /* ===================================================
     SIDEBAR TOGGLE
  =================================================== */

  const toggleSidebar = () => {
    setSidebarCollapsed((currentValue) => {
      const newValue = !currentValue;

      localStorage.setItem("superAdminSidebarCollapsed", String(newValue));

      return newValue;
    });
  };

  /* ===================================================
     LOGOUT
  =================================================== */

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;

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
      className={`admin-layout superadmin-layout ${
        sidebarCollapsed ? "superadmin-sidebar-collapsed" : ""
      }`}
    >
      <SuperAdminSidebar
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebar={toggleSidebar}
        onLogout={handleLogout}
      />

      <main className="admin-main">
        <SuperAdminHeader
          displayUsername={displayUsername}
          avatarSrc={avatarSrc}
          onLogout={handleLogout}
        />

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
