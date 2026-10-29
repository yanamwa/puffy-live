import { NavLink, Link } from "react-router-dom";
import styles from "../../pages/auth/login.module.css";

export default function PublicNavbar() {
  return (
    <header className={styles.loginNavbar}>
      <nav className={styles.loginNavbarInner} aria-label="Main navigation">
        <NavLink to="/" end className={styles.loginNavLink}>
          Home
        </NavLink>
        <NavLink to="/about" className={styles.loginNavLink}>
          About
        </NavLink>
        <Link to="/" className={styles.loginBrand}>
          <img src="/images/logo.png" alt="" />
          <span>PuffyBrain</span>
        </Link>
        <NavLink to="/faq" className={styles.loginNavLink}>
          FAQ
        </NavLink>
        <NavLink to="/contact" className={styles.loginNavLink}>
          Contact us
        </NavLink>
      </nav>
    </header>
  );
}
