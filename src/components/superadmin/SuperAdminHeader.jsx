import SystemPageSearch from "../SystemPageSearch.jsx";

import RoleNotificationMenu from "../rolenotif/RoleNotificationMenu";

import HeaderProfileChip from "../HeaderProfileChip";

import "./SuperAdminHeader.css";

export default function SuperAdminHeader({
  displayUsername,
  avatarSrc,
  onLogout,
}) {
  return (
    <header className="admin-header">
      <SystemPageSearch role="super_admin" />

      <div className="admin-header-actions">
        <RoleNotificationMenu role="superAdmin" />

        <HeaderProfileChip
          username={displayUsername}
          accountLabel="Super admin account"
          avatarSrc={avatarSrc}
          profilePath="/super-admin/profile"
          menuItems={[
            {
              label: "Profile",
              path: "/super-admin/profile",
              icon: "user",
            },
            {
              label: "Settings",
              path: "/super-admin/settings",
              icon: "settings",
            },
          ]}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
