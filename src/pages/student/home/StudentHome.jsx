import RecentMainQuizResults from "../../../components/students/RecentMainQuizResults.jsx";
import {
  calendarDateKey,
  eventsOnDate,
} from "../../../services/academicCalendarDates.js";
import {
  StudentAcademicCalendar,
  useAcademicCalendars,
} from "../../../components/academicCalendar/AcademicCalendar.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import StudentSidebar from "../../../components/students/StudentSidebar";
import StudentHeader from "../../../components/students/StudentHeader";
import JoinCourseModal from "../courses/JoinCourseModal.jsx";
import {
  enrollStudentInCourseAsync,
  findJoinableCourseByCodeAsync,
} from "../courses/studentCourseData.js";

import "./StudentHome.css";

import { API_BASE as API_BASE_URL } from "../../../config.js";

const DEFAULT_PROFILE_IMAGE = "/images/temporary profile.jpg";

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

function getStoredUser() {
  try {
    const stored =
      localStorage.getItem("puffy-user") ||
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("user") ||
      sessionStorage.getItem("currentUser");

    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Unable to read stored user:", error);
    return null;
  }
}

function saveUpdatedUser(user) {
  if (!user) return;

  const value = JSON.stringify(user);

  localStorage.setItem("puffy-user", value);
  localStorage.setItem("user", value);
  localStorage.setItem("currentUser", value);

  if (sessionStorage.getItem("user")) {
    sessionStorage.setItem("user", value);
  }

  if (sessionStorage.getItem("currentUser")) {
    sessionStorage.setItem("currentUser", value);
  }

  window.dispatchEvent(new CustomEvent("puffy-user-updated", { detail: user }));
}

