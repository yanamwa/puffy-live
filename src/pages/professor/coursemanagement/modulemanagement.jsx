import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  archiveCourseById,
  fetchCourses,
  fetchCourseEnrollmentCount,
} from "../../../services/courseApi.js";
import styles from "./modulemanage.module.css";
import Swal from "sweetalert2";

function formatCourseId(course) {
  return course.code || `CRS${String(course.id).slice(-3).padStart(3, "0")}`;
}

export default function ModuleManagement() {
  const navigate = useNavigate();
  const location = useLocation();

  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get("search") || "");
  useEffect(() => { setSearchQuery(new URLSearchParams(location.search).get("search") || ""); }, [location.search]);
  const [courseView, setCourseView] = useState("active");
  const [rowsToShow, setRowsToShow] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /* =========================================
     LOAD COURSES
  ========================================= */

  useEffect(() => {
    let active = true;

    let loadingCourses = false;
    async function loadCourses(initial = false) {
      if (loadingCourses) return;
      loadingCourses = true;
      try {
        if (initial) setLoading(true);
        setErrorMessage("");

        const loadedCourses = await fetchCourses(
          { includeArchived: true },
          { fallback: false },
        );
        const coursesWithEnrollments = await Promise.all(
          loadedCourses.map(async (course) => ({
            ...course,
            students: await fetchCourseEnrollmentCount(
              course.id ?? course.course_id,
            ),
          })),
        );

        if (active) {
          setCourses(coursesWithEnrollments);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error.message || "Could not load courses.");
        }
      } finally {
        loadingCourses = false;
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCourses(true);
    const refresh = () => loadCourses();
    window.addEventListener("focus", refresh);
    window.addEventListener("puffy-catalog-updated", refresh);
    const timer = window.setInterval(refresh, 30000);

    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("puffy-catalog-updated", refresh);
      window.clearInterval(timer);
    };
  }, []);

  /* =========================================
     RESET PAGE WHEN SEARCH / ROWS CHANGES
  ========================================= */

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rowsToShow, courseView]);

  /* =========================================
     FILTER COURSES
  ========================================= */

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return courses
      .filter((course) => {
        if (courseView === "archived") {
          return Boolean(course.archived);
        }

        return !course.archived;
      })
      .filter((course) => {
        if (!query) {
          return true;
        }

        return [
          course.title,
          course.code,
          course.summary,
          course.visibility,
          course.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [courses, searchQuery, courseView]);

  /* =========================================
     PAGINATION
  ========================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCourses.length / rowsToShow),
  );

  const shownCourses = filteredCourses.slice(
    (currentPage - 1) * rowsToShow,
    currentPage * rowsToShow,
  );

  /* =========================================
     OPEN COURSE
  ========================================= */

  const openCourse = (courseId) => {
    navigate(`/professor/courses/view/${courseId}`);
  };

  /* =========================================
     ARCHIVE COURSE
  ========================================= */

  const archiveCourse = async (course) => {
    const result = await Swal.fire({
      title: "Archive Course?",
      text: `"${course.title}" will be moved to Archived Courses.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Archive",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await archiveCourseById(course.id, true);

      setCourses((current) =>
        current.map((item) =>
          String(item.id) === String(course.id)
            ? {
                ...item,
                archived: true,
              }
            : item,
        ),
      );

      await Swal.fire({
        title: "Course Archived",
        text: `"${course.title}" was archived successfully.`,
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#7fa9d6",
      });
    } catch (error) {
      await Swal.fire({
        title: "Archive Failed",
        text: error.message || "Could not archive the course.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#7fa9d6",
      });
    }
  };

  const restoreCourse = async (course) => {
    const result = await Swal.fire({
      title: "Restore Course?",
      text: `"${course.title}" will be moved back to Active Courses.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Restore",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#7fa9d6",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await archiveCourseById(course.id, false);

      setCourses((current) =>
        current.map((item) =>
          String(item.id) === String(course.id)
            ? {
                ...item,
                archived: false,
              }
            : item,
        ),
      );

      await Swal.fire({
        title: "Course Restored",
        text: `"${course.title}" is now available under Active Courses.`,
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#7fa9d6",
      });
    } catch (error) {
      await Swal.fire({
        title: "Restore Failed",
        text: error.message || "Could not restore the course.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#7fa9d6",
      });
    }
  };

  /* =========================================
     PAGE
  ========================================= */

  return (
    <section className={styles.modulePage}>
      {/* =====================================
          PAGE HEADER
      ====================================== */}

      <div className={`${styles.pageTop} professor-section-heading`}>
        <div className={styles.titleSection}>
          <h1 className={styles.pageTitle}>Course Management</h1>

          <p>Create and manage courses for your students.</p>
        </div>

        <button
          type="button"
          className={styles.addBtn}
          onClick={() => navigate("/professor/courses/new")}
        >
          + Add new course
        </button>
      </div>

      {/* =====================================
          SEARCH
      ====================================== */}

      <div className={styles.courseToolbar}>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search courses..."
          aria-label="Search courses"
        />

        <div className={styles.courseViewToggle}>
          <button
            type="button"
            className={courseView === "active" ? styles.courseViewActive : ""}
            onClick={() => setCourseView("active")}
          >
            Active
          </button>

          <button
            type="button"
            className={courseView === "archived" ? styles.courseViewActive : ""}
            onClick={() => setCourseView("archived")}
          >
            Archived
          </button>
        </div>
      </div>

      {/* =====================================
          COURSE CARD AREA
      ====================================== */}

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.emptyState}>Loading courses...</div>
        ) : errorMessage ? (
          <div className={styles.emptyState}>{errorMessage}</div>
        ) : shownCourses.length === 0 ? (
          <div className={styles.emptyState}>No courses found.</div>
        ) : (
          <div className={styles.moduleGrid}>
            {shownCourses.map((course) => (
              <article
                key={course.id}
                className={styles.moduleBox}
                role="button"
                tabIndex={0}
                onClick={() => openCourse(course.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();

                    openCourse(course.id);
                  }
                }}
              >
                {/* =========================
                    CARD TOP
                ========================== */}

                <div className={styles.moduleBoxTop}>
                  <span className={styles.courseCode}>
                    {formatCourseId(course)}
                  </span>

                  <div className={styles.moduleBadges}>
                    <span
                      className={
                        course.status === "published"
                          ? styles.statusActive
                          : styles.statusInactive
                      }
                    >
                      {course.status === "published" ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>

                {/* =========================
                    COURSE INFORMATION
                ========================== */}

                <h2>{course.title || "Untitled Course"}</h2>

                <p>{course.summary || "No course description yet."}</p>

                {/* =========================
                    COURSE STATS
                ========================== */}

                <div className={styles.courseStats}>
                  <span>
                    {course.students} students
                  </span>

                  <span>
                    {course.moduleCount || course.modules || 0} modules
                  </span>

                  <span>
                    {course.lessonPageCount || course.lessonPages?.length || 0}{" "}
                    pages
                  </span>

                  <span>
                    {course.quizzes || course.quizCount || 0} quiz items
                  </span>
                </div>

                {/* =========================
                    COURSE META
                ========================== */}

                <div className={styles.courseMeta}>
                  Date created:{" "}
                  {course.createdAt ||
                    course.updatedAt ||
                    course.dateCreated ||
                    "N/A"}
                </div>

                <div className={styles.courseMeta}>
                  {course.status === "published"
                    ? "Visible to students in Public Courses"
                    : "Draft — hidden from students"}
                </div>

                {/* =========================
                    ACTION BUTTONS
                ========================== */}

                {courseView === "active" ? (
                  <>
                    <button
                      type="button"
                      className={styles.actionEdit}
                      onClick={(event) => {
                        event.stopPropagation();

                        navigate(`/professor/courses/edit/${course.id}`);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className={styles.actionDelete}
                      onClick={(event) => {
                        event.stopPropagation();
                        archiveCourse(course);
                      }}
                    >
                      Archive
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.actionRestore}
                    onClick={(event) => {
                      event.stopPropagation();
                      restoreCourse(course);
                    }}
                  >
                    Restore
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {/* =================================
            PAGINATION
        ================================== */}

        <div className={styles.paginationWrapper}>
          <div className={styles.paginationCenter}>
            <button
              type="button"
              className={styles.navBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              {"<"}
            </button>

            {Array.from(
              {
                length: totalPages,
              },
              (_, index) => index + 1,
            ).map((page) => (
              <button
                key={page}
                type="button"
                className={`${styles.pageBtn} ${
                  currentPage === page ? styles.pageActive : ""
                }`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              className={styles.navBtn}
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            >
              {">"}
            </button>
          </div>

          {/* ===============================
              ROW CONTROL
          ================================ */}

          <div className={styles.rowsControl}>
            <span>Show</span>

            <select
              value={rowsToShow}
              onChange={(event) => setRowsToShow(Number(event.target.value))}
            >
              <option value={10}>10</option>

              <option value={20}>20</option>

              <option value={50}>50</option>
            </select>

            <span>Row</span>
          </div>
        </div>
      </div>
    </section>
  );
}
