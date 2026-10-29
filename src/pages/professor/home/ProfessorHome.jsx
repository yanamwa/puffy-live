import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiFileText,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  PROFESSOR_COURSES_EVENT,
  readProfessorCourses,
} from "../professorData.js";
import { fetchCourses } from "../../../services/courseApi.js";
import { fetchCourseMonitoring } from "../../../services/monitoringApi.js";
import "../layout/ProfessorLayout.css";

const coursePerformanceSeed = {};
const fallbackSections = ["BSIT 1A", "BSIT 2B", "BSCS 3A", "BSIT 4A"];

function getProfessorName(user) {
  const rawName =
    user?.displayName ||
    user?.display_name ||
    user?.name ||
    localStorage.getItem("username") ||
    "Professor";

  return rawName.trim() || "Professor";
}

function getCourseId(course, index) {
  return String(
    course.id || course.course_id || course.code || `course-${index}`,
  );
}

function getCourseCode(course, index) {
  return (
    course.code ||
    course.course_code ||
    `CRS${String(index + 1).padStart(3, "0")}`
  );
}

function getCourseTitle(course) {
  return (
    course.title || course.courseName || course.course_name || "Untitled course"
  );
}

function getManageCoursePath(course) {
  const id = course.id || course.course_id;
  return id ? `/professor/courses/edit/${id}` : "/professor/courses";
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function createFallbackPerformance(course, index) {
  const students = Number(course.students || 0);
  const developing = Math.max(0, Math.round(students * 0.24));
  const beginning = Math.max(0, Math.round(students * 0.08));
  const advanced = Math.max(0, Math.round(students * 0.28));
  const proficient = Math.max(0, students - advanced - developing - beginning);

  return {
    section:
      course.section || fallbackSections[index % fallbackSections.length],
    averageQuizScore: clampPercent(
      course.averageQuizScore || course.quizAverage || 0,
    ),
    completionRate: clampPercent(
      course.completionRate || course.completion || course.progress || 0,
    ),
    averageMastery: clampPercent(
      course.averageMastery || course.masteryAverage || 0,
    ),
    mastery: {
      Advanced: advanced,
      Proficient: proficient,
      Developing: developing,
      Beginning: beginning,
    },
  };
}
function normalizeDashboardCourse(course, index) {
  const code = getCourseCode(course, index);
  const title = getCourseTitle(course);
  const performance =
    coursePerformanceSeed[code] || createFallbackPerformance(course, index);
  const modules = Number(
    course.modules || course.moduleCount || course.lessonPages?.length || 0,
  );
  const publishedQuizzes = Number(
    course.quizzes || course.publishedQuizzes || course.quizItems?.length || 0,
  );

  return {
    ...course,
    id: getCourseId(course, index),
    code,
    title,
    section: course.section || performance.section,
    students: Number(course.students || course.enrolledStudents || 0),
    modules,
    publishedQuizzes,
    averageQuizScore: clampPercent(
      course.averageQuizScore ??
        course.average_quiz_score ??
        course.quizAverage ??
        course.quiz_average ??
        performance.averageQuizScore,
    ),
    completionRate: clampPercent(
      course.completionRate ??
        course.completion_rate ??
        course.completion ??
        course.progress ??
        performance.completionRate,
    ),
    averageMastery: clampPercent(
      course.averageMastery ??
        course.average_mastery ??
        course.masteryAverage ??
        course.mastery_average ??
        performance.averageMastery,
    ),
    mastery:
      course.masteryDistribution || course.mastery || performance.mastery,
    support: [],
    managePath: getManageCoursePath(course),
  };
}
function readPercent(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const percent = Number(String(value).replace("%", ""));
    if (Number.isFinite(percent)) return clampPercent(percent);
  }

  return null;
}

function averagePercents(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value));

  if (!cleanValues.length) return null;

  return clampPercent(
    cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length,
  );
}

function getCourseMonitoringKey(course) {
  return String(
    course?.id ||
      course?.course_id ||
      course?.code ||
      course?.course_code ||
      "",
  );
}