function resolveProfileImage(imagePath) {
  if (!imagePath) return DEFAULT_PROFILE_IMAGE;

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

function normalizeCourse(course) {
  const title =
    course.title ||
    course.courseName ||
    course.course_name ||
    course.name ||
    "Untitled course";

  return {
    id:
      course.id ||
      course.courseId ||
      course.course_id ||
      course.courseCode ||
      course.course_code,
    code: course.code || course.courseCode || course.course_code || "COURSE",
    title,
    professorName:
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
      "",
    professorProfileImage:
      course.professorProfileImage ||
      course.professor_profile_image ||
      course.database_professor_profile_image ||
      course.professorAvatar ||
      course.professor_avatar ||
      "",
  };
}

function ProfessorAvatar({ src, alt = "Professor" }) {
  return (
    <span className="home-professor-avatar">
      <img
        src={src || DEFAULT_PROFILE_IMAGE}
        alt={alt}
        onError={(event) => {
          event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
        }}
      />
    </span>
  );
}

export default function StudentHome() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [courseCode, setCourseCode] = useState("");

  const [shownMonth, setShownMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const academicCalendars = useAcademicCalendars();
  const [academicCalendarId, setAcademicCalendarId] = useState(null);
  const activeAcademicCalendar =
    academicCalendars.records.find(
      (record) => record.calendar_id === academicCalendarId,
    ) || academicCalendars.records[0];

  const todoStorageKey = useMemo(() => {
    const user = getStoredUser();
    return `student-todos-${
      user?.userId || user?.id || user?.email || "guest"
    }`;
  }, []);

  const [todos, setTodos] = useState(() => {
    try {
      const user = getStoredUser();
      const key = `student-todos-${
        user?.userId || user?.id || user?.email || "guest"
      }`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newTodo, setNewTodo] = useState("");

  useEffect(() => {
    localStorage.setItem(todoStorageKey, JSON.stringify(todos));
  }, [todos, todoStorageKey]);

  const calendarDays = useMemo(() => {
    const year = shownMonth.getFullYear();
    const month = shownMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return [
      ...Array.from({ length: firstDay }, (_, index) => ({
        key: `blank-${index}`,
        blank: true,
      })),
      ...Array.from({ length: daysInMonth }, (_, index) => ({
        key: `${year}-${month}-${index + 1}`,
        date: new Date(year, month, index + 1),
        day: index + 1,
      })),
    ];
  }, [shownMonth]);

  const monthLabel = shownMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  }).replace(/\s+/g, "");

  const displayName =
    currentUser?.displayName ||
    currentUser?.display_name ||
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.full_name ||
    currentUser?.username ||
    "Student";

  const yearLevel =
    currentUser?.yearLevel ||
    currentUser?.year_level ||
    currentUser?.year ||
    "";

  const sectionName =
    currentUser?.sectionName ||
    currentUser?.section_name ||
    currentUser?.section ||
    "";

  const studentInformation =
    [yearLevel, sectionName].filter(Boolean).join(" • ") ||
    "Student information not set";

  const profileImage = resolveProfileImage(
    currentUser?.profileImage ||
      currentUser?.profile_image ||
      currentUser?.avatar ||
      currentUser?.image ||
      "",
  );

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setDashboardLoading(true);
        setDashboardError("");

        const token = getStoredToken();

        if (!token) {
          throw new Error(
            "Your login session was not found. Please log in again.",
          );
        }

        try {
          const response = await fetch(
            `${API_BASE_URL}/courses/enrolled?summaryOnly=true`,
            {
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
          console.error("Enrolled courses loading error:", error);
          if (active) setEnrolledCourses([]);
        }

        try {
          const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.message || "Failed to load your account information.",
            );
          }

          const user = data.user || data.data?.user || data.data || data;

          if (active && user) {
            setCurrentUser(user);
            saveUpdatedUser(user);
          }
        } catch (error) {
          console.error("Student account loading error:", error);
        }
      } catch (error) {
        console.error("Student dashboard loading error:", error);
        if (active) {
          setDashboardError(error.message || "Could not load your dashboard.");
        }
      } finally {
        if (active) setDashboardLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUserUpdated = (event) => {
      const user = event.detail || getStoredUser();
      if (user) setCurrentUser(user);
    };

    const handleStorageUpdate = (event) => {
      if (!["puffy-user", "user", "currentUser"].includes(event.key)) return;

      const user = getStoredUser();
      if (user) setCurrentUser(user);
    };

    window.addEventListener("puffy-user-updated", handleUserUpdated);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener("puffy-user-updated", handleUserUpdated);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  const visibleHomeCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return enrolledCourses.slice(0, 3);

    return enrolledCourses
      .filter((course) =>
        [
          course.code,
          course.title,
          course.professorName,
          course.professorDepartment,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
      .slice(0, 3);
  }, [enrolledCourses, searchQuery]);

  const shiftMonth = (amount) => {
    setShownMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  };

  const addTodo = () => {
    const text = newTodo.trim();
    if (!text) return;

    setTodos((current) => [...current, { id: Date.now(), text, done: false }]);
    setNewTodo("");
  };

  const toggleTodo = (id) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    );
  };

  const removeTodo = (id) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  };

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

      const courseId =
        course.id || course.courseId || course.course_id || course.code;

      navigate(`/student/enrolled-courses/${courseId}`);
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

  const openCourse = (course) => {
    navigate(`/student/enrolled-courses/${course.id}`);
  };

  return (
    <div className="student-home-page">
      <StudentSidebar />

      <div className="student-home-main-area">
        <StudentHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search your course"
          onJoinCourse={() => setJoinModalOpen(true)}
        />

        <div className="student-home-body">
          <main className="student-home-content">
            <section className="home-welcome-card">
              <div>
                <p className="home-eyebrow">Student dashboard</p>
                <h1>Hello, {displayName}!</h1>
                <p className="home-welcome-description">
                  Continue learning and improve your mastery at your own pace.
                </p>

                {dashboardError && (
                  <p className="dashboard-error-message">{dashboardError}</p>
                )}
              </div>
            </section>

            <section
              className="home-section"
              aria-labelledby="continue-quizzes-title"
            >
              <div className="home-section-header">
                <h2 id="continue-quizzes-title">Continue your quizzes</h2>
                <Link to="/student/enrolled-courses">See all quizzes →</Link>
              </div>

              <div className="home-course-grid">
                {dashboardLoading ? (
                  <div className="home-empty-state">
                    Loading your enrolled courses...
                  </div>
                ) : visibleHomeCourses.length === 0 ? (
                  <div className="home-empty-state">
                    {searchQuery.trim()
                      ? "No matching courses found."
                      : "You are not enrolled in any courses yet."}
                  </div>
                ) : (
                  visibleHomeCourses.map((course) => (
                    <article
                      key={course.id}
                      className="home-course-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => openCourse(course)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openCourse(course);
                        }
                      }}
                    >
                      <div className="home-course-card-body">
                        <span className="home-course-code">{course.code}</span>
                        <h3>{course.title}</h3>
                      </div>

                      <div className="home-course-card-footer">
                        <ProfessorAvatar
                          src={
                            course.professorProfileImage
                              ? resolveProfileImage(
                                  course.professorProfileImage,
                                )
                              : undefined
                          }
                          alt={`${course.professorName}'s profile`}
                        />

                        <div className="home-course-professor">
                          <span>{course.professorName}</span>
                          <small>
                            {course.professorDepartment || "Department not set"}
                          </small>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <RecentMainQuizResults />
          </main>

          <aside className="student-home-profile-panel">
            <div className="home-profile-summary">
              <span className="home-profile-avatar">
                <img
                  src={profileImage}
                  alt={`${displayName}'s profile`}
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                />
              </span>

              <strong>{displayName}</strong>
              <span className="home-student-information">
                {studentInformation}
              </span>

              <Link to="/student/profile" className="home-profile-button">
                Profile
              </Link>
            </div>

            <section className="home-mini-calendar">
              <div className="home-calendar-header">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                >
                  ‹
                </button>

                <h2>{monthLabel}</h2>

                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="home-calendar-weekdays">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>

              <div className="home-calendar-grid">
                {calendarDays.map((item) =>
                  item.blank ? (
                    <span key={item.key} className="home-calendar-blank" />
                  ) : (
                    <button
                      key={item.key}
                      type="button"
                      className={[
                        item.date.toDateString() === selectedDate.toDateString()
                          ? "selected"
                          : "",
                        eventsOnDate(
                          activeAcademicCalendar?.events,
                          calendarDateKey(item.date),
                        ).length
                          ? "academic-event-day"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={[
                        item.date.toLocaleDateString("en-US"),
                        ...eventsOnDate(
                          activeAcademicCalendar?.events,
                          calendarDateKey(item.date),
                        ).map((event) => event.title),
                      ].join(": ")}
                      onClick={() => setSelectedDate(item.date)}
                    >
                      {item.day}
                    </button>
                  ),
                )}
              </div>
              <StudentAcademicCalendar
                records={academicCalendars.records}
                selected={activeAcademicCalendar}
                onSelect={setAcademicCalendarId}
                date={selectedDate}
                month={shownMonth}
                onShift={shiftMonth}
                onDateSelect={setSelectedDate}
                error={academicCalendars.error}
                loading={academicCalendars.loading}
                onRetry={academicCalendars.reload}
              />
            </section>

            <section className="home-todo-card">
              <div className="home-todo-header">
                <h2>To do list</h2>

                <button
                  type="button"
                  className="home-todo-add-button"
                  onClick={addTodo}
                  aria-label="Add task"
                >
                  +
                </button>
              </div>

              <div className="home-todo-add-row">
                <input
                  type="text"
                  value={newTodo}
                  placeholder="new task"
                  onChange={(event) => setNewTodo(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addTodo();
                  }}
                />
              </div>

              <div className="home-todo-list">
                {todos.length === 0 ? (
                  <div className="home-todo-empty">
                    No tasks yet. Add your first task.
                  </div>
                ) : (
                  todos.map((todo) => (
                    <label
                      key={todo.id}
                      className={`home-todo-item ${todo.done ? "done" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => toggleTodo(todo.id)}
                      />

                      <span>{todo.text}</span>

                      <button
                        type="button"
                        onClick={() => removeTodo(todo.id)}
                        aria-label={`Remove ${todo.text}`}
                      >
                        ×
                      </button>
                    </label>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
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
