import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../../../context/AuthContext.jsx";
import { requiresStudentPasswordChange } from "../../../utils/passwordPolicy.js";

import StudentSidebar from "../../../components/students/StudentSidebar.jsx";
import StudentHeader from "../../../components/students/StudentHeader.jsx";
import JoinCourseModal from "../courses/JoinCourseModal.jsx";

import {
  enrollStudentInCourseAsync,
  findJoinableCourseByCodeAsync,
} from "../courses/studentCourseData.js";

import "./StudentSetting.css";

import { API_BASE as API_BASE_URL } from "../../../config.js";

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

export default function StudentSettings() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const passwordChangeRequired = requiresStudentPasswordChange(user);

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [courseCode, setCourseCode] = useState("");

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

  const closeJoinModal = () => {
    setJoinModalOpen(false);
    setCourseCode("");
  };

  const joinByCourseCode = async () => {
    const trimmedCode = courseCode.trim();

    if (!trimmedCode) {
      await Swal.fire({
        icon: "warning",
        title: "Enter Course Code",
        text: "Please enter the course code provided by your professor.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });

      return;
    }

    try {
      const course = await findJoinableCourseByCodeAsync(trimmedCode);

      if (!course) {
        await Swal.fire({
          icon: "error",
          title: "Course Not Found",
          text: "Course code not found. Please check the code from your professor.",
          confirmButtonText: "OK",
          confirmButtonColor: "#7FA8D6",
        });

        return;
      }

      await enrollStudentInCourseAsync(course);
      closeJoinModal();

      await Swal.fire({
        icon: "success",
        title: "Course Joined!",
        text: `You have successfully joined ${
          course.title ||
          course.courseName ||
          course.course_name ||
          course.name ||
          "the course"
        }.`,
        confirmButtonText: "Continue",
        confirmButtonColor: "#7FA8D6",
      });

      const joinedCourseId =
        course.id ||
        course.courseId ||
        course.course_id ||
        course.code ||
        course.courseCode ||
        course.course_code;

      navigate(`/student/enrolled-courses/${joinedCourseId}`);
    } catch (error) {
      console.error("Join course error:", error);

      await Swal.fire({
        icon: "error",
        title: "Unable to Join Course",
        text:
          error?.message || "Something went wrong while joining the course.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    }
  };

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
    setVisiblePasswords((current) => ({
      ...current,
      [fieldName]: !current[fieldName],
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

  const passwordsMatch =
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword === passwordForm.confirmPassword;

  const clearPasswordForm = () => {
    setPasswordForm(initialPasswordForm);

    setPasswordNotice({
      type: "",
      message: "",
    });

    setVisiblePasswords({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    setPasswordNotice({
      type: "",
      message: "",
    });

    if (!passwordForm.currentPassword) {
      setPasswordNotice({
        type: "error",
        message: "Enter your current password first.",
      });
      return;
    }

    if (!passwordIsStrong) {
      setPasswordNotice({
        type: "error",
        message: "Your new password does not meet all requirements.",
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

    const token = getStoredToken();

    if (!token) {
      await Swal.fire({
        icon: "error",
        title: "Session Expired",
        text: "Your login session was not found. Please log in again.",
        confirmButtonText: "OK",
        confirmButtonColor: "#2f855a",
      });

      navigate("/login", {
        replace: true,
      });

      return;
    }

    setIsSubmittingPassword(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Unable to change your password.");
      }

      updateUser({
        ...user,
        ...data.user,
        mustChangePassword: false,
        must_change_password: false,
        temporaryPassword: "",
        temporary_password: "",
      });

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

      await Swal.fire({
        icon: "success",
        title: "Password Updated",
        text: data.message || "Your password was changed successfully.",
        confirmButtonText: "OK",
        confirmButtonColor: "#2f855a",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      if (passwordChangeRequired) {
        navigate("/student", { replace: true });
      }
    } catch (error) {
      const errorMessage =
        error.message || "Something went wrong while changing your password.";

      setPasswordNotice({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="student-settings-page">
      <StudentSidebar />

      <div className="student-settings-main-area">
        <StudentHeader
          searchPlaceholder="Search your course"
          showJoinCourse={!passwordChangeRequired}
          onJoinCourse={() => setJoinModalOpen(true)}
        />

        <main className="enrolled-main settings-main student-settings-content">
          <section className="settings-heading">
            <div>
              <h1>Account Settings</h1>

              <p>
                {passwordChangeRequired
                  ? "Please change your temporary password to unlock the rest of your account."
                  : "Manage your password and keep your student account secure."}
              </p>
            </div>
          </section>

          <section
            className="password-settings-section"
            aria-label="Change password"
          >
            <div className="password-settings-card">
              <div className="password-card-header">
                <span className="password-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    <circle cx="12" cy="15" r="1.2" />
                  </svg>
                </span>

                <div>
                  <h2>Change Password</h2>

                  <p>
                    Use a strong password that you do not use on other accounts.
                  </p>
                </div>
              </div>

              <form
                className="password-settings-form"
                onSubmit={handlePasswordChange}
              >
                <div className="password-field-group">
                  <label htmlFor="current-password">Current Password</label>

                  <div className="password-input-wrapper">
                    <input
                      id="current-password"
                      type={
                        visiblePasswords.currentPassword ? "text" : "password"
                      }
                      value={passwordForm.currentPassword}
                      onChange={updatePasswordField("currentPassword")}
                      autoComplete="current-password"
                      placeholder="Enter your current password"
                    />

                    <button
                      type="button"
                      className="password-visibility-button"
                      onClick={() =>
                        togglePasswordVisibility("currentPassword")
                      }
                      aria-label={
                        visiblePasswords.currentPassword
                          ? "Hide current password"
                          : "Show current password"
                      }
                    >
                      {visiblePasswords.currentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="password-form-divider" />

                <div className="password-field-group">
                  <label htmlFor="new-password">New Password</label>

                  <div className="password-input-wrapper">
                    <input
                      id="new-password"
                      type={visiblePasswords.newPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={updatePasswordField("newPassword")}
                      autoComplete="new-password"
                      placeholder="Create a new password"
                    />

                    <button
                      type="button"
                      className="password-visibility-button"
                      onClick={() => togglePasswordVisibility("newPassword")}
                      aria-label={
                        visiblePasswords.newPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                    >
                      {visiblePasswords.newPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div
                  className="password-requirements"
                  aria-label="Password requirements"
                >
                  <span className={passwordChecks.length ? "met" : ""}>
                    12 characters
                  </span>

                  <span className={passwordChecks.uppercase ? "met" : ""}>
                    Uppercase
                  </span>

                  <span className={passwordChecks.lowercase ? "met" : ""}>
                    Lowercase
                  </span>

                  <span className={passwordChecks.number ? "met" : ""}>
                    Number
                  </span>

                  <span className={passwordChecks.symbol ? "met" : ""}>
                    Symbol
                  </span>
                </div>

                <div className="password-field-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>

                  <div className="password-input-wrapper">
                    <input
                      id="confirm-password"
                      type={
                        visiblePasswords.confirmPassword ? "text" : "password"
                      }
                      value={passwordForm.confirmPassword}
                      onChange={updatePasswordField("confirmPassword")}
                      autoComplete="new-password"
                      placeholder="Re-enter your new password"
                      className={
                        passwordForm.confirmPassword && !passwordsMatch
                          ? "input-error"
                          : ""
                      }
                    />

                    <button
                      type="button"
                      className="password-visibility-button"
                      onClick={() =>
                        togglePasswordVisibility("confirmPassword")
                      }
                      aria-label={
                        visiblePasswords.confirmPassword
                          ? "Hide confirmed password"
                          : "Show confirmed password"
                      }
                    >
                      {visiblePasswords.confirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {passwordForm.confirmPassword && (
                    <small
                      className={
                        passwordsMatch ? "match-success" : "match-error"
                      }
                    >
                      {passwordsMatch
                        ? "Passwords match."
                        : "Passwords do not match."}
                    </small>
                  )}
                </div>

                {passwordNotice.message && (
                  <div
                    className={`password-notice ${passwordNotice.type}`}
                    role={passwordNotice.type === "error" ? "alert" : "status"}
                  >
                    {passwordNotice.message}
                  </div>
                )}

                <div className="password-form-actions">
                  <button
                    type="button"
                    className="password-cancel-button"
                    onClick={clearPasswordForm}
                    disabled={isSubmittingPassword}
                  >
                    Clear
                  </button>

                  <button
                    type="submit"
                    className="password-save-button"
                    disabled={isSubmittingPassword}
                  >
                    {isSubmittingPassword ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>

            <aside className="password-security-note">
              <span aria-hidden="true">i</span>

              <div>
                <strong>Security reminder</strong>

                <p>
                  After changing your password, avoid sharing it and sign out
                  from devices you no longer use.
                </p>
              </div>
            </aside>
          </section>
        </main>
      </div>

      <JoinCourseModal
        open={joinModalOpen}
        courseCode={courseCode}
        onCourseCodeChange={setCourseCode}
        onCancel={closeJoinModal}
        onJoin={joinByCourseCode}
      />
    </div>
  );
}
