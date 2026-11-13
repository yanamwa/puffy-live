import { useRef, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { API_BASE } from "../../config.js";
import styles from "./login.module.css";
import "./LoginFeedback.css";
import LandingNavbar from "../../components/landing/LandingNavbar";
import LandingFooter from "../../components/landing/LandingFooter";

export default function Otp() {
  const inputsRef = useRef([]);
  const resendInFlight = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || sessionStorage.getItem("otp_email");
  const otpRole =
    location.state?.role || sessionStorage.getItem("otp_role") || "";

  const OTP_DURATION = 300;
  const getInitialOtpDeadline = () => {
    const stateDeadline = Number(location.state?.otpExpiresAt);
    const storedDeadline = Number(sessionStorage.getItem("otp_expires_at"));
    const deadline =
      Math.max(stateDeadline || 0, storedDeadline || 0) ||
      (otpRole === "student" ? Date.now() : Date.now() + OTP_DURATION * 1000);

    sessionStorage.setItem("otp_expires_at", String(deadline));
    return deadline;
  };

  const [otpDeadline, setOtpDeadline] = useState(getInitialOtpDeadline);
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.ceil((otpDeadline - Date.now()) / 1000)),
  );
  const [resending, setResending] = useState(false);
  const [inlineError, setInlineError] = useState("");

  const showThinkAlert = (title, text) => {
    Swal.fire({
      title,
      text,
      imageUrl: "/images/failed_otp.png",
      imageWidth: 270,
      imageHeight: 180,
      imageAlt: "Verification code could not be sent or verified",
      customClass: {
        popup: "login-feedback-popup",
        container: "login-feedback-overlay",
      },
      confirmButtonText: "OK",
    });
  };

  const showSuccessAlert = (title, text) => {
    return Swal.fire({
      title,
      text,
      imageUrl: "/images/complete.png",
      imageWidth: 270,
      imageHeight: 180,
      imageAlt: "Completed successfully",
      customClass: {
        popup: "login-feedback-popup",
        container: "login-feedback-overlay",
      },
      confirmButtonText: "OK",
    });
  };

  const showErrorAlert = (title, text) => {
    Swal.fire({
      title,
      text,
      imageUrl: "/images/failed_otp.png",
      imageWidth: 270,
      imageHeight: 180,
      imageAlt: "Verification code could not be sent or verified",
      customClass: {
        popup: "login-feedback-popup",
        container: "login-feedback-overlay",
      },
      confirmButtonText: "OK",
    });
  };

  useEffect(() => {
    if (!email) {
      const studentLogin = otpRole === "student";
      showThinkAlert(
        "Session Expired",
        studentLogin ? "Please sign in again to verify your email." : "Please sign up again.",
      );
      setTimeout(() => navigate(studentLogin ? "/login" : "/signup"), 1200);
    }
  }, [email, navigate, otpRole]);

  useEffect(() => {
    const updateTimeLeft = () => {
      setTimeLeft(Math.max(0, Math.ceil((otpDeadline - Date.now()) / 1000)));
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [otpDeadline]);

  const formatTime = () => {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const seconds = String(timeLeft % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const getAlertTitle = (message) => {
    if (message === "Wrong code") return "Wrong Code";
    if (message === "Invalid verification code") return "Wrong Code";
    if (message === "Invalid email address") return "Wrong Email";
    if (message === "Verification code expired") return "Code Expired";
    if (message === "OTP has expired.") return "Code Expired";
    if (message === "Account not found or already verified") {
      return "Account Not Found";
    }

    return "Verification Failed";
  };

  const handleInput = (e, index) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");

    if (e.target.value && index < inputsRef.current.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !e.target.value && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = () => {
    const otp = inputsRef.current.map((input) => input?.value || "").join("");

    if (timeLeft <= 0) {
      setInlineError("Verification code expired");
      return;
    }

    if (otp.length !== 4) {
      showThinkAlert("Incomplete Code", "Enter all 4 digits.");
      return;
    }

    fetch(`${API_BASE}/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, otp }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setInlineError("");
          const verifiedRole = data.role || otpRole;
          const successMessage = data.requiresApproval
            ? "Your email is verified. The Super Admin will review your professor registration."
            : data.verificationStatus === "declined"
              ? "Your email is verified. Your registration was declined."
              : verifiedRole === "student"
                ? "Your email is verified. Sign in to begin the student tutorial."
                : "Your email is verified. You can now sign in.";
          showSuccessAlert(
            "Verified!",
            successMessage,
          ).then(() => {
            sessionStorage.removeItem("otp_email");
            sessionStorage.removeItem("otp_role");
            sessionStorage.removeItem("otp_expires_at");
            navigate("/login");
          });
        } else {
          if (
            data.message === "Verification code expired" ||
            data.message === "OTP has expired."
          ) {
            setInlineError("Verification code expired");
            return;
          }

          showThinkAlert(
            getAlertTitle(data.message),
            data.message || "Wrong verification details.",
          );
        }
      })
      .catch(() => {
        showErrorAlert("Server Error", "Could not verify OTP.");
      });
  };

  const handleResend = () => {
    if (resendInFlight.current || Date.now() < otpDeadline) return;

    if (!email) {
      showThinkAlert("Session Expired", "Please sign up again.");
      navigate("/signup");
      return;
    }

    resendInFlight.current = true;
    setResending(true);

    fetch(`${API_BASE}/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          showSuccessAlert("Verification Code Resent", "A new verification code has been sent to your email.");
          const parsedSeconds = Number(data.otpSecondsRemaining);
          const secondsRemaining = Number.isFinite(parsedSeconds)
            ? parsedSeconds
            : OTP_DURATION;
          const nextDeadline =
            Date.now() + Math.max(0, secondsRemaining) * 1000;

          sessionStorage.setItem("otp_expires_at", String(nextDeadline));
          setOtpDeadline(nextDeadline);
          setTimeLeft(Math.max(0, secondsRemaining));
          setInlineError("");
          inputsRef.current.forEach((input) => {
            if (input) input.value = "";
          });
        } else {
          if (Number(data.otpSecondsRemaining) > 0) {
            const remaining = Number(data.otpSecondsRemaining);
            const nextDeadline = Date.now() + remaining * 1000;
            sessionStorage.setItem("otp_expires_at", String(nextDeadline));
            setOtpDeadline(nextDeadline);
            setTimeLeft(remaining);
          }
          showThinkAlert(
            "Resend Failed",
            data.message || "Could not resend code.",
          );
        }
      })
      .catch(() => {
        showErrorAlert("Server Error", "Could not resend OTP.");
      })
      .finally(() => {
        resendInFlight.current = false;
        setResending(false);
      });
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.container}>
        <div className={styles.background}></div>
        <LandingNavbar />

        <div className={`${styles.signupContainer} ${styles.otpContainer}`}>
          <div className={`${styles.signupCard} ${styles.otpCard}`}>
            <h2>Email Verification</h2>

            <p className={styles.verifySubtext}>
              Enter the 4-digit code sent to your email
            </p>

            <div className={styles.otpWrapper}>
              {[0, 1, 2, 3].map((_, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  className={styles.otpInput}
                  ref={(el) => (inputsRef.current[index] = el)}
                  onInput={(e) => handleInput(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                />
              ))}
            </div>

            {(inlineError || timeLeft <= 0) && (
              <p className={styles.otpInlineError}>
                {inlineError || "Verification code expired"}
              </p>
            )}

            <div className={styles.otpRow}>
              <span className={styles.otpTimer}>
                {timeLeft > 0
                  ? `Code expires in ${formatTime()}`
                  : "Code expired"}
              </span>

              <button
                type="button"
                className={styles.resendBtn}
                disabled={resending || !email || timeLeft > 0}
                onClick={handleResend}
              >
                {resending ? "Sending..." : "Resend"}
              </button>
            </div>

            <button
              type="button"
              className={styles.verifyBtn}
              onClick={handleSubmit}
            >
              Verify
            </button>
          </div>
        </div>
        <LandingFooter />
      </section>
    </div>
  );
}
