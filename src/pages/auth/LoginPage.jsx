import PublicNavbar from "../../components/landing/PublicNavbar.jsx";
import styles from "./login.module.css";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { API_BASE } from "../../config.js";
import LandingNavbar from "../../components/landing/LandingNavbar";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  APP_ROLES,
  getHomePathForRole,
  getUserRole,
  isProfessorApprovalRestricted,
  normalizeRole,
} from "../../utils/roles.js";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, saveSession, logout } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");

  const [loginAttempts, setLoginAttempts] = useState(0);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const MAX_ATTEMPTS = 10;
  const LOGIN_TIMEOUT_MS = 15000;

  const [loginFeedback, setLoginFeedback] = useState(null);

  useEffect(() => {
    const role = getUserRole(user);

    if (role && !isLoggingIn) {
      if (isProfessorApprovalRestricted(user)) {
        logout();
        setLoginError(
          "Your professor registration is pending Super Admin approval.",
        );
        return;
      }

      navigate(getHomePathForRole(role), {
        replace: true,
      });
    }
  }, [isLoggingIn, logout, navigate, user]);

  useEffect(() => {
    if (location.state?.professorApprovalRequired) {
      setLoginError(
        "Your professor registration is pending Super Admin approval.",
      );
    }
  }, [location.state]);

  const setLoginError = (message) => {
    setLoginFeedback({
      type: "error",
      message,
    });
  };

  const clearLoginFeedback = () => {
    if (loginFeedback) {
      setLoginFeedback(null);
    }
  };

  const showLoginError = (message) => {
    setLoginError(message);

    Swal.fire({
      imageUrl: "/images/error.png",
      imageWidth: 170,
      imageHeight: 170,
      title: "Login Failed",
      text: message,
    });
  };

  const handleDeletedAccount = async (data) => {
    const result = await Swal.fire({
      imageUrl: "/images/error.png",
      imageWidth: 170,
      imageHeight: 170,
      title: "Account Deleted",
      text: "This account was deleted. Do you want to recover it?",
      showCancelButton: true,
      confirmButtonText: "Recover Account",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#8b5cf6",
      cancelButtonColor: "#999",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const otpRes = await fetch(`${API_BASE}/send-recovery-otp.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: data.username || username.trim().toLowerCase(),
        }),
      });

      const otpData = await otpRes.json().catch(() => ({}));

      console.log("RECOVERY OTP RESPONSE:", otpData);

      if (!otpRes.ok || !otpData.success) {
        Swal.fire({
          imageUrl: "/images/error.png",
          imageWidth: 170,
          imageHeight: 170,
          title: "Failed",
          text: otpData.message || "Could not send verification code.",
        });

        return;
      }

      await Swal.fire({
        imageUrl: "/images/success.png",
        imageWidth: 170,
        imageHeight: 170,
        title: "Verification Code Sent",
        text: "Please check your email for the recovery code.",
      });

      navigate("/recover-account", {
        state: {
          username: data.username || username.trim().toLowerCase(),

          email: otpData.email || data.email || username.trim().toLowerCase(),
        },
      });
    } catch (otpError) {
      console.error("RECOVERY OTP ERROR:", otpError);

      Swal.fire({
        imageUrl: "/images/error.png",
        imageWidth: 170,
        imageHeight: 170,
        title: "Server Error",
        text: "Failed to send verification code.",
      });
    }
  };

  const redirectUser = async (data, loggedInUser) => {
    const role =
      getUserRole(loggedInUser) ||
      getUserRole(data.user) ||
      normalizeRole(data.role) ||
      APP_ROLES.STUDENT;

    const mustChangePassword =
      loggedInUser?.mustChangePassword === true ||
      loggedInUser?.must_change_password === true ||
      Number(loggedInUser?.must_change_password) === 1;

    if (role === APP_ROLES.STUDENT && mustChangePassword) {
      await Swal.fire({
        imageUrl: "/images/success.png",
        imageWidth: 170,
        imageHeight: 170,
        title: "Password Update Required",
        text: "Please change your temporary password.",
      });

      navigate("/student/settings", {
        replace: true,
      });

      return;
    }

    await Swal.fire({
      imageUrl: "/images/welcome_back.png",
      imageWidth: 270,
      imageHeight: 180,
      title: "Welcome back!",
      text: "Redirecting to your dashboard",
      timer: 1200,
      showConfirmButton: false,
    });

    navigate(getHomePathForRole(role), {
      replace: true,
    });
  };

  const handleLogin = async (event) => {
    event?.preventDefault();

    const email = username.trim().toLowerCase();

    if (!email || !password) {
      const message = "Please enter email and password";

      setLoginError(message);

      Swal.fire({
        imageUrl: "/images/missing_credentials.png",
      imageWidth: 270,
      imageHeight: 180,
        title: "Missing Fields",
        text: message,
      });

      return;
    }

    if (loginAttempts >= MAX_ATTEMPTS) {
      const message =
        "You reached the maximum login attempts. Please try again later.";

      setLoginError(message);

      Swal.fire({
        imageUrl: "/images/error.png",
        imageWidth: 170,
        imageHeight: 170,
        title: "Too Many Attempts",
        text: message,
      });

      return;
    }

    if (isLoggingIn) {
      return;
    }

    try {
      setIsLoggingIn(true);
      setLoginFeedback({
        type: "warning",
        message: "Checking your login...",
      });

      const controller = new AbortController();

      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, LOGIN_TIMEOUT_MS);

      let res;
      let data;

      try {
        res = await fetch(`${API_BASE}/login`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
          signal: controller.signal,
        });

        data = await res.json().catch(() => null);
        if (res.status >= 500) {
          throw new Error(
            "The login server is unavailable. Please try again when the backend is running.",
          );
        }
        if (!data || typeof data !== "object" || !("success" in data)) {
          throw new Error(
            "The login server returned an unexpected response. Please check the API configuration.",
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
      }

      console.log("LOGIN RESPONSE:", data);

      if (!res.ok || !data.success) {
        const accountDeleted =
          data.account_deleted === true ||
          data.account_deleted === 1 ||
          data.account_deleted === "1" ||
          data.account_deleted === "true";

        if (accountDeleted) {
          await handleDeletedAccount(data);

          return;
        }

        const newAttempts = loginAttempts + 1;

        setLoginAttempts(newAttempts);

        const attemptsLeft = Math.max(MAX_ATTEMPTS - newAttempts, 0);

        showLoginError(
          data.message || `Invalid credentials. Attempts left: ${attemptsLeft}`,
        );

        return;
      }

      setLoginAttempts(0);
      setLoginFeedback({
        type: "success",
        message: "Login successful. Redirecting...",
      });

      const token = data.token || data.accessToken || data.access_token || "";

      if (token) {
        localStorage.setItem("token", token);

        localStorage.setItem("authToken", token);
      }
      const sessionResult = saveSession(data);

      const loggedInUser = sessionResult || data.user || null;

      if (loggedInUser) {
        localStorage.setItem("user", JSON.stringify(loggedInUser));

        localStorage.setItem("currentUser", JSON.stringify(loggedInUser));
      }

      await redirectUser(data, loggedInUser);
    } catch (error) {
      console.error("LOGIN ERROR:", error);

      const message =
        error.name === "AbortError"
          ? "Login took too long. Please check that the backend is running and try again."
          : error.message ||
            "Could not connect to the server. Please check that your backend is running.";

      setLoginError(message);

      Swal.fire({
        imageUrl: "/images/error.png",
        imageWidth: 170,
        imageHeight: 170,
        title: message.includes("professor registration")
          ? "Approval Pending"
          : "Server Error",
        text: message,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.container}>
        <div className={styles.background}></div>

        <PublicNavbar />

        <div className={styles.signupContainer}>
          <form
            className={styles.signupCard}
            onSubmit={handleLogin}
            noValidate
            aria-busy={isLoggingIn}
          >
            <h2>Login</h2>

            <label>Email</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={username}
              autoComplete="email"
              disabled={isLoggingIn}
              onChange={(e) => {
                clearLoginFeedback();

                setUsername(e.target.value);
              }}
            />

            <label>Password</label>

            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                autoComplete="current-password"
                disabled={isLoggingIn}
                onChange={(e) => {
                  clearLoginFeedback();

                  setPassword(e.target.value);
                }}
              />

              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className={styles.toggleEye}
                disabled={isLoggingIn}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <FiEyeOff aria-hidden="true" />
                ) : (
                  <FiEye aria-hidden="true" />
                )}
              </button>
            </div>

            <p className={styles.forgot}>
              <Link to="/forgot">Forgot your password?</Link>
            </p>

            <button
              type="submit"
              className={styles.loginBtn}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Logging in..." : "Login"}
            </button>

            {loginFeedback && (
              <p
                className={`${styles.validationMessage} ${
                  styles[loginFeedback.type]
                }`}
                role={loginFeedback.type === "error" ? "alert" : "status"}
              >
                {loginFeedback.message}
              </p>
            )}

            <p className={styles.signupText}>
              Don&apos;t have an account? <Link to="/signup">Signup</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}

export default Login;
