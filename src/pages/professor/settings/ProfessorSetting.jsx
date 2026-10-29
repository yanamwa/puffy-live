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
import { useAuth } from "../../../context/AuthContext.jsx";
import { API_BASE } from "../../../config.js";
import "./ProfessorSetting.css";

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getProfessorAccount(user) {
  return {
    name:
      user?.displayName ||
      user?.display_name ||
      user?.fullName ||
      user?.full_name ||
      user?.name ||
      localStorage.getItem("username") ||
      "Professor",

    email: user?.email || localStorage.getItem("user_email") || "",
  };
}

export default function ProfessorSetting() {
  const { user } = useAuth();

  const professorAccount = useMemo(() => getProfessorAccount(user), [user]);

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

    if (!professorAccount.email) {
      setPasswordNotice({
        type: "error",
        message: "Your account email was not found. Please log in again.",
      });

      return;
    }

    setIsSubmittingPassword(true);

    try {
      const token =
        localStorage.getItem("puffy-token") || localStorage.getItem("token");

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
          email: professorAccount.email,

          currentPassword: passwordForm.currentPassword,

          newPassword: passwordForm.newPassword,

          role: "professor",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to change your password.");
      }

      setPasswordForm(initialPasswordForm);

      setVisiblePasswords({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });

      setPasswordNotice({
        type: "success",
        message: data.message || "Your password was changed successfully.",
      });
    } catch (error) {
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
    <div className="professor-settings-page">
      <section className="professor-settings-heading professor-section-heading">
        <div>
          <span className="professor-settings-eyebrow">Account security</span>

          <h1>Professor Settings</h1>

          <p>Manage your password and keep your faculty account secure.</p>
        </div>
      </section>

      <section
        className="professor-password-settings-section"
        aria-label="Professor account settings"
      >
        <div className="professor-password-settings-card">
          <header className="professor-password-card-header">
            <span className="professor-password-card-icon" aria-hidden="true">
              <FiLock />
            </span>

            <div>
              <span className="professor-password-card-eyebrow">
                Security credentials
              </span>

              <h2>Change Password</h2>

              <p>
                Use a strong password that you do not use for another account.
              </p>
            </div>
          </header>

          <div className="professor-account-summary">
            <span className="professor-account-summary-icon" aria-hidden="true">
              <FiShield />
            </span>

            <div>
              <span>Professor account</span>

              <strong>{professorAccount.name}</strong>

              {professorAccount.email && (
                <small>{professorAccount.email}</small>
              )}
            </div>
          </div>

          <form
            className="professor-password-settings-form"
            onSubmit={handlePasswordChange}
          >
            <PasswordField
              id="professor-current-password"
              label="Current Password"
              placeholder="Enter your current password"
              value={passwordForm.currentPassword}
              visible={visiblePasswords.currentPassword}
              autoComplete="current-password"
              onChange={updatePasswordField("currentPassword")}
              onToggle={() => togglePasswordVisibility("currentPassword")}
            />

            <div className="professor-password-form-divider" />

            <PasswordField
              id="professor-new-password"
              label="New Password"
              placeholder="Create a new password"
              value={passwordForm.newPassword}
              visible={visiblePasswords.newPassword}
              autoComplete="new-password"
              onChange={updatePasswordField("newPassword")}
              onToggle={() => togglePasswordVisibility("newPassword")}
            />

            <div
              className="professor-password-requirements"
              aria-label="Password requirements"
            >
              <div className="professor-password-requirements-heading">
                <FiShield aria-hidden="true" />

                <span>Password requirements</span>
              </div>

              <div className="professor-password-requirements-grid">
                {requirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className={
                      requirement.met
                        ? "professor-password-requirement met"
                        : "professor-password-requirement"
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
              id="professor-confirm-password"
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
                    ? "professor-password-match-message success"
                    : "professor-password-match-message error"
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
                className={`professor-password-notice ${passwordNotice.type}`}
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

            <div className="professor-password-form-actions">
              <button
                type="button"
                className="professor-password-clear-button"
                onClick={clearPasswordForm}
                disabled={isSubmittingPassword}
              >
                Clear
              </button>

              <button
                type="submit"
                className="professor-password-save-button"
                disabled={isSubmittingPassword}
              >
                {isSubmittingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        <aside className="professor-password-security-note">
          <span className="professor-security-note-icon" aria-hidden="true">
            <FiInfo />
          </span>

          <div>
            <strong>Security reminder</strong>

            <p>
              Never share your password with students or other faculty members.
              Sign out from devices you no longer use.
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
    <div className="professor-password-field-group">
      <label htmlFor={id}>{label}</label>

      <div
        className={`professor-password-input-wrapper ${
          invalid ? "has-error" : ""
        }`}
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
          className="professor-password-visibility-button"
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
