import "./LoginFeedback.css";
import PublicNavbar from "../../components/landing/PublicNavbar.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import { API_BASE } from "../../config.js";
import LandingFooter from "../../components/landing/LandingFooter";

import styles from "./login.module.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      Swal.fire({
        title: "Invalid Email",
        text: "Please enter a valid email address.",
        imageUrl: "/images/error.png",
        imageWidth: 200,
        imageHeight: 200,
      });

      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Swal.fire({
          title: "Request Failed",
          text:
            data.message ||
            "We could not send a password reset email right now.",
          imageUrl: "/images/error.png",
          imageWidth: 200,
          imageHeight: 200,
        });

        return;
      }

      await Swal.fire({
        title: "",
        text:
          data.message ||
          "If an account exists for that email, a password reset link has been sent.",
        imageUrl: "/images/emailsent.png",
        imageWidth: 270,
        imageHeight: 180,
        imageAlt: "Password reset email sent",
        customClass: {
          popup: "login-feedback-popup",
          container: "login-feedback-overlay",
        },
        confirmButtonText: "OK",
      });

      navigate("/login");
    } catch (error) {
      Swal.fire({
        title: "Server Error",
        text: "Please try again later.",
        imageUrl: "/images/error.png",
        imageWidth: 200,
        imageHeight: 200,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.container}>
        <div className={styles.background} aria-hidden="true" />

        <PublicNavbar />

        <main className={styles.signupContainer}>
          <form
            className={`${styles.signupCard} ${styles.loginPageCard}`}
            onSubmit={handleSubmit}
          >
            <h2>Forgot Password</h2>
            <label htmlFor="forgot-password-email">Email Address</label>

            <input
              id="forgot-password-email"
              name="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Submit"}
            </button>

            <p className={styles.forgotText}>
              Already remembered?
              <Link to="/login" className={styles.forgotLoginLink}>
                Login
              </Link>
            </p>
          </form>
        </main>

        <LandingFooter />
      </section>
    </div>
  );
}

export default ForgotPassword;