function getCourseMonitoringRequestIds(course) {
  return [course?.id, course?.course_id, course?.code, course?.course_code]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function getMonitoringStudents(monitoring) {
  return Array.isArray(monitoring?.students) ? monitoring.students : [];
}

function getMonitoringTopics(monitoring) {
  return Array.isArray(monitoring?.topics) ? monitoring.topics : [];
}

function getMonitoringAssessments(monitoring) {
  return Array.isArray(monitoring?.assessments) ? monitoring.assessments : [];
}

function getStudentName(student) {
  return (
    student?.name ||
    student?.fullName ||
    student?.full_name ||
    student?.username ||
    student?.email ||
    "Unnamed student"
  );
}

function getStudentScore(student) {
  return readPercent(
    student?.latestScore,
    student?.latest_score,
    student?.score,
    student?.averageScore,
    student?.average_score,
    student?.quizScore,
    student?.quiz_score,
  );
}

function getStudentCompletion(student) {
  return readPercent(
    student?.completion,
    student?.progress,
    student?.moduleProgress,
    student?.module_progress,
    student?.progress_percent,
    student?.completionRate,
    student?.completion_rate,
  );
}

function getStudentConcern(student, completion, score) {
  if (student?.concern) return student.concern;
  if (student?.weakestTopic) return `Needs support in ${student.weakestTopic}`;
  if (student?.weakest_topic)
    return `Needs support in ${student.weakest_topic}`;
  if (completion !== null && completion < 55) return "Incomplete modules";
  if (score !== null && score < 60) return "Low mastery";

  return "Needs review";
}

function studentNeedsAttention(student) {
  const status = String(student?.status || "").toLowerCase();
  const score = getStudentScore(student);
  const completion = getStudentCompletion(student);

  return (
    status.includes("risk") ||
    status.includes("review") ||
    status.includes("attention") ||
    (score !== null && score < 75) ||
    (completion !== null && completion < 78)
  );
}

function buildMasteryDistribution(scores, fallbackMastery) {
  const cleanScores = scores.filter((score) => Number.isFinite(score));

  if (!cleanScores.length) {
    return (
      fallbackMastery || {
        Advanced: 0,
        Proficient: 0,
        Developing: 0,
        Beginning: 0,
      }
    );
  }

  return cleanScores.reduce(
    (mastery, score) => {
      if (score >= 90) mastery.Advanced += 1;
      else if (score >= 78) mastery.Proficient += 1;
      else if (score >= 60) mastery.Developing += 1;
      else mastery.Beginning += 1;

      return mastery;
    },
    {
      Advanced: 0,
      Proficient: 0,
      Developing: 0,
      Beginning: 0,
    },
  );
}

function applyMonitoringToCourse(course, monitoring) {
  const students = getMonitoringStudents(monitoring);
  const studentScores = students
    .map(getStudentScore)
    .filter((score) => score !== null);
  const studentCompletions = students
    .map(getStudentCompletion)
    .filter((completion) => completion !== null);
  const topicAverage = averagePercents(
    getMonitoringTopics(monitoring)
      .map((topic) => readPercent(topic.average, topic.score, topic.value))
      .filter((value) => value !== null),
  );
  const quizAverage = averagePercents(
    getMonitoringAssessments(monitoring)
      .filter((assessment) =>
        String(assessment.label || assessment.name || "")
          .toLowerCase()
          .includes("quiz"),
      )
      .map((assessment) => readPercent(assessment.value, assessment.average))
      .filter((value) => value !== null),
  );
  const averageScore = averagePercents(studentScores);
  const completionRate = averagePercents(studentCompletions);

  return {
    ...course,
    students: Number(course.students || students.length || 0),
    averageQuizScore: quizAverage ?? averageScore ?? course.averageQuizScore,
    completionRate: completionRate ?? course.completionRate,
    averageMastery: topicAverage ?? averageScore ?? course.averageMastery,
    mastery: buildMasteryDistribution(studentScores, course.mastery),
  };
}

function buildStudentsNeedingAttention(courses, monitoringByCourse) {
  return courses
    .flatMap((course) => {
      const monitoring = monitoringByCourse[getCourseMonitoringKey(course)];

      return getMonitoringStudents(monitoring)
        .filter(studentNeedsAttention)
        .map((student) => {
          const score = getStudentScore(student);
          const completion = getStudentCompletion(student);

          return {
            id: student.id || student.student_id || getStudentName(student),
            courseId: course.id,
            courseTitle: course.title,
            name: getStudentName(student),
            concern: getStudentConcern(student, completion, score),
            latestScore: score,
            sortScore: score ?? completion ?? 100,
          };
        });
    })
    .sort((first, second) => first.sortScore - second.sortScore)
    .slice(0, 5);
}

function getActivityTime(value) {
  if (!value) return "Recently";

  const rawValue = String(value);
  const relativeTimePattern = /(today|yesterday|ago|week|month|tomorrow)/i;

  if (relativeTimePattern.test(rawValue)) return rawValue;

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getActivitySortValue(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getCourseUpdatedAt(course) {
  return (
    course.updatedAt ||
    course.updated_at ||
    course.lastUpdated ||
    course.last_updated ||
    course.createdAt ||
    course.created_at ||
    course.date
  );
}

function getStudentLastActive(student) {
  return (
    student?.lastActive ||
    student?.last_active ||
    student?.lastActivity ||
    student?.last_activity ||
    student?.updatedAt ||
    student?.updated_at
  );
}

function buildActivityItems(courses, monitoringByCourse) {
  return courses
    .flatMap((course) => {
      const monitoring = monitoringByCourse[getCourseMonitoringKey(course)];
      const studentItems = getMonitoringStudents(monitoring)
        .map((student) => {
          const lastActive = getStudentLastActive(student);

          if (!lastActive) return null;

          return {
            icon: FiUsers,
            sortValue: getActivitySortValue(lastActive),
            time: getActivityTime(lastActive),
            text: `${getStudentName(student)} was active in ${course.title}.`,
          };
        })
        .filter(Boolean);

      const updatedAt = getCourseUpdatedAt(course);
      const status = String(course.status || "").toLowerCase();
      const courseAction = status === "published" ? "published" : "updated";

      return [
        ...studentItems,
        {
          icon: status === "published" ? FiCheckCircle : FiLayers,
          sortValue: getActivitySortValue(updatedAt),
          time: getActivityTime(updatedAt),
          text: `${course.title} was ${courseAction}.`,
        },
      ];
    })
    .sort((first, second) => second.sortValue - first.sortValue)
    .slice(0, 5);
}
export default function ProfessorHome() {
  const { user } = useAuth();
  const [storedCourses, setStoredCourses] = useState(() =>
    readProfessorCourses().filter((course) => !course.archived),
  );
  const [monitoringByCourse, setMonitoringByCourse] = useState({});

  useEffect(() => {
    let active = true;

    const loadCourses = async () => {
      try {
        const courses = await fetchCourses();

        if (active) {
          setStoredCourses(courses.filter((course) => !course.archived));
        }
      } catch (error) {
        console.error("Professor dashboard course load error:", error);
      }
    };

    const handleCoursesUpdated = (event) => {
      const nextCourses = Array.isArray(event.detail?.courses)
        ? event.detail.courses
        : readProfessorCourses();

      setStoredCourses(nextCourses.filter((course) => !course.archived));
    };

    loadCourses();
    window.addEventListener(PROFESSOR_COURSES_EVENT, handleCoursesUpdated);

    return () => {
      active = false;
      window.removeEventListener(PROFESSOR_COURSES_EVENT, handleCoursesUpdated);
    };
  }, []);

  const normalizedCourses = useMemo(() => {
    return storedCourses.map(normalizeDashboardCourse);
  }, [storedCourses]);

  useEffect(() => {
    if (normalizedCourses.length === 0) {
      setMonitoringByCourse({});
      return undefined;
    }

    let active = true;

    const loadMonitoring = async () => {
      const entries = await Promise.all(
        normalizedCourses.map(async (course) => {
          const key = getCourseMonitoringKey(course);
          const requestIds = getCourseMonitoringRequestIds(course);
          let lastError = null;

          for (const requestId of requestIds) {
            try {
              const monitoring = await fetchCourseMonitoring(requestId);
              return [key, monitoring];
            } catch (error) {
              lastError = error;
            }
          }

          if (lastError) {
            console.error(
              "Professor dashboard monitoring load error:",
              lastError,
            );
          }

          return [key, null];
        }),
      );

      if (!active) return;

      setMonitoringByCourse(
        Object.fromEntries(
          entries.filter(([key, monitoring]) => key && monitoring),
        ),
      );
    };

    loadMonitoring();

    return () => {
      active = false;
    };
  }, [normalizedCourses]);

  const dashboardCourses = useMemo(() => {
    return normalizedCourses.map((course) =>
      applyMonitoringToCourse(
        course,
        monitoringByCourse[getCourseMonitoringKey(course)],
      ),
    );
  }, [normalizedCourses, monitoringByCourse]);

  const overviewCourses = dashboardCourses.slice(0, 4);
  const studentsNeedingAttention = useMemo(
    () => buildStudentsNeedingAttention(dashboardCourses, monitoringByCourse),
    [dashboardCourses, monitoringByCourse],
  );
  const activityItems = useMemo(
    () => buildActivityItems(dashboardCourses, monitoringByCourse),
    [dashboardCourses, monitoringByCourse],
  );
  const professorName = getProfessorName(user);
  const professorGreeting =
    professorName.toLowerCase() === "professor"
      ? "Good morning, Professor"
      : `Good morning, Prof. ${professorName}`;
  const totalStudents = dashboardCourses.reduce(
    (sum, course) => sum + Number(course.students || 0),
    0,
  );
  const publishedQuizzes = dashboardCourses.reduce(
    (sum, course) => sum + Number(course.publishedQuizzes || 0),
    0,
  );

  const summaryCards = [
    {
      label: "Active Courses",
      value: dashboardCourses.length,
      href: "/professor/courses",
      link: "View courses",
      icon: FiBookOpen,
    },
    {
      label: "Total Students",
      value: totalStudents,
      href: "/professor/students",
      link: "View students",
      icon: FiUsers,
    },
    {
      label: "Published Quizzes",
      value: publishedQuizzes,
      href: "/professor/quizzes",
      link: "Review quizzes",
      icon: FiFileText,
    },
  ];

  return (
    <section className="professor-page professor-dashboard">
      <div className="dashboard-welcome">
        <div>
          <span className="dashboard-eyebrow">Professor Dashboard</span>
          <h1>{professorGreeting}</h1>
          <p>
            Manage your courses and monitor your students' learning progress.
          </p>
        </div>
      </div>

      <div className="dashboard-summary-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="dashboard-summary-card" key={card.label}>
              <div className="dashboard-summary-top">
                <span className="dashboard-summary-icon">
                  <Icon />
                </span>
                <span>{card.label}</span>
              </div>
              <strong>{card.value}</strong>
              <Link to={card.href}>
                {card.link}
                <FiArrowRight />
              </Link>
            </article>
          );
        })}
      </div>

      <section className="dashboard-panel dashboard-course-overview">
        <div className="dashboard-section-header">
          <div>
            <h2>Course Overview</h2>
            <p>Active classes and their learning progress.</p>
          </div>
          <Link to="/professor/courses">
            View All Courses
            <FiArrowRight />
          </Link>
        </div>

        <div className="dashboard-table-wrap">
          <table className="dashboard-course-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Section</th>
                <th>Students</th>
                <th>Modules</th>
                <th>Quizzes</th>
                <th>Mastery</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {overviewCourses.length === 0 ? (
                <tr className="dashboard-empty-row">
                  <td colSpan="7">No courses yet. Add a course to start.</td>
                </tr>
              ) : (
                overviewCourses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <strong>{course.title}</strong>
                      <span>{course.summary || course.section}</span>
                    </td>
                    <td>{course.section}</td>
                    <td>{course.students}</td>
                    <td>{course.modules}</td>
                    <td>{course.publishedQuizzes}</td>
                    <td>
                      <span className="dashboard-mastery-pill">
                        {course.averageMastery}%
                      </span>
                    </td>
                    <td>
                      <Link
                        className="dashboard-table-action"
                        to={`/professor/courses/view/${encodeURIComponent(course.id)}`}
                      >
                        View Students
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dashboard-main-grid attention-grid">
        <section className="dashboard-panel dashboard-attention">
          <div className="dashboard-section-header">
            <div>
              <h2>Students Needing Attention</h2>
              <p>
                Support signals from recent scores, module progress, and
                activity.
              </p>
            </div>
            <Link to="/professor/students">
              View Monitoring
              <FiArrowRight />
            </Link>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-attention-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Concern</th>
                  <th>Latest score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {studentsNeedingAttention.length === 0 ? (
                  <tr className="dashboard-empty-row">
                    <td colSpan="5">No student attention records yet.</td>
                  </tr>
                ) : (
                  studentsNeedingAttention.map((student) => (
                    <tr
                      key={`${student.courseId}-${student.id || student.name}`}
                    >
                      <td>{student.name}</td>
                      <td>{student.courseTitle}</td>
                      <td>{student.concern}</td>
                      <td>
                        {student.latestScore === null
                          ? "No score"
                          : `${student.latestScore}%`}
                      </td>
                      <td>
                        <Link
                          className="dashboard-table-action"
                          to="/professor/students"
                        >
                          View Progress
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="dashboard-panel dashboard-activity">
          <div className="dashboard-section-header compact">
            <div>
              <h2>Recent Course Activity</h2>
              <p>Latest teaching and class events.</p>
            </div>
            <Link to="/professor/notifications">
              View All Activity
              <FiArrowRight />
            </Link>
          </div>
          <div className="dashboard-timeline">
            {activityItems.length === 0 ? (
              <div className="dashboard-empty-state compact">
                No recent course activity yet.
              </div>
            ) : (
              activityItems.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div
                    className="dashboard-timeline-item"
                    key={`${activity.time}-${activity.text}`}
                  >
                    <span>
                      <Icon />
                    </span>
                    <div>
                      <p>{activity.text}</p>
                      <time>{activity.time}</time>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
