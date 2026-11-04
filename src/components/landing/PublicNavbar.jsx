import { NavLink, Link } from "react-router-dom";
import styles from "../../pages/auth/login.module.css";

export default function PublicNavbar() {
  return (
    <header className={styles.loginNavbar}>
      <nav className={styles.loginNavbarInner} aria-label="Main navigation">
        <Link to="/" className={styles.loginBrand}>
          <img src="/images/logo.png" alt="PuffyBrain home" />
        </Link>
        <NavLink to="/" end className={styles.loginNavLink}>
          Home
        </NavLink>
        <NavLink to="/about" className={styles.loginNavLink}>
          About
        </NavLink>
        <NavLink to="/faq" className={styles.loginNavLink}>
          FAQ
        </NavLink>
        <NavLink to="/contact" className={styles.loginNavLink}>
          Contact us
        </NavLink>
        <Link to="/login" className={styles.loginStartLearning}>
          Start Learning
        </Link>
      </nav>
    </header>
  );
}
