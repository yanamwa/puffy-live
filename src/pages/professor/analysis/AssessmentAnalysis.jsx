import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  fetchCourses,
  fetchCourseEnrollmentCount,
} from "../../../services/courseApi.js";
import {
  FiBookOpen,
  FiUsers,
  FiLayers,
  FiFileText,
  FiArrowRight,
  FiSearch,
} from "react-icons/fi";
import styles from "./AssessmentDashboard.module.css";
import ProfessorStudentPerformance from "./ProfessorStudentPerformance.jsx";
import { tutorialCourseExamples } from "../tutorial/professorTutorialExamples.js";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);

  return `${mm}-${dd}-${yy}`;
}

function getCourseCode(course, index) {
  return (
    course.code ||
    course.courseCode ||
    course.course_code ||
    `CRS${String(course.id || index + 1).padStart(3, "0")}`
  );
}

function normalizeCourse(course, index) {
  return {
    id: course.id || course.courseId || course.course_id || index + 1,
    code: getCourseCode(course, index),
    title:
      course.title ||
      course.courseName ||
      course.course_name ||
      "Untitled Course",
    description:
      course.summary ||
      course.description ||
      course.subject ||
      "Course details not available",
    students:
      course.students || course.studentCount || course.student_count || 0,
    modules:
      Number(
        course.moduleCount ??
          course.module_count ??
          course.contentModules?.length ??
          course.modules ??
          0,
      ) || 0,
    quizzes:
      Number(
        course.quizzes ??
          course.quizCount ??
          course.quiz_count ??
          (Array.isArray(course.quizItems) ? course.quizItems.length : 0),
      ) || 0,
    date: formatDate(
      course.createdAt ||
        course.created_at ||
        course.dateCreated ||
        course.updatedAt,
    ),
    raw: course,
  };
}

export default function AssessmentAnalysis() {
  const navigate = useNavigate();
  const { previewOnly, tutorialStep } = useOutletContext() ?? {};
  const tutorialOverview = tutorialStep?.id === "analysis";

  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(!previewOnly && !tutorialOverview);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (previewOnly || tutorialOverview) return;
    let active = true;

    async function loadCourses() {
      try {
        setLoading(true);
        setErrorMessage("");

        const loadedCourses = await fetchCourses({}, { fallback: false });
        const coursesWithEnrollments = await Promise.all(
          loadedCourses.map(async (course, index) => {
            const normalizedCourse = normalizeCourse(course, index);
            return {
              ...normalizedCourse,
              students: await fetchCourseEnrollmentCount(normalizedCourse.id),
            };
          }),
        );

        if (active) {
          setCourses(coursesWithEnrollments);
        }
      } catch (error) {
        if (active) {
          setCourses([]);
          setErrorMessage(error.message || "Could not load courses.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCourses();

    return () => {
      active = false;
    };
  }, [previewOnly, tutorialOverview]);

  const visibleCourses = useMemo(
    () =>
      tutorialOverview
        ? tutorialCourseExamples.map((course, index) => normalizeCourse(course, index))
        : courses,
    [courses, tutorialOverview],
  );

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return visibleCourses;

    return visibleCourses.filter((course) =>
      [course.code, course.title, course.description]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [visibleCourses, searchQuery]);

  const openAssessment = (course) => {
    navigate(`/professor/assessment/${course.id}`, {
      state: { course },
    });
  };

  const metrics = [
    {
      label: "Courses",
      value: visibleCourses.length,
      icon: FiBookOpen,
      hint: "Available for analysis",
    },
    {
      label: "Student enrollments",
      value: visibleCourses.reduce(
        (sum, course) => sum + Number(course.students || 0),
        0,
      ),
      icon: FiUsers,
      hint: "Across all courses",
    },
    {
      label: "Learning modules",
      value: visibleCourses.reduce((sum, course) => sum + course.modules, 0),
      icon: FiLayers,
      hint: "Across all courses",
    },
    {
      label: "Quiz questions",
      value: visibleCourses.reduce((sum, course) => sum + course.quizzes, 0),
      icon: FiFileText,
      hint: "Across all courses",
    },
  ];
  const enrollmentCourses = [...visibleCourses]
    .sort((a, b) => b.students - a.students)
    .slice(0, 5);
  const maxStudents = Math.max(
    1,
    ...enrollmentCourses.map((course) => course.students),
  );

  return (
    <section className={styles.page}>
      <header className={`${styles.header} professor-section-heading`}>
        <h1>Assessment Analysis</h1>
        <p>
          Review your courses at a glance, then open a course to explore student
          performance.
        </p>
      </header>
      {loading ? (
        <div className={styles.message} role="status">
          Loading assessment overview…
        </div>
      ) : errorMessage ? (
        <div className={styles.message} role="alert">
          {errorMessage}
        </div>
      ) : (
        <>
          <section className={styles.metrics} aria-label="Assessment summary">
            {metrics.map(({ label, value, icon: Icon, hint }) => (
              <article className={`${styles.metric} dashboard-summary-card`} key={label}>
                <div className="dashboard-summary-top">
                  <span className="dashboard-summary-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </div>
                <strong>{value.toLocaleString()}</strong>
                <small>{hint}</small>
              </article>
            ))}
          </section>
          <div className={styles.overviewGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Enrollment by course</h2>
                  <p>Your five largest classes</p>
                </div>
                <FiUsers aria-hidden="true" />
              </div>
              {enrollmentCourses.length ? (
                <div className={styles.bars}>
                  {enrollmentCourses.map((course) => (
                    <div className={styles.barRow} key={course.id}>
                      <div>
                        <span>{course.title}</span>
                        <strong>{course.students} students</strong>
                      </div>
                      <div className={styles.track}>
                        <span
                          style={{
                            width: `${(Number(course.students) / maxStudents) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No enrollment data yet.</p>
              )}
            </section>
          </div>
          <section className={styles.panel}>
            <div className={styles.tableHeading}>
              <div>
                <h2>Course overview</h2>
                <p>
                  {filteredCourses.length} of {visibleCourses.length} courses
                </p>
              </div>
              <label className={styles.searchBox}>
                <FiSearch aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search courses…"
                  aria-label="Search courses"
                />
              </label>
            </div>
            {filteredCourses.length ? (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Course</th>
                      <th scope="col">Students</th>
                      <th scope="col">Modules</th>
                      <th scope="col">Quiz questions</th>
                      <th scope="col">Created</th>
                      <th scope="col">Analysis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((course) => (
                      <tr key={course.id}>
                        <td data-label="Course">
                          <strong className={styles.courseTitle}>
                            {course.title}
                          </strong>
                          <span className={styles.courseCode}>
                            {course.code}
                          </span>
                        </td>
                        <td data-label="Students">
                          <span className={styles.countBadge}>
                            {course.students}
                          </span>
                        </td>
                        <td data-label="Modules">{course.modules}</td>
                        <td data-label="Quiz questions">{course.quizzes}</td>
                        <td data-label="Created">{course.date}</td>
                        <td data-label="Analysis">
                          <button
                            className={styles.viewButton}
                            type="button"
                            onClick={() => openAssessment(course)}
                            aria-label={`View analysis for ${course.title}`}
                          >
                            View analysis <FiArrowRight aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>
                {visibleCourses.length
                  ? "No courses match your search."
                  : "Your courses will appear here once you create a course."}
              </p>
            )}
          </section>
          {!tutorialOverview && <ProfessorStudentPerformance />}
        </>
      )}
    </section>
  );
}
