import { useMemo, useState } from "react";
import {
  FiCheck,
  FiEye,
  FiEyeOff,
  FiInfo,
  FiLock,
  FiShield,
  FiX,
} from "react-icons/fi";

import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "../../../config.js";
import "./Settings.css";

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getAdminAccount(user) {
  return {
    name:
      user?.displayName ||
      user?.display_name ||
      user?.fullName ||
      user?.full_name ||
      user?.name ||
      localStorage.getItem("username") ||
      "Administrator",

    email: user?.email || localStorage.getItem("user_email") || "",

    role: user?.role || localStorage.getItem("user_role") || "Administrator",
  };
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();

  const adminAccount = useMemo(() => getAdminAccount(user), [user]);

  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);

  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [passwordNotice, setPasswordNotice] = useState({
    type: "",
    message: "",
  });

  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const updatePasswordField = (fieldName) => (event) => {
    setPasswordNotice({
      type: "",
      message: "",
    });

    setPasswordForm((currentForm) => ({
      ...currentForm,
      [fieldName]: event.target.value,
    }));
  };

  const togglePasswordVisibility = (fieldName) => {
    setVisiblePasswords((currentVisibility) => ({
      ...currentVisibility,
      [fieldName]: !currentVisibility[fieldName],
    }));
  };

  const passwordChecks = {
    length: passwordForm.newPassword.length >= 12,
    uppercase: /[A-Z]/.test(passwordForm.newPassword),
    lowercase: /[a-z]/.test(passwordForm.newPassword),
    number: /\d/.test(passwordForm.newPassword),
    symbol: /[^A-Za-z0-9]/.test(passwordForm.newPassword),
  };

  const passwordIsStrong = Object.values(passwordChecks).every(Boolean);

  const confirmPasswordHasValue = passwordForm.confirmPassword.length > 0;

  const passwordsMatch =
    confirmPasswordHasValue &&
    passwordForm.newPassword === passwordForm.confirmPassword;

  const clearPasswordForm = () => {
    setPasswordForm(initialPasswordForm);

    setVisiblePasswords({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });

    setPasswordNotice({
      type: "",
      message: "",
    });
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    setPasswordNotice({
      type: "",
      message: "",
    });

    if (!passwordForm.currentPassword.trim()) {
      setPasswordNotice({
        type: "error",
        message: "Enter your current password first.",
      });

      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordNotice({
        type: "error",
        message: "Enter your new password.",
      });

      return;
    }

    if (!passwordIsStrong) {
      setPasswordNotice({
        type: "error",
        message: "Your new password does not meet all password requirements.",
      });

      return;
    }

    if (!passwordsMatch) {
      setPasswordNotice({
        type: "error",
        message: "The new password and confirmation do not match.",
      });

      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordNotice({
        type: "error",
        message:
          "Your new password must be different from your current password.",
      });

      return;
    }

    setIsSubmittingPassword(true);

    try {
      const token =
        localStorage.getItem("puffy-token") || localStorage.getItem("token");

      console.log("Password request URL:", `${API_BASE}/users/change-password`);

      const response = await fetch(`${API_BASE}/users/change-password`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",

          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },

        credentials: "include",

        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to change password. Server returned ${response.status}.`,
        );
      }

      updateUser({ ...user, mustChangePassword: false, must_change_password: 0 });
      setPasswordForm(initialPasswordForm);

      setVisiblePasswords({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });

      setPasswordNotice({
        type: "success",
        message:
          data.message ||
          "Your administrator password was changed successfully.",
      });
    } catch (error) {
      console.error("Change password error:", error);

      setPasswordNotice({
        type: "error",
        message:
          error.message || "Something went wrong while changing your password.",
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const requirements = [
    {
      id: "length",
      label: "At least 12 characters",
      met: passwordChecks.length,
    },
    {
      id: "uppercase",
      label: "One uppercase letter",
      met: passwordChecks.uppercase,
    },
    {
      id: "lowercase",
      label: "One lowercase letter",
      met: passwordChecks.lowercase,
    },
    {
      id: "number",
      label: "One number",
      met: passwordChecks.number,
    },
    {
      id: "symbol",
      label: "One special character",
      met: passwordChecks.symbol,
    },
  ];

  return (
    <div className="admin-settings-page">
      <section className="admin-settings-heading">
        <div>
          <span className="admin-settings-eyebrow">Account security</span>

          <h1>Admin Settings</h1>

          <p>Manage your password and protect your administrator account.</p>
        </div>
      </section>

      <section
        className="admin-password-settings-section"
        aria-label="Administrator account settings"
      >
        <div className="admin-password-settings-card">
          <header className="admin-password-card-header">
            <span className="admin-password-card-icon" aria-hidden="true">
              <FiLock />
            </span>

            <div>
              <span className="admin-password-card-eyebrow">
                Security credentials
              </span>

              <h2>Change Password</h2>

              <p>
                Create a secure password that is not used for another account.
              </p>
            </div>
          </header>

          <div className="admin-account-summary">
            <span className="admin-account-summary-icon" aria-hidden="true">
              <FiShield />
            </span>

            <div>
              <span>{adminAccount.role} account</span>

              <strong>{adminAccount.name}</strong>

              {adminAccount.email && <small>{adminAccount.email}</small>}
            </div>
          </div>

          <form
            className="admin-password-settings-form"
            onSubmit={handlePasswordChange}
          >
            <PasswordField
              id="admin-current-password"
              label="Current Password"
              placeholder="Enter your current password"
              value={passwordForm.currentPassword}
              visible={visiblePasswords.currentPassword}
              autoComplete="current-password"
              onChange={updatePasswordField("currentPassword")}
              onToggle={() => togglePasswordVisibility("currentPassword")}
            />

            <div className="admin-password-form-divider" />

            <PasswordField
              id="admin-new-password"
              label="New Password"
              placeholder="Create a new password"
              value={passwordForm.newPassword}
              visible={visiblePasswords.newPassword}
              autoComplete="new-password"
              onChange={updatePasswordField("newPassword")}
              onToggle={() => togglePasswordVisibility("newPassword")}
            />

            <div
              className="admin-password-requirements"
              aria-label="Password requirements"
            >
              <div className="admin-password-requirements-heading">
                <FiShield aria-hidden="true" />

                <span>Password requirements</span>
              </div>

              <div className="admin-password-requirements-grid">
                {requirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className={
                      requirement.met
                        ? "admin-password-requirement met"
                        : "admin-password-requirement"
                    }
                  >
                    <span aria-hidden="true">
                      {requirement.met ? <FiCheck /> : <FiX />}
                    </span>

                    <strong>{requirement.label}</strong>
                  </div>
                ))}
              </div>
            </div>

            <PasswordField
              id="admin-confirm-password"
              label="Confirm New Password"
              placeholder="Re-enter your new password"
              value={passwordForm.confirmPassword}
              visible={visiblePasswords.confirmPassword}
              autoComplete="new-password"
              invalid={confirmPasswordHasValue && !passwordsMatch}
              onChange={updatePasswordField("confirmPassword")}
              onToggle={() => togglePasswordVisibility("confirmPassword")}
            />

            {confirmPasswordHasValue && (
              <div
                className={
                  passwordsMatch
                    ? "admin-password-match-message success"
                    : "admin-password-match-message error"
                }
              >
                {passwordsMatch ? (
                  <FiCheck aria-hidden="true" />
                ) : (
                  <FiX aria-hidden="true" />
                )}

                <span>
                  {passwordsMatch
                    ? "Passwords match."
                    : "Passwords do not match."}
                </span>
              </div>
            )}

            {passwordNotice.message && (
              <div
                className={`admin-password-notice ${passwordNotice.type}`}
                role={passwordNotice.type === "error" ? "alert" : "status"}
              >
                {passwordNotice.type === "success" ? (
                  <FiCheck aria-hidden="true" />
                ) : (
                  <FiInfo aria-hidden="true" />
                )}

                <span>{passwordNotice.message}</span>
              </div>
            )}

            <div className="admin-password-form-actions">
              <button
                type="button"
                className="admin-password-clear-button"
                onClick={clearPasswordForm}
                disabled={isSubmittingPassword}
              >
                Clear
              </button>

              <button
                type="submit"
                className="admin-password-save-button"
                disabled={isSubmittingPassword}
              >
                {isSubmittingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        <aside className="admin-password-security-note">
          <span className="admin-security-note-icon" aria-hidden="true">
            <FiInfo />
          </span>

          <div>
            <strong>Administrator security reminder</strong>

            <p>
              Never share your administrator credentials. Sign out after
              managing the system on shared or public devices.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  visible,
  autoComplete,
  invalid = false,
  onChange,
  onToggle,
}) {
  return (
    <div className="admin-password-field-group">
      <label htmlFor={id}>{label}</label>

      <div
        className={`admin-password-input-wrapper ${invalid ? "has-error" : ""}`}
      >
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />

        <button
          type="button"
          className="admin-password-visibility-button"
          onClick={onToggle}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <FiEyeOff aria-hidden="true" />
          ) : (
            <FiEye aria-hidden="true" />
          )}

          <span>{visible ? "Hide" : "Show"}</span>
        </button>
      </div>
    </div>
  );
}
