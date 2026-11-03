import { FaInstagram, FaFacebookF, FaEnvelope } from "react-icons/fa";
import PublicNavbar from "../../../components/landing/PublicNavbar.jsx";
import styles from "./aboutus.module.css";

export default function AboutUs() {
  return (
    <>
      <div className={styles.wrapper}>
        <section className={styles.container}>
          <div className={styles.background}></div>

          {/* NAVBAR */}
          <PublicNavbar />

          {/* HERO */}
          <section className={styles.hero}>
            <div className={styles["about-container"]}>
              <div className={styles["about-img-wrapper"]}>
                <img
                  className={styles["about-img"]}
                  src="/images/AboutUs.png"
                  alt="Cute mascot image"
                />
              </div>

              <div className={styles["about-text"]}>
                <h1>About Us</h1>
                <p>
                  PuffyBrain is an smart and easy-to-use app made to help you
                  learn in a fun way.
                  <br />
                  We create unique quizzes that make learning easier, more
                  enjoyable, and personalized.
                  <br />
                  Our goal is to help you grow your knowledge every day while
                  having fun at the same time.
                  <br />
                  <br />
                  With PuffyBrain, learning feels light, simple, and exciting —
                  just like a brain full of fluffy ideas!
                </p>
              </div>
            </div>
          </section>
        </section>
      </div>

      {/* DEVELOPERS */}
      <section className={styles.features}>
        <h2 className={styles["section-title"]}>Meet our developers</h2>

        <div className={styles["dev-grid"]}>
          <div className={styles["card-container"]}>
            <div className={styles.photo}>
              <img src="/images/Diana-Icon.png" alt="Diana" />
              <div className={styles.barcode}></div>
            </div>
            <div className={styles["id-details"]}>
              <h3>Student ID Card</h3>
              <p className={styles.info}>
                <b>Name:</b> Diana Mae
              </p>
              <p className={styles.info}>
                <b>Role:</b> UI/UX Designer | Fullstack Developer
              </p>
              <p className={styles.info}>
                <b>Signature:</b>{" "}
                <span className={styles.signature}>Diana M.</span>
              </p>
            </div>
          </div>

          <div className={styles["card-container"]}>
            <div className={styles.photo}>
              <img src="/images/anika.png" alt="Anika" />
              <div className={styles.barcode}></div>
            </div>
            <div className={styles["id-details"]}>
              <h3>Student ID Card</h3>
              <p className={styles.info}>
                <b>Name:</b> Anika Danielle
              </p>
              <p className={styles.info}>
                <b>Role:</b> Fullstack Developer
              </p>
              <p className={styles.info}>
                <b>Signature:</b>{" "}
                <span className={styles.signature}>Anika D.</span>
              </p>
            </div>
          </div>

          <div className={styles["card-container"]}>
            <div className={styles.photo}>
              <img src="/images/belle.png" alt="Belle" />
              <div className={styles.barcode}></div>
            </div>
            <div className={styles["id-details"]}>
              <h3>Student ID Card</h3>
              <p className={styles.info}>
                <b>Name:</b> Tonne LaBelle
              </p>
              <p className={styles.info}>
                <b>Role:</b> Frontend Developer
              </p>
              <p className={styles.info}>
                <b>Signature:</b>{" "}
                <span className={styles.signature}>Belle S.</span>
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles["footer-menu"]}>
          <a href="/about">About Us</a>
          <a href="/toc">Terms and Conditions</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/contact">Contact Us</a>
        </div>

        <div className={styles["social-icons"]}>
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

      <div className={styles["sub-footer"]}>
        <p>© 2025 – PuffyBrain All Rights Reserved</p>
      </div>
    </>
  );
}
