import PublicNavbar from "../../../components/landing/PublicNavbar.jsx";
import React, { useEffect, useState } from "react";
import styles from "./ContactUs.module.css";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import { API_BASE } from "../../../config.js";
import { FaInstagram, FaFacebookF, FaEnvelope } from "react-icons/fa";
import "../../auth/LoginFeedback.css";

function ContactUs() {
  const [sending, setSending] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const showAlert = ({ title, text, image }) => {
    Swal.fire({
      title,
      text,
      imageUrl: image,
      imageWidth: 360,
      imageHeight: 240,
      imageAlt: title,
      confirmButtonText: "Okay",
      confirmButtonColor: "#7fa8d6",
      customClass: {
        popup: "login-feedback-popup",
        container: "login-feedback-overlay",
      },
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (sending) return;

    const form = e.target;

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
      showAlert({
        title: "Missing Details",
        text: "Please fill out all fields.",
        image: "/images/think.png",
      });
      return;
    }

    setSending(true);

    fetch(`${API_BASE}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, message }),
    })
      .then(async (response) => ({
        response,
        data: await response.json().catch(() => ({})),
      }))
      .then(({ response, data }) => {
        if (response.ok && data.success) {
          showAlert({
            title: "Message Sent!",
            text:
              data.message ||
              "Thank you for reaching out. We'll get back to you soon.",
            image: "/images/success.png",
          });

          form.reset();
        } else {
          const isLimitReached =
            response.status === 429 ||
            data.message === "You can only send 3 messages.";
          showAlert({
            title: isLimitReached ? "Message Limit Reached" : "Message Failed",
            text: data.message || "Please try again.",
            image: "/images/tryagain.png",
          });
        }
      })
      .catch(() => {
        showAlert({
          title: "Server Error",
          text: "Could not send your message. Please try again.",
          image: "/images/tryagain.png",
        });
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <div className={styles.contactPage}>
      <header className={styles.header}>
        <PublicNavbar />

        
          <div className={styles.heroContent}>
            <div className={styles.headerText}>
              <h3>Contact Us</h3>

              <h1>
                Get in touch with us. We're always happy
                to hear your suggestions.
              </h1>

              <p>
                Have questions, suggestions, or feedback?
                We'd love to hear from you. Fill out the
                form below and our team will get back to
                you as soon as possible.
              </p>
            </div>

            <div className={styles.heroImage}>
              <img
                src="/images/contact.png"
                alt="PuffyBrain Contact Us Mascot"
              />
            </div>
          </div>

      </header>

      <section className={styles.contactSection}>
        <form className={styles.contactForm} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <p>Send a Message</p>
            <h2>Tell us what’s on your mind</h2>
          </div>

          <div className={styles.contactRow}>
            <div className={styles.contactField}>
              <label>Name:</label>
              <input
                name="name"
                type="text"
                maxLength={120}
                placeholder="Enter your name"
                required
              />
            </div>

            <div className={styles.contactField}>
              <label>Email:</label>
              <input
                name="email"
                type="email"
                maxLength={254}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div className={styles.messageField}>
            <label>Message:</label>
            <textarea
              name="message"
              maxLength={5000}
              placeholder="Enter your message"
              required
            ></textarea>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={sending}>
            {sending ? "Sending..." : "Submit"}
          </button>
        </form>
      </section>

      <section className={styles.contactInfo}>
        <div className={styles.contactLeft}>
          <p>Contact Info</p>
          <h1>We are always happy to assist you</h1>
        </div>

        <div className={styles.contactRight}>
          <h2>Email Address</h2>
          <hr />
          <h2 className={styles.emailText}>puffybrain.contactus@gmail.com</h2>

          <h3>Assistance hours:</h3>
          <p>Monday - Friday</p>
          <p>6:00 AM - 8:00 PM EST</p>
        </div>
      </section>

      
      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerMenu}>
          <Link to="/about">About Us</Link>
          <Link to="/toc">Terms and Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/contact">Contact Us</Link>
        </div>

        <div className={styles.socialIcons}>
          <a href="#" aria-label="Instagram">
            <FaInstagram />
          </a>
          <a href="#" aria-label="Facebook">
            <FaFacebookF />
          </a>
          <a href="mailto:puffybrain@gmail.com" aria-label="Email PuffyBrain">
            <FaEnvelope />
          </a>
        </div>
      </footer>


      <div className={styles.subFooter}>
        © 2025 – PuffyBrain All Rights Reserved
      </div>
    </div>
  );
}

export default ContactUs;
