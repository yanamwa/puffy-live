import { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FiLogOut } from "react-icons/fi";

import { Icon } from "../../pages/student/enrolled/EnrolledCourses";
import "./StudentSidebar.css";

import { API_BASE as API_BASE_URL } from "../../config.js";

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

function normalizeCourse(course) {
  const title =
    course.title ||
    course.courseName ||
    course.course_name ||
    course.name ||
    "Untitled course";

  return {
    ...course,

    id:
      course.id ||
      course.courseId ||
      course.course_id ||
      course.courseCode ||
      course.course_code,

    code: course.code || course.courseCode || course.course_code || "COURSE",

    title,
  };
}

export default function StudentSidebar({ collapsed, onCollapsedChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });

  const [enrolledCoursesOpen, setEnrolledCoursesOpen] = useState(false);

  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  /*
   * Allows the sidebar to work either:
   * 1. by itself, or
   * 2. controlled by StudentLayout later.
   */
  const sidebarCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  useEffect(() => {
    let active = true;

    async function loadEnrolledCourses() {
      try {
        setLoadingCourses(true);

        const token = getStoredToken();

        if (!token) {
          if (active) {
            setEnrolledCourses([]);
          }

          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/courses/enrolled?summaryOnly=true`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Could not load enrolled courses.");
        }

        const courses = Array.isArray(data.courses)
          ? data.courses
          : Array.isArray(data.data)
            ? data.data
            : [];

        if (active) {
          setEnrolledCourses(courses.map(normalizeCourse));
        }
      } catch (error) {
        console.error("Sidebar enrolled courses loading error:", error);

        if (active) {
          setEnrolledCourses([]);
        }
      } finally {
        if (active) {
          setLoadingCourses(false);
        }
      }
    }

    loadEnrolledCourses();

    return () => {
      active = false;
    };
  }, []);

  const toggleSidebar = () => {
    const newValue = !sidebarCollapsed;

    localStorage.setItem("sidebarCollapsed", String(newValue));

    if (typeof onCollapsedChange === "function") {
      onCollapsedChange(newValue);
    } else {
      setInternalCollapsed(newValue);
    }

    window.dispatchEvent(
      new CustomEvent("student-sidebar-toggle", {
        detail: {
          collapsed: newValue,
        },
      }),
    );
  };

  const handleLogout = () => {
    void logout();
    navigate("/login", {
      replace: true,
    });
  };

  const getNavClass = ({ isActive }) =>
    `side-nav-item plain-nav-item ${isActive ? "active" : ""}`;

  return (
    <aside
      className={`enrolled-sidebar ${
        sidebarCollapsed ? "sidebar-collapsed" : ""
      }`}
    >
      {/* =========================
          BRAND
      ========================= */}

      <div className="brand-lockup">
        <img
          src={sidebarCollapsed ? "/images/puffybrain.png" : "/images/Student.png"}
          alt="PuffyBrain Student"
          className="sidebar-logo"
          style={{ width: "100%", maxWidth: sidebarCollapsed ? 65 : 280, height: sidebarCollapsed ? 65 : 100, objectFit: "contain" }}
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        />


      </div>

      {/* =========================
          NAVIGATION
      ========================= */}

      <nav className="side-nav" aria-label="Student navigation">
        <NavLink
          to="/student"
          end
          className={({ isActive }) =>
            `side-nav-item ${isActive ? "active" : ""}`
          }
          title={sidebarCollapsed ? "Home" : undefined}
        >
          <Icon name="home" />

          <span className="nav-label">Home</span>
        </NavLink>

        {/* =========================
            ENROLLED COURSES
        ========================= */}

        <div className="sidebar-course-group">
          <button
            type="button"
            className={`side-nav-item sidebar-enrolled-toggle ${
              location.pathname.startsWith("/student/enrolled-courses")
                ? "active"
                : ""
            }`}
            onClick={() => {
              navigate("/student/enrolled-courses");
            }}
            title={sidebarCollapsed ? "Enrolled Courses" : undefined}
          >
            <Icon name="courses" />

            <span className="nav-label">Enrolled Courses</span>

            {!sidebarCollapsed && (
              <svg
                className={`sidebar-dropdown-arrow ${
                  enrolledCoursesOpen ? "open" : ""
                }`}
                viewBox="0 0 24 24"
                aria-hidden="true"
                onClick={(event) => {
                  event.stopPropagation();

                  setEnrolledCoursesOpen((previous) => !previous);
                }}
              >
                <path d="m7 9 5 5 5-5" />
              </svg>
            )}
          </button>

          {!sidebarCollapsed && enrolledCoursesOpen && (
            <div className="sidebar-enrolled-list">
              {loadingCourses ? (
                <div className="sidebar-enrolled-message">
                  Loading courses...
                </div>
              ) : enrolledCourses.length === 0 ? (
                <div className="sidebar-enrolled-message">
                  No enrolled courses
                </div>
              ) : (
                enrolledCourses.map((course) => {
                  const courseId =
                    course.id ||
                    course.courseId ||
                    course.course_id ||
                    course.code ||
                    course.courseCode ||
                    course.course_code;

                  const courseCode =
                    course.code ||
                    course.courseCode ||
                    course.course_code ||
                    "COURSE";

                  const courseTitle =
                    course.title ||
                    course.courseName ||
                    course.course_name ||
                    course.name ||
                    "Untitled course";

                  return (
                    <Link
                      key={courseId}
                      to={`/student/enrolled-courses/${courseId}`}
                      className="sidebar-enrolled-course"
                    >
                      <span className="sidebar-course-indicator" />

                      <span className="sidebar-enrolled-course-text">
                        <strong>{courseCode}</strong>

                        <small>{courseTitle}</small>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        <NavLink
          to="/student/public-courses"
          className={getNavClass}
          title={sidebarCollapsed ? "Public Courses" : undefined}
        >
          <Icon name="public" />

          <span className="nav-label">Public Courses</span>
        </NavLink>

        <NavLink
          to="/student/archived-courses"
          className={getNavClass}
          title={sidebarCollapsed ? "Archived Classes" : undefined}
        >
          <Icon name="archive" />

          <span className="nav-label">Archived classes</span>
        </NavLink>

        <NavLink
          to="/student/settings"
          className={getNavClass}
          title={sidebarCollapsed ? "Settings" : undefined}
        >
          <Icon name="settings" />

          <span className="nav-label">Settings</span>
        </NavLink>
      </nav>

      {/* =========================
          LOGOUT
      ========================= */}

      <button
        type="button"
        className="logout-button"
        title={sidebarCollapsed ? "Logout" : undefined}
        onClick={handleLogout}
      >
        <FiLogOut className="logout-icon" aria-hidden="true" />

        <span className="logout-label">Logout</span>
      </button>
    </aside>
  );
}
