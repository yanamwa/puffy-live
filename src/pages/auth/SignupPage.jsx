import PublicNavbar from "../../components/landing/PublicNavbar.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Swal from "sweetalert2";

import { API_BASE } from "../../config.js";
import styles from "./login.module.css";
import "./LoginFeedback.css";

function Signup() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentProof, setEmploymentProof] = useState(null);
  const [proofPreview, setProofPreview] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSigningUp, setIsSigningUp] = useState(false);

  const hasLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const isPasswordValid =
    hasLength && hasUpper && hasLower && hasNumber && hasSymbol;

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const showError = (title, text) => {
    Swal.fire({
      imageUrl: "/images/required.png",
      imageWidth: 270,
      imageHeight: 180,
      imageAlt: "Please complete the required signup information",
      customClass: {
        popup: "login-feedback-popup",
        container: "login-feedback-overlay",
      },
      confirmButtonText: "OK",
      title,
      text,
    });
  };

  const getPasswordStrength = (value) => {
    let strength = 0;

    if (value.length >= 12) strength += 1;
    if (/[A-Z]/.test(value)) strength += 1;
    if (/[a-z]/.test(value)) strength += 1;
    if (/[0-9]/.test(value)) strength += 1;
    if (/[^A-Za-z0-9]/.test(value)) strength += 1;

    if (strength <= 2) return "weak";
    if (strength <= 4) return "medium";

    return "strong";
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setDepartment("");
    setEmploymentProof(null);
    setProofPreview("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleProofUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setEmploymentProof(null);
      setProofPreview("");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      showError("Invalid File", "Please upload a JPG, PNG, or WEBP image.");

      event.target.value = "";
      return;
    }

    const maximumSize = 5 * 1024 * 1024;

    if (file.size > maximumSize) {
      showError(
        "File Too Large",
        "The uploaded ID photo must not exceed 5 MB.",
      );

      event.target.value = "";
      return;
    }

    setEmploymentProof(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const removeProofImage = () => {
    if (proofPreview) {
      URL.revokeObjectURL(proofPreview);
    }

    setEmploymentProof(null);
    setProofPreview("");
  };

  const handleSignup = async (event) => {
    event.preventDefault();

    if (isSigningUp) {
      return;
    }

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanDepartment = department.trim();

    if (!cleanFullName) {
      showError("Full Name Required", "Please enter your full name.");
      return;
    }

    if (!cleanEmail) {
      showError("Email Required", "Please enter your email.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      showError("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!cleanDepartment) {
      showError("Department Required", "Please select your department.");
      return;
    }

    if (!employmentProof) {
      showError(
        "ID Photo Required",
        "Please upload a clear photo of your faculty or employee ID.",
      );
      return;
    }

    if (!password) {
      showError("Password Required", "Please enter your password.");
      return;
    }

    if (!isPasswordValid) {
      showError(
        "Weak Password",
        "Password must meet all security requirements.",
      );
      return;
    }

    if (!confirmPassword) {
      showError("Confirm Password Required", "Please confirm your password.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Password Mismatch", "Passwords do not match.");
      return;
    }

    try {
      setIsSigningUp(true);

      const formData = new FormData();

      formData.append("name", cleanFullName);
      formData.append("email", cleanEmail);
      formData.append("password", password);
      formData.append("role", "professor");
      formData.append("department", cleanDepartment);
      formData.append("employmentProof", employmentProof);

      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({
        success: false,
        message: "Server returned an invalid response.",
      }));

      if (!response.ok || !data.success) {
        showError("Signup Failed", data.message || "Unable to create account.");
        return;
      }

      sessionStorage.setItem("otp_email", cleanEmail);

      const otpSecondsRemaining = Number(data.otpSecondsRemaining || 300);
      const otpExpiresAt = Date.now() + Math.max(0, otpSecondsRemaining) * 1000;

      sessionStorage.setItem("otp_expires_at", String(otpExpiresAt));

      await Swal.fire({
        imageUrl: "/images/success.png",
        imageWidth: 170,
        imageHeight: 170,
        title: "Verification Code Sent",
        text: "Please verify your email. After verification, the Super Admin will review your professor account and uploaded ID.",
        confirmButtonText: "Continue",
      });

      resetForm();

      navigate("/otp", {
        state: {
          email: cleanEmail,
          otpExpiresAt,
        },
      });
    } catch (error) {
      console.error("SIGNUP ERROR:", error);

      showError(
        "Server Error",
        "Cannot connect to the server. Make sure your backend is running.",
      );
    } finally {
      setIsSigningUp(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className={styles.wrapper}>
      <section className={styles.container}>
        <div className={styles.background} aria-hidden="true" />

        <PublicNavbar />

        <main className={styles.professorSignupContainer}>
          <form className={styles.professorSignupCard} onSubmit={handleSignup}>
            <div className={styles.professorSignupHeading}>
              <div>
                <h1>Create a Professor Account</h1>

                <p>Register your professor account for Super Admin review.</p>
              </div>
            </div>

            <div className={styles.professorSignupFormGrid}>
              <div className={styles.professorFormGroup}>
                <label htmlFor="professor-fullname">Full Name</label>

                <input
                  id="professor-fullname"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  disabled={isSigningUp}
                  autoComplete="name"
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>

              <div className={styles.professorFormGroup}>
                <label htmlFor="professor-email">Email Address</label>

                <input
                  id="professor-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  disabled={isSigningUp}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className={`${styles.professorFormGroup} ${styles.professorFullWidth}`}>
                <label htmlFor="department">Department</label>

                <select
                  id="department"
                  value={department}
                  disabled={isSigningUp}
                  onChange={(event) => setDepartment(event.target.value)}
                >
                  <option value="">Select your department</option>

                  <option value="Computer Science Department">
                    Computer Science Department
                  </option>

                  <option value="Information Technology Department">
                    Information Technology Department
                  </option>
                </select>
              </div>

              <div
                className={`${styles.professorFormGroup} ${styles.professorFullWidth}`}
              >
                <label htmlFor="employment-proof">
                  Upload Proof of Employment
                </label>

                <p className={styles.professorUploadDescription}>
                 Upload a clear photo or document proving your current employment with the school.
                 You may submit your faculty or employee ID, certificate of employment, or
                 other official employment documents.
                </p>

                <div className={styles.professorUploadArea}>
                  <input
                    id="employment-proof"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    disabled={isSigningUp}
                    className={styles.professorFileInput}
                    onChange={handleProofUpload}
                  />

                  <label
                    htmlFor="employment-proof"
                    className={styles.professorUploadButton}
                  >
                    <i className="fa-solid fa-image" />

                    <span style={{ color: "white" }}>
                      {employmentProof ? "Change ID Photo" : "Choose ID Photo"}
                    </span>
                  </label>

                  {employmentProof && (
                    <span className={styles.professorFileName}>
                      {employmentProof.name}
                    </span>
                  )}
                </div>

                {proofPreview && (
                  <div className={styles.professorProofPreview}>
                    <img
                      src={proofPreview}
                      alt="Uploaded faculty or employee ID preview"
                    />

                    <button
                      type="button"
                      disabled={isSigningUp}
                      onClick={removeProofImage}
                    >
                      <i className="fa-solid fa-trash" />
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.professorFormGroup}>
                <label htmlFor="professor-password">Password</label>

                <div className={styles.professorPasswordWrapper}>
                  <input
                    id="professor-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    disabled={isSigningUp}
                    autoComplete="new-password"
                    onChange={(event) => setPassword(event.target.value)}
                  />

                  <button
                    type="button"
                    className={styles.professorToggleEye}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    disabled={isSigningUp}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? (
                      <FiEyeOff aria-hidden="true" />
                    ) : (
                      <FiEye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.professorFormGroup}>
                <label htmlFor="confirm-password">Confirm Password</label>

                <div className={styles.professorPasswordWrapper}>
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    disabled={isSigningUp}
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />

                  <button
                    type="button"
                    className={styles.professorToggleEye}
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showConfirmPassword}
                    disabled={isSigningUp}
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                  >
                    {showConfirmPassword ? (
                      <FiEyeOff aria-hidden="true" />
                    ) : (
                      <FiEye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {password.length > 0 && (
                <div
                  className={`${styles.professorPasswordPanel} ${styles.professorFullWidth}`}
                >
                  <div className={styles.professorPasswordRules}>
                    <p className={hasLength ? styles.valid : styles.invalid}>
                      {hasLength ? "✓" : "×"} At least 12 characters
                    </p>

                    <p className={hasUpper ? styles.valid : styles.invalid}>
                      {hasUpper ? "✓" : "×"} One uppercase letter
                    </p>

                    <p className={hasLower ? styles.valid : styles.invalid}>
                      {hasLower ? "✓" : "×"} One lowercase letter
                    </p>

                    <p className={hasNumber ? styles.valid : styles.invalid}>
                      {hasNumber ? "✓" : "×"} One number
                    </p>

                    <p className={hasSymbol ? styles.valid : styles.invalid}>
                      {hasSymbol ? "✓" : "×"} One special character
                    </p>
                  </div>

                  <div
                    className={`${styles.professorStrengthMessage} ${
                      passwordStrength === "strong"
                        ? styles.success
                        : passwordStrength === "medium"
                          ? styles.warning
                          : styles.error
                    }`}
                  >
                    {passwordStrength === "weak" && "Weak password"}

                    {passwordStrength === "medium" &&
                      "Medium-strength password"}

                    {passwordStrength === "strong" && "Strong password"}
                  </div>
                </div>
              )}

              {confirmPassword.length > 0 && (
                <div
                  className={`${styles.professorMatchMessage} ${
                    passwordsMatch ? styles.success : styles.error
                  } ${styles.professorFullWidth}`}
                >
                  {passwordsMatch
                    ? "Passwords match"
                    : "Passwords do not match"}
                </div>
              )}
            </div>

            <div className={styles.professorSignupActions}>
              <button
                type="submit"
                className={styles.professorSignupButton}
                disabled={isSigningUp}
              >
                {isSigningUp ? "Registering..." : "Register Professor Account"}
              </button>

              <p>Professor accounts require Super Admin approval.</p>

              <p>
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </div>
          </form>
        </main>
      </section>
    </div>
  );
}

export default Signup;
