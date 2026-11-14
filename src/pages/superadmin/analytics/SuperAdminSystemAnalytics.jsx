import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import {
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiFileText,
  FiTarget,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";

import { API_BASE } from "../../../config.js";

import "./SuperAdminSystemAnalytics.css";

/* =====================================================
   HELPERS
===================================================== */

function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return numberValue(value).toLocaleString();
}

function formatPercent(value) {
  return `${Math.round(numberValue(value) * 10) / 10}%`;
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, numberValue(value)));
}

/* =====================================================
   SYSTEM ANALYTICS PAGE
===================================================== */

export default function SuperAdminSystemAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  /* ===================================================
     LOAD ANALYTICS
  =================================================== */

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setLoadError(false);

        const token = getAuthToken();

        const response = await fetch(`${API_BASE}/analytics/system`, {
          method: "GET",

          credentials: "include",

          headers: {
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
        });

        const data = await response.json().catch(() => ({
          success: false,
          message: "Server returned an invalid response.",
        }));

        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Failed to load system analytics.");
        }

        if (active) {
          setAnalytics(data);
        }
      } catch (error) {
        console.error("System analytics load error:", error);

        if (active) {
          setAnalytics(null);
          setLoadError(true);

          await Swal.fire({
            icon: "error",
            title: "Analytics Unavailable",
            text: error.message || "System analytics could not be loaded.",
            confirmButtonText: "OK",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

  /* ===================================================
     REAL OVERVIEW DATA
  =================================================== */

  const systemAnalyticsOverview = useMemo(() => {
    if (!analytics) {
      return [];
    }

    return [
      {
        label: "Total Users",

        value: formatNumber(analytics.overview?.totalUsers),

        detail: "Registered PuffyBrain accounts",

        icon: FiUsers,
      },

      {
        label: "Active Users",

        value: formatNumber(analytics.overview?.activeUsers),

        detail: "Users active within the last 7 days",

        icon: FiActivity,
      },

      {
        label: "Total Courses",

        value: formatNumber(analytics.overview?.totalCourses),

        detail: "Courses created in PuffyBrain",

        icon: FiBookOpen,
      },

      {
        label: "Quiz Attempts",

        value: formatNumber(analytics.overview?.quizAttempts),

        detail: "Recorded quiz attempts",

        icon: FiBarChart2,
      },
    ];
  }, [analytics]);

  /* ===================================================
     REAL ANALYTICS SECTIONS
  =================================================== */

  const systemAnalyticsSections = useMemo(() => {
    if (!analytics) {
      return [];
    }

    const users = analytics.users || {};

    const courses = analytics.courses || {};

    const quizzes = analytics.quizzes || {};

    const learning = analytics.learning || {};

    /* -------------------------------------------------
       USER BAR CALCULATIONS
    ------------------------------------------------- */

    const activeAccounts = numberValue(users.activeAccounts);

    const studentShare =
      activeAccounts > 0
        ? (numberValue(users.students) / activeAccounts) * 100
        : 0;

    const professorShare =
      activeAccounts > 0
        ? (numberValue(users.professors) / activeAccounts) * 100
        : 0;

    const administratorShare =
      activeAccounts > 0
        ? (numberValue(users.administrators) / activeAccounts) * 100
        : 0;

    /* -------------------------------------------------
       QUIZ BAR CALCULATIONS
    ------------------------------------------------- */

    const totalStudents = numberValue(users.students);

    const quizParticipation =
      totalStudents > 0
        ? (numberValue(quizzes.studentsWithAttempts) / totalStudents) * 100
        : 0;

    const weeklyQuizParticipation =
      totalStudents > 0
        ? (numberValue(quizzes.studentsThisWeek) / totalStudents) * 100
        : 0;

    /* -------------------------------------------------
       LEARNING BAR CALCULATIONS
    ------------------------------------------------- */

    const learningParticipation =
      totalStudents > 0
        ? (numberValue(learning.studentsWithProgress) / totalStudents) * 100
        : 0;

    const masteryRate =
      totalStudents > 0
        ? (numberValue(learning.studentsAtMastery) / totalStudents) * 100
        : 0;

    return [
      /* ===============================================
         USER GROWTH
      =============================================== */

      {
        title: "User Growth",

        description:
          "Track student, professor, and administrator accounts and current platform activity.",

        icon: FiTrendingUp,

        metrics: [
          {
            label: "Students",

            value: formatNumber(users.students),

            trend: "Active accounts",
          },

          {
            label: "Professors",

            value: formatNumber(users.professors),

            trend: "Active accounts",
          },

          {
            label: "Administrators",

            value: formatNumber(users.administrators),

            trend: "Active accounts",
          },

          {
            label: "Active This Week",

            value: formatNumber(users.activeThisWeek),

            trend: `${formatNumber(
              users.registrationsThisMonth,
            )} registrations this month`,
          },
        ],

        bars: [
          {
            label: "Student accounts",

            value: clampPercent(studentShare),
          },

          {
            label: "Professor accounts",

            value: clampPercent(professorShare),
          },

          {
            label: "Administrator accounts",

            value: clampPercent(administratorShare),
          },

          {
            label: "Active account rate",

            value: clampPercent(users.activeAccountRate),
          },
        ],
      },

      /* ===============================================
         COURSE ACTIVITY
      =============================================== */

      {
        title: "Course Activity",

        description:
          "Monitor courses, enrollment activity, and learning module publication across PuffyBrain.",

        icon: FiBookOpen,

        metrics: [
          {
            label: "Courses Created",

            value: formatNumber(courses.total),

            trend: `${formatNumber(courses.active)} active`,
          },

          {
            label: "Approved Enrollments",

            value: formatNumber(courses.approvedEnrollments),

            trend: `${formatNumber(courses.pendingEnrollments)} pending`,
          },

          {
            label: "Published Modules",

            value: formatNumber(courses.publishedModules),

            trend: `${formatNumber(courses.totalModules)} total`,
          },

          {
            label: "Published Courses",

            value: formatNumber(courses.published),

            trend: `${formatNumber(courses.archived)} archived`,
          },
        ],

        bars: [
          {
            label: "Published courses",

            value: clampPercent(courses.publishedRate),
          },

          {
            label: "Enrollment approval",

            value: clampPercent(courses.enrollmentApprovalRate),
          },

          {
            label: "Published modules",

            value: clampPercent(courses.modulePublishRate),
          },

          {
            label: "Active courses",

            value:
              numberValue(courses.total) > 0
                ? clampPercent(
                    (numberValue(courses.active) / numberValue(courses.total)) *
                      100,
                  )
                : 0,
          },
        ],
      },

      /* ===============================================
         QUIZ USAGE
      =============================================== */

      {
        title: "Quiz Usage",

        description:
          "Analyze quiz attempts, student participation, average scores, and recent assessment activity.",

        icon: FiFileText,

        metrics: [
          {
            label: "Quiz Attempts",

            value: formatNumber(quizzes.totalAttempts),

            trend: `${formatNumber(quizzes.attemptsThisWeek)} this week`,
          },

          {
            label: "Students Taking Quizzes",

            value: formatNumber(quizzes.studentsWithAttempts),

            trend: "Unique students",
          },

          {
            label: "Average Score",

            value: formatPercent(quizzes.averageScore),

            trend: "Across recorded attempts",
          },

          {
            label: "Quiz Time",

            value: formatNumber(quizzes.totalQuizTime),

            trend: "Recorded time spent",
          },
        ],

        bars: [
          {
            label: "Student participation",

            value: clampPercent(quizParticipation),
          },

          {
            label: "Weekly participation",

            value: clampPercent(weeklyQuizParticipation),
          },

          {
            label: "Average score",

            value: clampPercent(quizzes.averageScore),
          },
        ],
      },

      /* ===============================================
         LEARNING PROGRESS
      =============================================== */

      {
        title: "Learning Progress",

        description:
          "Monitor student lesson progress, module completion, and mastery across the learning system.",

        icon: FiTarget,

        metrics: [
          {
            label: "Students at Mastery",

            value: formatNumber(learning.studentsAtMastery),

            trend: `${formatNumber(learning.masteryThreshold)}% threshold`,
          },

          {
            label: "Completed Modules",

            value: formatNumber(learning.completedModules),

            trend: "100% lesson progress",
          },

          {
            label: "Average Progress",

            value: formatPercent(learning.averageProgress),

            trend: "Across progress records",
          },

          {
            label: "Students with Progress",

            value: formatNumber(learning.studentsWithProgress),

            trend: "Unique students",
          },
        ],

        bars: [
          {
            label: "Learning participation",

            value: clampPercent(learningParticipation),
          },

          {
            label: "Average progress",

            value: clampPercent(learning.averageProgress),
          },

          {
            label: "Mastery rate",

            value: clampPercent(masteryRate),
          },
        ],
      },
    ];
  }, [analytics]);

  /* ===================================================
     LOADING
  =================================================== */

  if (loading) {
    return (
      <div className="admin-page system-analytics-page">
        <section className="system-analytics-header super-page-heading">
          <div>
            <span className="system-analytics-kicker">
              <FiBarChart2 aria-hidden="true" />
              System overview
            </span>

            <h1>System Analytics</h1>

            <p>Loading system analytics...</p>
          </div>
        </section>
      </div>
    );
  }

  /* ===================================================
     LOAD ERROR
  =================================================== */

  if (loadError || !analytics) {
    return (
      <div className="admin-page system-analytics-page">
        <section className="system-analytics-header super-page-heading">
          <div>
            <span className="system-analytics-kicker">
              <FiBarChart2 aria-hidden="true" />
              System overview
            </span>

            <h1>System Analytics</h1>

            <p>Analytics data is currently unavailable.</p>
          </div>
        </section>
      </div>
    );
  }

  /* ===================================================
     PAGE
  =================================================== */

  return (
    <div className="admin-page system-analytics-page">
      {/* ===============================================
          PAGE HEADER
      =============================================== */}

      <section className="system-analytics-header super-page-heading">
        <div>
          <span className="system-analytics-kicker">
            <FiBarChart2 aria-hidden="true" />
            System overview
          </span>

          <h1>System Analytics</h1>

          <p>
            Monitor user activity, courses, assessments, and learning progress
            across PuffyBrain.
          </p>
        </div>
      </section>

      {/* ===============================================
          OVERVIEW
      =============================================== */}

      <section
        className="system-analytics-overview"
        aria-label="System analytics overview"
      >
        {systemAnalyticsOverview.map((item) => {
          const Icon = item.icon;

          return (
            <article className="system-analytics-stat" key={item.label}>
              <span aria-hidden="true">
                <Icon />
              </span>

              <div>
                <p>{item.label}</p>

                <strong>{item.value}</strong>

                <small>{item.detail}</small>
              </div>
            </article>
          );
        })}
      </section>

      {/* ===============================================
          ANALYTICS CATEGORIES
      =============================================== */}

      <section
        className="system-analytics-grid"
        aria-label="System analytics categories"
      >
        {systemAnalyticsSections.map((section) => {
          const Icon = section.icon;

          return (
            <article className="system-analytics-card" key={section.title}>
              {/* HEADER */}

              <div className="system-analytics-card-header">
                <span aria-hidden="true">
                  <Icon />
                </span>

                <div>
                  <h2>{section.title}</h2>

                  <p>{section.description}</p>
                </div>
              </div>

              {/* METRICS */}

              <div className="system-analytics-metrics">
                {section.metrics.map((metric) => (
                  <div className="system-analytics-metric" key={metric.label}>
                    <span>{metric.label}</span>

                    <strong>{metric.value}</strong>

                    <small>{metric.trend}</small>
                  </div>
                ))}
              </div>

              {/* BARS */}

              <div className="system-analytics-bars">
                {section.bars.map((bar) => (
                  <div className="system-analytics-bar" key={bar.label}>
                    <div>
                      <span>{bar.label}</span>

                      <strong>{Math.round(bar.value)}%</strong>
                    </div>

                    <i>
                      <b
                        style={{
                          width: `${clampPercent(bar.value)}%`,
                        }}
                      />
                    </i>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
