import { Link } from "react-router-dom";
import styles from "../pages/course/Learning_Module.module.css";
import confirmLogout from "../utils/confirmLogout.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

function SidebarItem({ children, icon, onClick, to, active = false }) {
  const className = `${styles.menuItem} ${active ? styles.active : ""}`;

  if (to) {
    return (
      <Link className={className} to={to}>
        <span aria-hidden="true">{icon}</span>
        <span className={styles.menuText}>{children}</span>
      </Link>
    );
  }

  return (
    <button className={className} type="button" onClick={onClick}>
      <span aria-hidden="true">{icon}</span>
      <span className={styles.menuText}>{children}</span>
    </button>
  );
}

export default function UserSidebar({
  isCollapsed,
  setIsCollapsed,
  myDecks = [],
  courses = [],
  openCourse,
  getDeckId,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const confirmAndLogout = async () => {
    if (!(await confirmLogout())) return;
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}
    >
      <div className={styles.sidebarTop}>
        <button
          className={styles.sidebarToggle}
          type="button"
          onClick={() => setIsCollapsed?.((current) => !current)}
          aria-label="Toggle sidebar"
        >
          <span aria-hidden="true">|||</span>
        </button>

        <div className={styles.logo}>
          <img
            className={styles.logoExpanded}
            src="/images/Student.png"
            alt="PuffyBrain Student"
          />
          <img
            className={styles.logoCollapsed}
            src="/images/Student.png"
            alt="PuffyBrain Student"
          />
        </div>

        <div className={styles.divider}></div>

        <nav className={styles.menu} aria-label="Student menu">
          <SidebarItem icon="H" to="/student">
            Home
          </SidebarItem>
          <SidebarItem icon="C" to="/student/enrolled-courses" active>
            My Courses
          </SidebarItem>
          <SidebarItem icon="P" to="/student/public-courses">
            Public Courses
          </SidebarItem>
        </nav>

        <div className={styles.sectionBlock}>
          <p className={styles.sectionTitle}>Courses</p>
          <ul className={styles.sectionList}>
            {courses.length === 0 ? (
              <li className={styles.sidebarEmptyText}>No courses yet.</li>
            ) : (
              courses.slice(0, 5).map((course) => (
                <li
                  className={styles.sidebarListItem}
                  key={course.id || course.code}
                >
                  <SidebarItem
                    icon="B"
                    onClick={() =>
                      openCourse?.(course.id || course.course_id || course.code)
                    }
                  >
                    {course.title || course.code || "Course"}
                  </SidebarItem>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={styles.sectionBlock}>
          <p className={styles.sectionTitle}>Decks</p>
          <ul className={styles.sectionList}>
            {myDecks.length === 0 ? (
              <li className={styles.sidebarEmptyText}>No decks yet.</li>
            ) : (
              myDecks.slice(0, 5).map((deck) => (
                <li
                  className={styles.sidebarListItem}
                  key={getDeckId?.(deck) || deck.id}
                >
                  <SidebarItem icon="D">
                    {deck.title || deck.name || "Deck"}
                  </SidebarItem>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className={styles.logout}>
        <SidebarItem icon="L" onClick={confirmAndLogout}>
          Log out
        </SidebarItem>
      </div>
    </aside>
  );
}
