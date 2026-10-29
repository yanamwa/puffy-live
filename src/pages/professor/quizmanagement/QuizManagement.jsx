import ManagementBackBar from "../../../components/ManagementBackBar.jsx";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchCourses, fetchCourse } from "../../../services/courseApi.js";
import styles from "../analysis/AssessmentAnalysis.module.css";
import "./QuizManagement.css";
import assessmentStyles from "../coursemanagement/Addmodule.module.css";

export default function QuizManagement() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") || "";
  const [searchQuery, setSearchQuery] = useState("");
  const [courseLoading, setCourseLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetchCourses({}, { fallback: false })
      .then((items) => {
        if (active) setCourses(items);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setCourse(null);
    if (!courseId) {
      setCourseLoading(false);
      return;
    }
    setCourseLoading(true);
    setError("");
    fetchCourse(courseId)
      .then((item) => {
        if (active) setCourse(item);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setCourseLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);
  const modules =
    course?.contentModules ||
    course?.content_modules ||
    course?.learningModules ||
    course?.learning_modules ||
    [];
  return (
    <div className={`${styles.page} quiz-management`}>
      {courseId && (
        <ManagementBackBar onClick={() => setParams({})}>
          Back to courses
        </ManagementBackBar>
      )}
      <header className={`${styles.header} quiz-management-heading professor-section-heading`}>
        <h1>Quiz Management</h1>
        <p>Manage practice and main quizzes by course and module.</p>
      </header>
      {courseId && (
        <section className="quiz-course-heading" aria-label="Selected course">
          <h2 className="quiz-selected-course">{course?.title || course?.course_name || "Course quizzes"}</h2>
        </section>
      )}
      <section className={`${styles.courseArea} quiz-management-content`}>
        {error && <p role="alert">{error}</p>}
        {(courseId ? courseLoading : loading) ? (
          <p className={styles.message} role="status">
            Loading quizzes…
          </p>
        ) : !courseId ? (
          <div className={`${styles.courseGrid} quiz-management-course-grid`}>
            {courses
              .filter((item) =>
                [
                  item.title,
                  item.course_name,
                  item.code,
                  item.course_code,
                  item.summary,
                  item.description,
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(searchQuery.trim().toLowerCase()),
              )
              .map((item) => {
                const itemId = item.id || item.course_id;
                const dateValue =
                  item.createdAt ||
                  item.created_at ||
                  item.dateCreated ||
                  item.updatedAt;
                const date = dateValue ? new Date(dateValue) : null;
                const dateLabel =
                  date && !Number.isNaN(date.getTime())
                    ? `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getFullYear()).slice(-2)}`
                    : "—";
                return (
                  <button
                    type="button"
                    key={itemId}
                    className={styles.courseCard}
                    onClick={() => setParams({ course: String(itemId) })}
                  >
                    <span className={styles.dateText}>
                      Date created: {dateLabel}
                    </span>
                    <span className={styles.codeText}>
                      <span>Course Code:</span>{" "}
                      {item.code || item.course_code || "—"}
                    </span>
                    <strong>
                      {item.title || item.course_name || "Untitled Course"}
                    </strong>
                    <span className={styles.description}>
                      {item.summary || item.description || item.subject}
                    </span>
                    <span className={styles.divider} />
                    <span className={styles.stats}>
                      <span>
                        {item.moduleCount ??
                          item.module_count ??
                          item.contentModules?.length ??
                          item.modules ??
                          0}{" "}
                        Modules
                      </span>
                      <span>
                        {Array.isArray(item.quizItems)
                          ? item.quizItems.length
                          : (item.quizzes ??
                            item.quizCount ??
                            item.quiz_count ??
                            0)}{" "}
                        Quizzes
                      </span>
                    </span>
                  </button>
                );
              })}
            {!courses.some((item) =>
              [
                item.title,
                item.course_name,
                item.code,
                item.course_code,
                item.summary,
                item.description,
              ]
                .join(" ")
                .toLowerCase()
                .includes(searchQuery.trim().toLowerCase()),
            ) && (
              <p className={styles.message}>
                {courses.length
                  ? "No courses found."
                  : "Create a course and add a module to start managing quizzes."}
              </p>
            )}
          </div>
        ) : (
          course &&
          (modules.length ? (
            <div className="quiz-module-list">
              {modules.map((module, index) => {
                const moduleId =
                  module.id ||
                  module.lesson_id ||
                  module.module_id ||
                  `module-${index + 1}`;
                const path = `/professor/quizzes/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}`;
                return (
                  <section
                    className={`quiz-module-section ${assessmentStyles.quizManagementAssessments}`}
                    key={moduleId}
                  >
                    <div className="quiz-module-section-heading">
                      <div>
                        <h2>{module.title || `Module ${index + 1}`}</h2>
                        {module.description && <p>{module.description}</p>}
                      </div>
                    </div>
                    <div
                      className={`${assessmentStyles.moduleAssessmentGrid} quiz-management-folder-grid`}
                    >
                      <Link
                        className={`${assessmentStyles.moduleAssessmentCard} quiz-management-folder`}
                        state={{ courseDraft: course }}
                        to={`${path}/practice-quiz/edit`}
                        aria-label={`Edit Practice Quiz for ${module.title || `Module ${index + 1}`}`}
                      >
                        <span
                          className={`${assessmentStyles.assessmentFolderAccent} quiz-management-folder-accent`}
                          aria-hidden="true"
                        >
                          +
                        </span>
                        <div>
                          <h3>Practice Quiz</h3>
                          <p>
                            {Array.isArray(module.quizItems)
                              ? `${module.quizItems.length} Questions`
                              : "Practice questions"}
                          </p>
                          <p>Unlimited Attempts</p>
                        </div>
                        <div
                          className={`${assessmentStyles.assessmentCardFooter} quiz-management-folder-footer`}
                        >
                          <span
                            className={`${assessmentStyles.assessmentEditButton} quiz-management-edit-button`}
                          >
                            Edit Practice Quiz
                          </span>
                        </div>
                      </Link>
                      <Link
                        className={`${assessmentStyles.moduleAssessmentCard} quiz-management-folder`}
                        state={{ courseDraft: course }}
                        to={`${path}/main-quiz/edit`}
                        aria-label={`Edit Main Quiz for ${module.title || `Module ${index + 1}`}`}
                      >
                        <span
                          className={`${assessmentStyles.assessmentFolderAccent} quiz-management-folder-accent`}
                          aria-hidden="true"
                        >
                          +
                        </span>
                        <div>
                          <h3>Main Quiz</h3>
                          <p>Personalized Questions</p>
                          <p>Manage questions and student access</p>
                        </div>
                        <div
                          className={`${assessmentStyles.assessmentCardFooter} quiz-management-folder-footer`}
                        >
                          <span
                            className={`${assessmentStyles.assessmentEditButton} quiz-management-edit-button`}
                          >
                            Edit Main Quiz
                          </span>
                        </div>
                      </Link>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <p>
              This course has no modules yet. Add a module in{" "}
              <Link
                to={`/professor/courses/edit/${encodeURIComponent(courseId)}`}
              >
                Course Management
              </Link>
              .
            </p>
          ))
        )}
      </section>
    </div>
  );
}
