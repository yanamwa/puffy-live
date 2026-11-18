import ManagementBackBar from "../../../components/ManagementBackBar.jsx";
import { useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { fetchCourses, fetchCourse } from "../../../services/courseApi.js";
import { API_BASE } from "../../../config.js";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import { assessmentModules } from "../../../utils/assessmentModuleScope.js";
import styles from "../analysis/AssessmentAnalysis.module.css";
import "./QuizManagement.css";
import assessmentStyles from "../coursemanagement/Addmodule.module.css";
import {
  tutorialCourseDraft,
  tutorialCourseExamples,
} from "../tutorial/professorTutorialExamples.js";

function QuizModuleFolder({
  courseId,
  course,
  module,
  index,
  tutorialPreview,
}) {
  const moduleId =
    module.id || module.lesson_id || module.module_id || `module-${index + 1}`;
  const title = module.title || `Module ${index + 1}`;
  const description = Array.from(
    String(
      module.description || module.module_description || module.summary || "",
    ),
  );
  const descriptionPreview =
    description.length > 50
      ? `${description.slice(0, 50).join("").trimEnd()}...`
      : description.join("");
  const manualQuestions =
    module.mainQuizItems ||
    module.mainQuizSettings?.manualQuestions ||
    module.main_quiz_settings?.manualQuestions ||
    [];
  const storedCount = Array.isArray(manualQuestions)
    ? manualQuestions.length
    : 0;
  const loadConfig =
    !tutorialPreview &&
    Number.isSafeInteger(Number(courseId)) &&
    Number(courseId) > 0;
  const [questionCount, setQuestionCount] = useState(null);
  const [countLoading, setCountLoading] = useState(loadConfig);
  const [countError, setCountError] = useState(false);

  useEffect(() => {
    setQuestionCount(null);
    setCountError(false);
    setCountLoading(loadConfig);
    if (!loadConfig) return;
    const controller = new AbortController();
    fetch(
      `${API_BASE}/lessons/main-quiz/config/${encodeURIComponent(courseId)}/${encodeURIComponent(moduleId)}`,
      {
        credentials: "include",
        headers: lessonAuthHeaders(),
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error("Could not load question count.");
        const count = data.config?.questionCount;
        if (!controller.signal.aborted) {
          setQuestionCount(
            Number.isInteger(count) && count >= 0 ? count : null,
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCountError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCountLoading(false);
      });
    return () => controller.abort();
  }, [courseId, moduleId, loadConfig]);

  const count = storedCount || questionCount || 0;
  const mainQuizPath = `/professor/quizzes/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/main-quiz/edit${tutorialPreview && index === 0 ? "?tutorial=quiz-settings" : ""}`;

  return (
    <Link
      className={`${assessmentStyles.moduleAssessmentCard} quiz-management-folder`}
      data-tutorial={
        tutorialPreview && index === 0 ? "quiz-management-main-quiz" : undefined
      }
      state={{ courseDraft: course }}
      to={mainQuizPath}
      aria-label={`Edit Main Quiz for ${title}`}
    >
      <div>
        <h3>{title}</h3>
        {descriptionPreview && <p>{descriptionPreview}</p>}
      </div>
      <div
        className={`${assessmentStyles.assessmentCardFooter} quiz-management-folder-footer`}
      >
        <span className="quiz-management-question-count">
          {countLoading && !storedCount
            ? "Loading questions..."
            : countError && !storedCount
              ? "Question count unavailable"
              : `${count} ${count === 1 ? "Question" : "Questions"}`}
        </span>
        <span
          className={`${assessmentStyles.assessmentEditButton} quiz-management-edit-button`}
        >
          Edit Main Quiz
        </span>
      </div>
    </Link>
  );
}

export default function QuizManagement() {
  const { previewOnly, tutorialStep } = useOutletContext() ?? {};
  const tutorialCourseList = tutorialStep?.id === "quiz-management";
  const tutorialModuleList = tutorialStep?.id === "quiz-module";
  const tutorialPreview = tutorialCourseList || tutorialModuleList;
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") || "";
  const [searchQuery, setSearchQuery] = useState("");
  const [courseLoading, setCourseLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(!previewOnly && !tutorialPreview);
  const [error, setError] = useState("");
  useEffect(() => {
    if (previewOnly || tutorialPreview) return;
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
  }, [previewOnly, tutorialPreview]);
  useEffect(() => {
    let active = true;
    setCourse(null);
    if (previewOnly || tutorialPreview || !courseId) {
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
  }, [courseId, previewOnly, tutorialPreview]);
  const visibleCourses = tutorialCourseList
    ? tutorialCourseExamples.slice(0, 1)
    : courses;
  const selectedCourse = tutorialModuleList ? tutorialCourseDraft : course;
  const modules = assessmentModules(selectedCourse);
  return (
    <div className="quiz-management">
      {courseId && (
        <ManagementBackBar onClick={() => setParams({})}>
          Back to courses
        </ManagementBackBar>
      )}
      <header className="quiz-management-heading professor-section-heading professor-management-heading">
        <div>
          <h1>Quiz Management</h1>
          <p>
            Manage Main Quizzes by course and module. The system creates
            adaptive practice for each student.
          </p>
        </div>
      </header>
      {courseId && (
        <section className="quiz-course-heading" aria-label="Selected course">
          <h2 className="quiz-selected-course">
            {selectedCourse?.title ||
              selectedCourse?.course_name ||
              "Course quizzes"}
          </h2>
        </section>
      )}
      <section
        className="quiz-management-content"
        data-tutorial="quiz-management-courses"
      >
        {error && <p role="alert">{error}</p>}
        {(courseId ? courseLoading : loading) ? (
          <p className={styles.message} role="status">
            Loading quizzes…
          </p>
        ) : !courseId ? (
          <div className={`${styles.courseGrid} quiz-management-course-grid`}>
            {visibleCourses
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
                const moduleCount =
                  item.moduleCount ??
                  item.module_count ??
                  item.contentModules?.length ??
                  item.content_modules?.length ??
                  item.learningModules?.length ??
                  item.learning_modules?.length ??
                  item.modules ??
                  0;
                const description = Array.from(
                  String(
                    item.summary || item.description || item.subject || "",
                  ),
                );
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
                    className={`${styles.courseCard} quiz-course-envelope`}
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
                      {description.length > 50
                        ? `${description.slice(0, 50).join("").trimEnd()}...`
                        : description.join("")}
                    </span>
                    <span className={styles.divider} />
                    <span className={styles.stats}>
                      <span>{moduleCount} Modules</span>
                      <span>
                        {moduleCount} Main{" "}
                        {moduleCount === 1 ? "Quiz" : "Quizzes"}
                      </span>
                    </span>
                  </button>
                );
              })}
            {!visibleCourses.some((item) =>
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
          selectedCourse &&
          (modules.length ? (
            <div
              className={`${assessmentStyles.quizManagementAssessments} quiz-module-list`}
              data-tutorial="quiz-management-modules"
            >
              {modules.map((module, index) => (
                <QuizModuleFolder
                  key={
                    module.id ||
                    module.lesson_id ||
                    module.module_id ||
                    `module-${index + 1}`
                  }
                  courseId={courseId}
                  course={selectedCourse}
                  module={module}
                  index={index}
                  tutorialPreview={tutorialModuleList}
                />
              ))}
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
