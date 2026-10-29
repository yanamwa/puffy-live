import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import StudentSidebar from "../../../components/students/StudentSidebar";
import StudentHeader from "../../../components/students/StudentHeader";
import JoinCourseModal from "../courses/JoinCourseModal";

import {
  enrollStudentInCourseAsync,
  findJoinableCourseByCodeAsync,
} from "../courses/studentCourseData";

import "./EnrolledCoursespage.css";

import { API_BASE as API_BASE_URL } from "../../../config.js";

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

function normalizeCourse(course = {}) {
  return {
    ...course,
    id:
      course.id ||
      course.courseId ||
      course.course_id ||
      course.courseCode ||
      course.course_code,
    code: course.code || course.courseCode || course.course_code || "COURSE",
    title:
      course.title ||
      course.courseName ||
      course.course_name ||
      course.name ||
      "Untitled course",
    instructor:
      course.professorName ||
      course.professor_name ||
      course.instructor ||
      course.instructorName ||
      course.createdBy ||
      course.created_by ||
      "Professor",
    professorDepartment:
      course.professorDepartment ||
      course.professor_department ||
      course.database_professor_department ||
      course.department ||
      "Department not set",
    professorProfileImage:
      course.professorProfileImage ||
      course.professor_profile_image ||
      course.database_professor_profile_image ||
      course.professorAvatar ||
      course.professor_avatar ||
      "",
    createdAt:
      course.createdAt ||
      course.created_at ||
      course.enrolledAt ||
      course.enrolled_at ||
      "",
  };
}

function resolveProfileImage(imagePath) {
  if (!imagePath) return "/images/temporaryimg.png";

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${serverOrigin}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
}

/*
  Keep these exports because some of your other student files may still
  import them from EnrolledCourses.jsx.
*/
export function Icon({ name }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.3 12 5l8 6.3V20a1 1 0 0 1-1 1h-4.6v-5.4H9.6V21H5a1 1 0 0 1-1-1v-8.7Z" />
      </svg>
    );
  }

  if (name === "courses") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="m3.2 8.2 8.8-4.9 8.8 4.9-8.8 4.9-8.8-4.9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M6 10.3v5.2c0 1.2 2.7 3 6 3s6-1.8 6-3v-5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  if (name === "public") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M4.5 12h15M12 4.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (name === "archive") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 8h14v11H5V8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M4 5h16v3H4V5ZM9 12h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="3.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m18.6 13.4 1.2 1.1-1.7 3-1.6-.5a7.4 7.4 0 0 1-1.6.9l-.3 1.6h-3.4l-.3-1.6a7.4 7.4 0 0 1-1.6-.9l-1.6.5-1.7-3 1.2-1.1a6.3 6.3 0 0 1 0-1.8l-1.2-1.1 1.7-3 1.6.5a7.4 7.4 0 0 1 1.6-.9l.3-1.6h3.4l.3 1.6a7.4 7.4 0 0 1 1.6.9l1.6-.5 1.7 3-1.2 1.1a6.3 6.3 0 0 1 0 1.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return null;
}

export function SortToggle({ options, value, onChange }) {
  const selectedIndex = Math.max(0, options.indexOf(value));
  const nextIndex =
    selectedIndex === options.length - 1 ? 0 : selectedIndex + 1;

  return (
    <button
      type="button"
      className="sort-toggle"
      onClick={() => onChange?.(options[nextIndex])}
      title={`Click to switch to ${options[nextIndex]}`}
    >
      <span>{options[selectedIndex]}</span>
      <svg className="sort-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7h10" />
        <path d="m14 4 3 3-3 3" />
        <path d="M17 17H7" />
        <path d="m10 14-3 3 3 3" />
      </svg>
    </button>
  );
}

export function Avatar({
  large = false,
  src = "/images/temporaryimg.png",
  alt = "",
}) {
  return (
    <span className={`anime-avatar${large ? " large" : ""}`}>
      <img
        src={src || "/images/temporaryimg.png"}
        alt={alt}
        onError={(event) => {
          event.currentTarget.src = "/images/temporaryimg.png";
        }}
      />
    </span>
  );
}

