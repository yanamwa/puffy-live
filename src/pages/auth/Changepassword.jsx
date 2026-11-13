import styles from "./login.module.css";
import { useState } from "react";
import Swal from "sweetalert2";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { API_BASE } from "../../config.js";

const resetFeedbackClasses = {
  container: "reset-password-feedback-overlay",
  popup: "reset-password-feedback-popup",
  title: "reset-password-feedback-title",
  image: "reset-password-feedback-image",
  htmlContainer: "reset-password-feedback-message",
  confirmButton: "reset-password-feedback-button",
};

function showResetPasswordFeedback(title, text, success = false) {
  return Swal.fire({
    title,
    text,
    imageUrl: success ? "/images/complete.png" : "/images/mismatch.png",
    imageWidth: 300,
    imageAlt: success
      ? "Password updated successfully"
      : "Password update needs attention",
    customClass: resetFeedbackClasses,
    buttonsStyling: false,
    confirmButtonText: "OK",
  });
}

function ChangePassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* PASSWORD RULES */
  const hasLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const isPasswordValid =
    hasLength && hasUpper && hasLower && hasNumber && hasSymbol;

  const doPasswordsMatch = password === confirmPassword;

  /* PASSWORD STRENGTH */
  const getPasswordStrength = (password) => {
    let strength = 0;

    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return "weak";
    if (strength === 3 || strength === 4) return "medium";
    return "strong";
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      showResetPasswordFeedback(
        "Invalid Link",
        "Please request a new password reset link.",
      );
      return;
    }

    if (!isPasswordValid) {
      showResetPasswordFeedback(
        "Weak Password",
        "Password must contain 12 characters, uppercase, lowercase, number, and symbol.",
      );
      return;
    }

    if (!confirmPassword) {
      showResetPasswordFeedback(
        "Missing Field",
        "Please confirm your password.",
      );
      return;
    }

    if (!doPasswordsMatch) {
      showResetPasswordFeedback(
        "Password Mismatch",
        "Passwords do not match.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        await showResetPasswordFeedback(
          "Error",
          data.message || "This password reset link is invalid or has expired.",
        );
        return;
      }

      await showResetPasswordFeedback(
        "Password Updated",
        "Your password has been updated.",
        true,
      );

      navigate("/login");
    } catch {
      await showResetPasswordFeedback(
        "Server Error",
        "Please try again later.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.container}>
        <div className={styles.background}></div>

        <div className={styles.signupContainer}>
          <div className={styles.signupCard}>
            <h2>Change Password</h2>

            <label>New Password</label>

            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className={styles.toggleEye}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={isSubmitting}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <FiEyeOff aria-hidden="true" />
                ) : (
                  <FiEye aria-hidden="true" />
                )}
              </button>
            </div>

            {/* PASSWORD CHECKLIST */}

            {password.length > 0 && (
              <div className={styles.passwordChecklist}>
                <p className={hasLength ? styles.valid : styles.invalid}>
                  {hasLength ? "✓" : "✗"} At least 12 characters
                </p>

                <p className={hasUpper ? styles.valid : styles.invalid}>
                  {hasUpper ? "✓" : "✗"} Has uppercase letter
                </p>

                <p className={hasLower ? styles.valid : styles.invalid}>
                  {hasLower ? "✓" : "✗"} Has lowercase letter
                </p>

                <p className={hasNumber ? styles.valid : styles.invalid}>
                  {hasNumber ? "✓" : "✗"} Has number
                </p>

                <p className={hasSymbol ? styles.valid : styles.invalid}>
                  {hasSymbol ? "✓" : "✗"} Has special character (@#$ etc.)
                </p>
              </div>
            )}

            {/* PASSWORD STRENGTH */}
            {password.length > 0 && (
              <div
                className={`${styles.validationMessage} ${
                  passwordStrength === "strong"
                    ? styles.success
                    : passwordStrength === "medium"
                      ? styles.warning
                      : styles.error
                }`}
              >
                {passwordStrength === "weak" && "Weak password"}
                {passwordStrength === "medium" && "Medium strength password"}
                {passwordStrength === "strong" && "Strong password"}
              </div>
            )}

            <div className={styles.passwordDivider}></div>
            <label>Confirm New Password</label>
            <div className={styles.passwordWrapper}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-type new password"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button
                type="button"
                className={styles.toggleEye}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                aria-pressed={showConfirmPassword}
                disabled={isSubmitting}
                onClick={() => setShowConfirmPassword((current) => !current)}
              >
                {showConfirmPassword ? (
                  <FiEyeOff aria-hidden="true" />
                ) : (
                  <FiEye aria-hidden="true" />
                )}
              </button>
            </div>

            {/* PASSWORD MATCH CHECK */}

            {confirmPassword.length > 0 && (
              <div
                className={`${styles.validationMessage} ${
                  doPasswordsMatch ? styles.success : styles.error
                }`}
              >
                {doPasswordsMatch
                  ? "✓ Passwords match"
                  : "Passwords do not match"}
              </div>
            )}

            <button
              type="button"
              className={styles.loginBtn}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ChangePassword;
