import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiRepeat } from "react-icons/fi";
import Swal from "sweetalert2";
import { getHomePathForRole } from "../utils/roles.js";
import "./HeaderProfileChip.css";

function MenuIcon({ name }) {
  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l-2-.6a7 7 0 0 0-.7-1.6l1-1.8-2.1-2.1-1.8 1a7 7 0 0 0-1.6-.7L11.5 3h-3l-.6 2a7 7 0 0 0-1.6.7l-1.8-1-2.1 2.1 1 1.8a7 7 0 0 0-.7 1.6L1 10.5v3l2 .6a7 7 0 0 0 .7 1.6l-1 1.8 2.1 2.1 1.8-1a7 7 0 0 0 1.6.7l.6 2h3l.6-2a7 7 0 0 0 1.6-.7l1.8 1 2.1-2.1-1-1.8a7 7 0 0 0 .7-1.6Z" />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 5H5v14h5" />
        <path d="m14 8 4 4-4 4" />
        <path d="M18 12H9" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" />
    </svg>
  );
}

export default function HeaderProfileChip({
  username,
  accountLabel,
  avatarSrc = "/images/temporaryimg.png",
  profilePath,
  menuItems = [],
  onLogout,
  onMenuOpen,
  switchToRole,
  onSwitchRole,
}) {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const handle = username?.replace(/^@+/, "") || "Professor";

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleRoleSwitch = async () => {
    setSwitchingRole(true);
    try {
      const user = await onSwitchRole(switchToRole);
      setOpen(false);
      navigate(getHomePathForRole(user.role), { replace: true });
    } catch (error) {
      setOpen(false);
      void Swal.fire({
        icon: "error",
        title: "Could not switch roles",
        text: error.message,
      });
    } finally {
      setSwitchingRole(false);
    }
  };

  useEffect(() => {
    const closeMenu = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const closeWithEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  return (
    <div className="header-profile-wrapper" ref={wrapperRef}>
      <div className="header-profile-chip">
        <button
          type="button"
          className="header-profile-main-button"
          onClick={() => profilePath && goTo(profilePath)}
          aria-label={`Open ${handle} profile`}
        >
          <span className="header-profile-avatar">
            <img src={avatarSrc} alt="" />
            <span className="header-profile-status-dot" />
          </span>

          <span className="header-profile-user-info">
            <strong>{handle}</strong>
            <small>{accountLabel}</small>
          </span>
        </button>

        <button
          type="button"
          className={`header-profile-dropdown-button ${open ? "open" : ""}`}
          aria-label={open ? "Close profile menu" : "Open profile menu"}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={(event) => {
            event.stopPropagation();
            if (!open) onMenuOpen?.();
            setOpen((current) => !current);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="header-profile-dropdown-menu"
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="header-profile-dropdown-header">
            <span className="header-profile-avatar">
              <img src={avatarSrc} alt="" />
            </span>

            <div>
              <strong>{handle}</strong>
              <span>{accountLabel}</span>
            </div>
          </div>

          <div className="header-profile-dropdown-divider" />

          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => goTo(item.path)}
            >
              <MenuIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}

          {switchToRole && onSwitchRole && (
            <button
              type="button"
              role="menuitem"
              onClick={handleRoleSwitch}
              disabled={switchingRole}
            >
              <FiRepeat aria-hidden="true" />
              <span>
                {switchingRole
                  ? "Switching…"
                  : switchToRole === "admin"
                    ? "Switch to Admin"
                    : "Switch to Professor"}
              </span>
            </button>
          )}

          {(menuItems.length > 0 || (switchToRole && onSwitchRole)) && (
            <div className="header-profile-dropdown-divider" />
          )}

          <button
            type="button"
            role="menuitem"
            className="header-profile-logout-option"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
          >
            <MenuIcon name="logout" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
