import { useEffect, useState } from "react";

import Swal from "sweetalert2";
import { API_BASE } from "../../../config.js";

import {
  FiCheck,
  FiMail,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiSliders,
  FiTool,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

import "./SuperAdminSystemSettings.css";

/* =====================================================
   DEFAULT SETTINGS
===================================================== */

const defaultSettings = {
  academicYear: "",
  semester: "1st Semester",

  maintenanceMode: false,

  requirePasswordChange: true,
  professorApproval: true,

  enrollmentApproval: true,
  enrollmentAcceptedEmail: true,
  enrollmentDeclinedEmail: true,
  enrollmentSystemNotification: true,

  professorApprovalNotification: true,
};

function getEditableSettings(settings) {
  return Object.fromEntries(
    Object.entries(defaultSettings).map(([key, fallback]) => [
      key,
      settings[key] ?? fallback,
    ]),
  );
}

/* =====================================================
   TOGGLE COMPONENT
===================================================== */

function SettingToggle({ checked, onChange, label, description }) {
  return (
    <div className="super-setting-row">
      <div className="super-setting-row-text">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className={`super-setting-toggle ${checked ? "is-active" : ""}`}
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

/* =====================================================
   SETTINGS SECTION
===================================================== */

function SettingsSection({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}) {
  return (
    <section className="super-settings-card">
      <header className="super-settings-card-header">
        <span className="super-settings-card-icon">
          <Icon aria-hidden="true" />
        </span>

        <div>
          <span className="super-settings-card-eyebrow">{eyebrow}</span>

          <h2>{title}</h2>

          <p>{description}</p>
        </div>
      </header>

      <div className="super-settings-card-body">{children}</div>
    </section>
  );
}

function getAuthToken() {
  return (
    localStorage.getItem("puffy-token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}
/* =====================================================
   SYSTEM SETTINGS PAGE
===================================================== */

export default function SuperAdminSystemSettings() {
  const [settings, setSettings] = useState(defaultSettings);

  const [savedSettings, setSavedSettings] = useState(defaultSettings);

  const [notice, setNotice] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  /* =====================================================
        LOAD SETTINGS FROM DATABASE
      ===================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const token = getAuthToken();

      if (!token) {
        setLoading(false);

        Swal.fire({
          icon: "error",
          title: "Authentication Required",
          text: "Please log in again to access System Settings.",
        });

        return;
      }

      try {
        const response = await fetch(`${API_BASE}/system-settings`, {
          method: "GET",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !data.settings) {
          throw new Error(data.message || "Failed to load system settings.");
        }

        if (cancelled) {
          return;
        }

        const loadedSettings = getEditableSettings(data.settings);

        setSettings(loadedSettings);
        setSavedSettings(loadedSettings);
      } catch (error) {
        console.error("Load system settings error:", error);

        if (!cancelled) {
          Swal.fire({
            icon: "error",
            title: "Unable to Load Settings",
            text: error?.message || "System settings could not be loaded.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =====================================================
     UPDATE FIELD
  ===================================================== */

  const updateSetting = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));

    setNotice("");
  };

  /* =====================================================
     CHECK FOR CHANGES
  ===================================================== */

  const changes = Object.fromEntries(
    Object.entries(settings).filter(([key, value]) => value !== savedSettings[key]),
  );
  const hasChanges = Object.keys(changes).length > 0;

  /* =====================================================
     SAVE
  ===================================================== */

  const handleSave = async () => {
    if (!hasChanges || saving || loading) {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      await Swal.fire({
        icon: "error",
        title: "Authentication Required",
        text: "Please log in again before saving System Settings.",
      });

      return;
    }

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Save System Settings?",
      text: changes.maintenanceMode === true
        ? "Students, professors, and admins will lose access until a Super Admin turns maintenance mode off."
        : "These changes will update the PuffyBrain system configuration.",
      showCancelButton: true,
      confirmButtonText: "Save Changes",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      setSaving(true);
      setNotice("");

      Swal.fire({
        title: "Saving Settings",
        text: "Updating PuffyBrain system settings...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const response = await fetch(`${API_BASE}/system-settings`, {
        method: "PUT",
        credentials: "include",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(changes),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save system settings.");
      }

      const updatedSettings = getEditableSettings(data.settings || settings);

      setSettings(updatedSettings);
      setSavedSettings(updatedSettings);

      window.dispatchEvent(new Event("puffy-system-settings-updated"));
      setNotice("System settings were saved successfully.");

      await Swal.fire({
        icon: "success",
        title: "Settings Saved",
        text: data.message || "System settings were updated successfully.",
        confirmButtonText: "OK",
      });
    } catch (error) {
      console.error("Save system settings error:", error);

      await Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: error?.message || "System settings could not be saved.",
        confirmButtonText: "OK",
      });
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     RESET
  ===================================================== */

  const handleReset = async () => {
    if (!hasChanges || saving || loading) {
      return;
    }

    const result = await Swal.fire({
      icon: "question",
      title: "Reset Changes?",
      text: "Your unsaved changes will be returned to the last saved settings.",
      showCancelButton: true,
      confirmButtonText: "Reset Changes",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    setSettings(savedSettings);
    setNotice("");
  };

  return (
    <div className="admin-page super-system-settings-page">
      {/* ===============================================
          PAGE HEADER
      =============================================== */}

      <section className="super-system-settings-heading super-page-heading">
        <div>
          <span className="super-system-settings-eyebrow">
            <FiSettings aria-hidden="true" />
            Platform configuration
          </span>

          <h1>System Settings</h1>

          <p>
            Manage academic configuration, account policies, enrollment, and
            notifications.
          </p>
        </div>

        <div className="super-system-settings-actions">
          <button
            type="button"
            className="super-settings-reset-button"
            onClick={handleReset}
            disabled={!hasChanges || loading || saving}
          >
            <FiRefreshCw aria-hidden="true" />
            Reset
          </button>

          <button
            type="button"
            className="super-settings-save-button"
            onClick={handleSave}
            disabled={!hasChanges || loading || saving}
          >
            <FiSave aria-hidden="true" />

            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* ===============================================
          NOTICE
      =============================================== */}

      {notice && (
        <div className="super-settings-notice" role="status">
          <FiCheck aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {/* ===============================================
          GENERAL SYSTEM SETTINGS
      =============================================== */}

      <SettingsSection
        icon={FiSliders}
        eyebrow="General"
        title="General System Settings"
        description="Set the default academic period for new classes and the current academic year for calendars."
      >
        <div className="super-settings-form-grid">
          <label className="super-settings-field">
            <span>Academic Year</span>

            <input
              type="text"
              value={settings.academicYear}
              onChange={(event) =>
                updateSetting("academicYear", event.target.value)
              }
            />
          </label>

          <label className="super-settings-field">
            <span>Semester</span>

            <select
              value={settings.semester}
              onChange={(event) =>
                updateSetting("semester", event.target.value)
              }
            >
              <option>1st Semester</option>
              <option>2nd Semester</option>
              <option>Summer</option>
            </select>
          </label>
        </div>
      </SettingsSection>

      {/* ===============================================
          ACCOUNT CONFIGURATION
      =============================================== */}

      <SettingsSection
        icon={FiUsers}
        eyebrow="Accounts"
        title="Account Configuration"
        description="Configure system-wide rules for newly created accounts and professor access."
      >
        <SettingToggle
          checked={settings.requirePasswordChange}
          onChange={(value) => updateSetting("requirePasswordChange", value)}
          label="Require Password Change on First Login"
          description="Require new accounts created with generated credentials to change their password before accessing other pages."
        />

        <SettingToggle
          checked={settings.professorApproval}
          onChange={(value) => updateSetting("professorApproval", value)}
          label="Require Professor Account Approval"
          description="Professor registration requests must be approved before the account receives full system access."
        />
      </SettingsSection>

      {/* ===============================================
          ENROLLMENT
      =============================================== */}

      <SettingsSection
        icon={FiUserCheck}
        eyebrow="Enrollment"
        title="Enrollment Configuration"
        description="Control how students request and receive access to courses."
      >
        <SettingToggle
          checked={settings.enrollmentApproval}
          onChange={(value) => updateSetting("enrollmentApproval", value)}
          label="Require Professor Approval for Enrollment"
          description="Student enrollment requests must be accepted by the professor before the course appears in My Courses."
        />

        <SettingToggle
          checked={settings.enrollmentSystemNotification}
          onChange={(value) =>
            updateSetting("enrollmentSystemNotification", value)
          }
          label="Enrollment System Notifications"
          description="Notify students inside PuffyBrain when their enrollment request is accepted or declined."
        />
      </SettingsSection>

      {/* ===============================================
          EMAIL AND NOTIFICATIONS
      =============================================== */}

      <SettingsSection
        icon={FiMail}
        eyebrow="Communication"
        title="Email & Notification Settings"
        description="Choose which important PuffyBrain events should generate notifications."
      >
        <SettingToggle
          checked={settings.enrollmentAcceptedEmail}
          onChange={(value) => updateSetting("enrollmentAcceptedEmail", value)}
          label="Enrollment Accepted Email"
          description="Email the student when enrollment is approved by a professor or automatically confirmed."
        />

        <SettingToggle
          checked={settings.enrollmentDeclinedEmail}
          onChange={(value) => updateSetting("enrollmentDeclinedEmail", value)}
          label="Enrollment Declined Email"
          description="Send an email to the student when an enrollment request is declined."
        />

        <SettingToggle
          checked={settings.professorApprovalNotification}
          onChange={(value) =>
            updateSetting("professorApprovalNotification", value)
          }
          label="Professor Approval Notifications"
          description="Generate notifications related to pending and completed professor account approvals."
        />
      </SettingsSection>

      {/* ===============================================
          SYSTEM MAINTENANCE
      =============================================== */}

      <SettingsSection
        icon={FiTool}
        eyebrow="Maintenance"
        title="System Maintenance"
        description="Temporarily pause access to PuffyBrain during maintenance."
      >
        <SettingToggle
          checked={settings.maintenanceMode}
          onChange={(value) => updateSetting("maintenanceMode", value)}
          label="Maintenance Mode"
          description="Show a maintenance screen and restrict access to Super Admins."
        />

        {settings.maintenanceMode && (
          <div className="super-settings-warning">
            <FiTool aria-hidden="true" />

            <div>
              <strong>Maintenance Mode selected</strong>

              <p>
                When saved, only Super Admins can access PuffyBrain.
              </p>
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
