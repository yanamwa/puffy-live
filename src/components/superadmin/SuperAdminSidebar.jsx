import ResponsiveSidebar from "../ResponsiveSidebar";
import { NavLink, useLocation } from "react-router-dom";

import {
  FiCalendar,
  FiActivity,
  FiBell,
  FiBook,
  FiDownload,
  FiGrid,
  FiLogOut,
  FiSettings,
  FiShield,
  FiSun,
  FiUsers,
} from "react-icons/fi";

import "./SuperAdminSidebar.css";

const mainMenuItems = [
  {
    label: "Dashboard",
    path: "/super-admin/dashboard",
    icon: FiGrid,
  },
  {
    label: "User Management",
    path: "/super-admin/users",
    icon: FiUsers,
  },
  {
    label: "Course Management",
    path: "/super-admin/courses",
    icon: FiBook,
  },
  {
    label: "Modes Management",
    path: "/super-admin/modes",
    icon: FiSun,
  },
  {
    label: "Academic Calendar",
    path: "/super-admin/academic-calendar",
    icon: FiCalendar,
  },
  {
    label: "System Analytics",
    path: "/super-admin/analytics",
    icon: FiActivity,
  },
  {
    label: "Announcements & Notifications",
    path: "/super-admin/announcements",
    icon: FiBell,
  },
  {
    label: "Audit Logs",
    path: "/super-admin/audit-logs",
    icon: FiShield,
  },
  {
    label: "Backup and Restore",
    path: "/super-admin/backup",
    icon: FiDownload,
  },
];

const otherMenuItems = [
  {
    label: "System Settings",
    path: "/super-admin/settings",
    icon: FiSettings,
  },
  {
    label: "Security and Permissions",
    path: "/super-admin/security",
    icon: FiShield,
  },
];

export default function SuperAdminSidebar({
  sidebarCollapsed,
  toggleSidebar,
  onLogout,
}) {
  const { pathname } = useLocation();
  const isDashboardRoot = pathname.replace(/\/+$/, "") === "/super-admin";

  const renderMenuItem = (item) => {
    const Icon = item.icon;
    const path =
      item.path === "/super-admin/dashboard" && isDashboardRoot
        ? "/super-admin"
        : item.path;

    return (
      <NavLink
        key={item.path}
        to={path}
        end={path === "/super-admin"}
        className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        title={sidebarCollapsed ? item.label : undefined}
      >
        <Icon className="sidebar-icon" aria-hidden="true" />

        <span className="sidebar-nav-label">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <ResponsiveSidebar className="admin-sidebar" logoSrc="/images/superadmin.png">
      <div
        className="sidebar-brand"
        style={{
          height: 140,
          minHeight: 140,
          padding: sidebarCollapsed ? "10px 5px" : "10px 4px",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          className="superadmin-logo-button"
          style={{
            width: "100%",
            maxWidth: sidebarCollapsed ? 65 : 280,
            height: sidebarCollapsed ? 65 : 120,
            flex: sidebarCollapsed ? "0 1 65px" : "0 1 280px",
            borderRadius: 0,
          }}
          onClick={toggleSidebar}
          aria-label={
            sidebarCollapsed
              ? "Expand Super Admin sidebar"
              : "Collapse Super Admin sidebar"
          }
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <picture className="role-sidebar-logo-picture">
            <source media="(max-width: 820px)" srcSet="/images/superadmin.png" />
            <img
              src="/images/superadmin.png"
              className="role-sidebar-logo"
              alt="PuffyBrain Super Admin"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </picture>
        </button>
      </div>

      <nav className="sidebar-menu" aria-label="Super Admin navigation">
        <div className="menu-section">{mainMenuItems.map(renderMenuItem)}</div>

        <div className="menu-section">{otherMenuItems.map(renderMenuItem)}</div>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          onClick={onLogout}
          className="logout-btn"
          title={sidebarCollapsed ? "Logout" : undefined}
        >
          <FiLogOut aria-hidden="true" />

          <span className="sidebar-logout-label">Logout</span>
        </button>
      </div>
    </ResponsiveSidebar>
  );
}