export default function EnrolledCourses() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get("search") || "");
  const [dateSort, setDateSort] = useState("Recent");
  const [alphabeticalSort, setAlphabeticalSort] = useState("A to Z");

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [courseCode, setCourseCode] = useState("");

  const [openCourseMenu, setOpenCourseMenu] = useState(null);
  const [unenrollingCourseId, setUnenrollingCourseId] = useState(null);

  const loadEnrolledCourses = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const token = getStoredToken();

      if (!token) {
        throw new Error(
          "Your login session was not found. Please log in again.",
        );
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

      const loadedCourses = Array.isArray(data.courses)
        ? data.courses
        : Array.isArray(data.data)
          ? data.data
          : [];

      setCourses(loadedCourses.map(normalizeCourse));
    } catch (error) {
      console.error("Enrolled courses loading error:", error);
      setCourses([]);
      setErrorMessage(error.message || "Could not load enrolled courses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnrolledCourses();
  }, []);

  useEffect(() => {
    const closeCourseMenu = (event) => {
      if (!event.target.closest(".course-options-wrapper")) {
        setOpenCourseMenu(null);
      }
    };

    document.addEventListener("mousedown", closeCourseMenu);

    return () => {
      document.removeEventListener("mousedown", closeCourseMenu);
    };
  }, []);

  const closeJoinModal = () => {
    setJoinModalOpen(false);
    setCourseCode("");
  };

  const joinByCourseCode = async () => {
    try {
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
        course.id || course.courseId || course.course_id || course.code;

      if (joinedCourseId) {
        navigate(`/student/enrolled-courses/${joinedCourseId}`);
      } else {
        await loadEnrolledCourses();
      }
    } catch (error) {
      console.error("Join course error:", error);

      await Swal.fire({
        icon: "error",
        title: "Unable to Join Course",
        text: error?.message || "Unable to join the course.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    }
  };

  const handleUnenrollCourse = async (course) => {
    const courseId = course.id || course.code;
    const courseTitle = course.title || "this course";

    const result = await Swal.fire({
      title: "Unenroll from this course?",
      text: `${courseTitle} will be moved to Archived Classes.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, unenroll",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d93025",
      cancelButtonColor: "#858d9b",
      reverseButtons: true,
      customClass: {
        popup: "unenroll-swal-popup",
        title: "unenroll-swal-title",
        htmlContainer: "unenroll-swal-text",
        confirmButton: "unenroll-swal-confirm",
        cancelButton: "unenroll-swal-cancel",
      },
    });

    if (!result.isConfirmed) {
      setOpenCourseMenu(null);
      return;
    }

    try {
      setUnenrollingCourseId(courseId);
      setOpenCourseMenu(null);

      const token = getStoredToken();

      if (!token) {
        throw new Error(
          "Your login session was not found. Please log in again.",
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/courses/${courseId}/unenroll`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to unenroll from this course.");
      }

      setCourses((currentCourses) =>
        currentCourses.filter(
          (currentCourse) =>
            (currentCourse.id || currentCourse.code) !== courseId,
        ),
      );

      await Swal.fire({
        title: "Course archived",
        text: `${courseTitle} has been moved to Archived Classes.`,
        icon: "success",
        confirmButtonText: "Okay",
        confirmButtonColor: "#7FA8D6",
      });
    } catch (error) {
      console.error("Unenroll course error:", error);

      await Swal.fire({
        title: "Unable to unenroll",
        text: error.message || "Unable to unenroll from this course.",
        icon: "error",
        confirmButtonText: "Okay",
        confirmButtonColor: "#7FA8D6",
      });
    } finally {
      setUnenrollingCourseId(null);
    }
  };

  const visibleCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let result = courses.filter((course) => {
      if (!query) return true;

      return [
        course.title,
        course.code,
        course.instructor,
        course.professorDepartment,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    result = [...result].sort((a, b) => {
      const titleCompare = a.title.localeCompare(b.title);

      if (alphabeticalSort === "Z to A") {
        return -titleCompare;
      }

      return titleCompare;
    });

    result = result.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return dateSort === "Oldest" ? aTime - bTime : bTime - aTime;
    });

    return result;
  }, [courses, searchQuery, dateSort, alphabeticalSort]);

  return (
    <div className="enrolled-courses-page">
      <StudentSidebar />

      <div className="enrolled-courses-main-area">
        <StudentHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search your course"
          onJoinCourse={() => setJoinModalOpen(true)}
        />

        <main className="enrolled-courses-content">
          <section className="public-heading">
            <h1>Enrolled Courses</h1>

            <div className="filter-actions">
              <span className="sort-by-label">Sort by</span>

              <SortToggle
                options={["Recent", "Oldest"]}
                value={dateSort}
                onChange={setDateSort}
              />

              <SortToggle
                options={["A to Z", "Z to A"]}
                value={alphabeticalSort}
                onChange={setAlphabeticalSort}
              />
            </div>
          </section>

          <section className="courses-grid" aria-label="Enrolled courses">
            {loading ? (
              <div className="student-empty-state">
                Loading enrolled courses...
              </div>
            ) : errorMessage ? (
              <div className="student-empty-state">{errorMessage}</div>
            ) : visibleCourses.length === 0 ? (
              <div className="student-empty-state">
                {searchQuery
                  ? "No enrolled courses match your search."
                  : "No enrolled courses yet. Join by code or start a public course."}
              </div>
            ) : (
              visibleCourses.map((course) => {
                const courseId = course.id || course.code;
                const menuOpen = openCourseMenu === courseId;
                const isUnenrolling = unenrollingCourseId === courseId;

                return (
                  <div key={courseId} className="course-card-wrapper">
                    <Link
                      to={`/student/enrolled-courses/${courseId}`}
                      className="course-folder enrolled-course-folder"
                      aria-label={`Open ${course.title}`}
                    >
                      <div className="course-card-body">
                        <span className="course-code">{course.code}</span>

                        <h2 title={course.title}>{course.title}</h2>
                      </div>

                      <div className="course-card-footer">
                        <Avatar
                          src={
                            course.professorProfileImage
                              ? resolveProfileImage(
                                  course.professorProfileImage,
                                )
                              : undefined
                          }
                          alt={`${course.instructor}'s profile`}
                        />

                        <div className="enrolled-course-meta">
                          <span>{course.instructor}</span>
                          <small>{course.professorDepartment}</small>
                        </div>
                      </div>
                    </Link>

                    <div className="course-options-wrapper">
                      <button
                        type="button"
                        className={`course-menu-button ${
                          menuOpen ? "active" : ""
                        }`}
                        aria-label={`Options for ${course.title}`}
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          setOpenCourseMenu((current) =>
                            current === courseId ? null : courseId,
                          );
                        }}
                      >
                        <span />
                        <span />
                        <span />
                      </button>

                      {menuOpen && (
                        <div
                          className="course-options-menu"
                          role="menu"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="course-unenroll-button"
                            role="menuitem"
                            disabled={isUnenrolling}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleUnenrollCourse(course);
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M10 5H5v14h5" />
                              <path d="m14 8 4 4-4 4" />
                              <path d="M18 12H9" />
                            </svg>

                            <span>
                              {isUnenrolling ? "Unenrolling..." : "Unenroll"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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
