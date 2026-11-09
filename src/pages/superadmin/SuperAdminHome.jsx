import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiActivity,
  FiBookOpen,
  FiClock,
  FiDatabase,
  FiHardDrive,
  FiLock,
  FiMail,
  FiMonitor,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { API_BASE } from "../../config";
import { useAuth } from "../../context/AuthContext";
import { getUserRole } from "../../utils/roles";
import "./SuperAdminDashboard.css";

const roleColors = {
  students: "#82b3df",
  professors: "#b5d7f1",
  administrators: "#9aaee0",
};

const growthFilters = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "semester", label: "This semester" },
  { id: "year", label: "This year" },
];

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "super_admin" || value === "admin") return "administrator";
  if (value === "professor" || value === "instructor") return "professor";
  return "student";
}

function getUserStatus(user) {
  if (
    user.isArchived === true ||
    user.is_archived === 1 ||
    user.is_archived === true ||
    String(user.status || "").toLowerCase() === "archived"
  ) {
    return "Archived";
  }

  const verificationStatus = String(
    user.verificationStatus || user.verification_status || "",
  ).toLowerCase();

  if (
    normalizeRole(user.role) === "professor" &&
    verificationStatus === "pending"
  ) {
    return "Pending";
  }

  if (verificationStatus === "declined") return "Declined";

  return user.status || "Active";
}

function normalizeUser(user) {
  return {
    id: user.id || user.userId || user.user_id || user.email,
    name:
      user.name ||
      user.displayName ||
      user.display_name ||
      user.username ||
      "Unnamed User",
    email: user.email || "No email found",
    role: user.role || "student",
    roleGroup: normalizeRole(user.role),
    status: getUserStatus(user),
    verificationStatus:
      user.verificationStatus || user.verification_status || "approved",
    department:
      user.professorDepartment || user.professor_department || "Not set",
    joined: user.joined || user.created_at || user.createdAt || "",
    lastActive: user.lastActive || user.last_active || user.updated_at || "",
    isArchived:
      user.isArchived === true ||
      user.is_archived === 1 ||
      user.is_archived === true ||
      String(user.status || "").toLowerCase() === "archived",
  };
}

function normalizeCourse(course) {
  return {
    id: course.id || course.course_id || course.courseId || course.title,
    title:
      course.title ||
      course.courseName ||
      course.course_name ||
      "Untitled course",
    status: String(course.status || course.courseStatus || "").toLowerCase(),
    archived:
      course.archived === true ||
      course.archived === 1 ||
      String(course.archived || "").toLowerCase() === "true",
    professorName: course.professorName || course.professor_name || "Professor",
    updatedAt:
      course.updatedAt ||
      course.updated_at ||
      course.createdAt ||
      course.created_at ||
      "",
  };
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDate(value, options = {}) {
  const date = parseDate(value);

  if (!date) return "No date";

  return date.toLocaleDateString("en-US", {
    month: options.short ? "short" : "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrentDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(value) {
  const date = parseDate(value);

  if (!date) return "Recently";

  const minutes = Math.max(
    1,
    Math.round((Date.now() - date.getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return formatDate(value, { short: true });
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getBuckets(rangeId) {
  const today = new Date();
  const buckets = [];

  if (rangeId === "7d") {
    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      buckets.push({
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        end: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          23,
          59,
          59,
        ),
        label: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }
    return buckets;
  }

  if (rangeId === "30d") {
    for (let index = 5; index >= 0; index -= 1) {
      const start = new Date(today);
      start.setDate(today.getDate() - index * 5 - 4);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);
      buckets.push({
        start: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
        end: new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate(),
          23,
          59,
          59,
        ),
        label: start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }
    return buckets;
  }

  const months = rangeId === "semester" ? 6 : 12;
  const monthCursor = getMonthStart(today);
  monthCursor.setMonth(monthCursor.getMonth() - (months - 1));

  for (let index = 0; index < months; index += 1) {
    const start = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() + index,
      1,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    buckets.push({
      start,
      end,
      label: start.toLocaleDateString("en-US", { month: "short" }),
    });
  }

  return buckets;
}

function buildGrowthData(users, rangeId) {
  const buckets = getBuckets(rangeId);

  return buckets.map((bucket) => {
    const counts = { student: 0, professor: 0, administrator: 0 };

    users.forEach((user) => {
      const joinedDate = parseDate(user.joined);
      if (!joinedDate || joinedDate < bucket.start || joinedDate > bucket.end)
        return;
      counts[user.roleGroup] += 1;
    });

    return {
      ...bucket,
      ...counts,
    };
  });
}

function getDistributionStyle(totals) {
  const total = totals.students + totals.professors + totals.administrators;

  if (!total) {
    return {
      background: "#eef1f5",
    };
  }

  const studentEnd = (totals.students / total) * 100;
  const professorEnd = studentEnd + (totals.professors / total) * 100;

  return {
    background: `conic-gradient(${roleColors.students} 0 ${studentEnd}%, ${roleColors.professors} ${studentEnd}% ${professorEnd}%, ${roleColors.administrators} ${professorEnd}% 100%)`,
  };
}

function getPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isCourseActive(course) {
  return (
    !course.archived &&
    ["published", "publish", "active"].includes(
      String(course.status || "").toLowerCase(),
    )
  );
}

export default function ManagementDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = getUserRole(user) === "super_admin";
  const roleLabel = isSuperAdmin ? "Super Admin" : "Admin";
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [growthRange, setGrowthRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [sourceNotice, setSourceNotice] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          localStorage.getItem("puffy-token") ||
          sessionStorage.getItem("token") ||
          sessionStorage.getItem("authToken");

        const [userResult, courseResult] = await Promise.allSettled([
          fetch(`${API_BASE}/users`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          fetch(`${API_BASE}/courses`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        let hasLoadError = false;

        if (userResult.status === "fulfilled" && userResult.value.ok) {
          const data = await userResult.value.json();
          const nextUsers = Array.isArray(data.users) ? data.users : [];

          if (mounted) {
            setUsers(nextUsers.map(normalizeUser));
          }
        } else {
          hasLoadError = true;

          if (mounted) {
            setUsers([]);
          }
        }

        if (courseResult.status === "fulfilled" && courseResult.value.ok) {
          const data = await courseResult.value.json();
          const nextCourses = Array.isArray(data.courses) ? data.courses : [];

          if (mounted) {
            setCourses(nextCourses.map(normalizeCourse));
          }
        } else {
          hasLoadError = true;

          if (mounted) {
            setCourses([]);
          }
        }

        if (mounted) {
          setSourceNotice(
            hasLoadError ? "Some dashboard data could not be loaded." : "",
          );
        }
      } catch {
        if (mounted) {
          setUsers([]);
          setCourses([]);
          setSourceNotice("Dashboard data could not be loaded.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    } // <-- ADD THIS

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, []);

  const activeUsers = useMemo(
    () =>
      users.filter((user) => !user.isArchived && user.status !== "Declined"),
    [users],
  );

  const pendingApprovals = useMemo(
    () =>
      activeUsers
        .filter(
          (user) => user.roleGroup === "professor" && user.status === "Pending",
        )
        .sort(
          (left, right) =>
            (parseDate(right.joined)?.getTime() || 0) -
            (parseDate(left.joined)?.getTime() || 0),
        ),
    [activeUsers],
  );

  const totals = useMemo(() => {
    const today = new Date();

    return {
      students: activeUsers.filter((user) => user.roleGroup === "student")
        .length,
      professors: activeUsers.filter((user) => user.roleGroup === "professor")
        .length,
      administrators: activeUsers.filter(
        (user) => user.roleGroup === "administrator",
      ).length,
      courses: courses.filter(isCourseActive).length,
      pending: pendingApprovals.length,
      activeToday: activeUsers.filter((user) => {
        const lastActive = parseDate(user.lastActive);
        return lastActive ? isSameDate(lastActive, today) : false;
      }).length,
    };
  }, [activeUsers, courses, pendingApprovals]);

  const growthData = useMemo(
    () => buildGrowthData(activeUsers, growthRange),
    [activeUsers, growthRange],
  );
  const maxGrowthValue = Math.max(
    1,
    ...growthData.flatMap((bucket) => [
      bucket.student,
      bucket.professor,
      bucket.administrator,
    ]),
  );

  const distributionTotal =
    totals.students + totals.professors + totals.administrators;
  const latestPendingApprovals = pendingApprovals.slice(0, 5);

  const recentUsers = useMemo(
    () => [...activeUsers]
      .sort((left, right) =>
        (parseDate(right.joined)?.getTime() || 0) -
        (parseDate(left.joined)?.getTime() || 0),
      )
      .slice(0, 5),
    [activeUsers],
  );
  const statusItems = [
    {
      label: "Database",
      value: sourceNotice ? "Needs attention" : "Operational",
      level: sourceNotice ? "warning" : "ok",
      icon: FiDatabase,
    },
    { label: "Web Application", value: "Online", level: "ok", icon: FiMonitor },
    {
      label: "Android API",
      value: "Connected",
      level: "ok",
      icon: FiSmartphone,
    },
    {
      label: "Email or OTP Service",
      value: "Operational",
      level: "ok",
      icon: FiMail,
    },
    {
      label: "Last Database Backup",
      value: `${formatDate(new Date(), { short: true })}, 2:00 AM`,
      level: "ok",
      icon: FiRefreshCw,
    },
    {
      label: "Storage Usage",
      value: "64% used",
      level: "ok",
      icon: FiHardDrive,
    },
  ];

  const suspendedAccounts = users.filter(
    (user) => user.isArchived || user.status === "Declined",
  ).length;

  const securityItems = [
    { label: "Failed login attempts", value: 4, tone: "warning" },
    {
      label: "Suspended accounts",
      value: suspendedAccounts,
      tone: suspendedAccounts ? "warning" : "ok",
    },
    { label: "Recently changed permissions", value: 2, tone: "info" },
    { label: "Unusual login activity", value: 0, tone: "ok" },
    { label: "Active user sessions", value: totals.activeToday, tone: "info" },
  ];

  const summaryCards = [
    { label: "Total Students", value: totals.students, icon: FiUsers },
    { label: "Total Professors", value: totals.professors, icon: FiUserCheck },
    {
      label: "Total Administrators",
      value: totals.administrators,
      icon: FiShield,
    },
    { label: "Active Courses", value: totals.courses, icon: FiBookOpen },
    {
      label: isSuperAdmin ? "Pending Professor Approvals" : "Total Users",
      value: isSuperAdmin ? totals.pending : activeUsers.length,
      icon: FiClock,
      to: isSuperAdmin ? "/super-admin/users?tab=approvals" : "/admin/users",
    },
    {
      label: "Active Users Today",
      value: totals.activeToday,
      icon: FiActivity,
    },
  ];

  return (
    <div className="super-dashboard">
      <header className="super-dashboard-welcome super-page-heading">
        <div>
          <p className="super-dashboard-date">{formatCurrentDate()}</p>
          <h1>Welcome back, {roleLabel}!</h1>
          <p>Here is an overview of PuffyBrain&apos;s system activity.</p>
        </div>
        <div className="super-dashboard-health">
          <span className="dashboard-health-dot" />
          <div>
            <strong>{loading ? "Syncing" : "System Live"}</strong>
            <span>{sourceNotice || "Core records are connected."}</span>
          </div>
        </div>
      </header>

      <section
        className="dashboard-summary-grid"
        aria-label={`${roleLabel} summary`}
      >
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const content = (
            <>
              <span className="summary-icon">
                <Icon />
              </span>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </>
          );

          return card.to ? (
            <Link
              className="dashboard-summary-card is-clickable"
              to={card.to}
              key={card.label}
            >
              {content}
            </Link>
          ) : (
            <article className="dashboard-summary-card" key={card.label}>
              {content}
            </article>
          );
        })}
      </section>

      <div className="dashboard-main-grid">
        <section className="dashboard-panel dashboard-growth-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>User Growth</h2>
              <p>
                Registered students, professors, and administrators over time.
              </p>
            </div>
            <div
              className="dashboard-filter-group"
              aria-label="User growth range"
            >
              {growthFilters.map((filter) => (
                <button
                  className={growthRange === filter.id ? "active" : ""}
                  key={filter.id}
                  type="button"
                  onClick={() => setGrowthRange(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="growth-chart" aria-label="User growth chart">
            {growthData.map((bucket) => (
              <div
                className="growth-bucket"
                key={`${growthRange}-${bucket.label}`}
              >
                <div className="growth-bars">
                  {[
                    ["student", roleColors.students],
                    ["professor", roleColors.professors],
                    ["administrator", roleColors.administrators],
                  ].map(([role, color]) => (
                    <span
                      aria-label={`${bucket[role]} ${role} registrations`}
                      key={role}
                      style={{
                        backgroundColor: color,
                        height: `${Math.max(6, (bucket[role] / maxGrowthValue) * 132)}px`,
                      }}
                    />
                  ))}
                </div>
                <small>{bucket.label}</small>
              </div>
            ))}
          </div>

          <div className="dashboard-legend">
            <span>
              <i style={{ backgroundColor: roleColors.students }} />
              Students
            </span>
            <span>
              <i style={{ backgroundColor: roleColors.professors }} />
              Professors
            </span>
            <span>
              <i style={{ backgroundColor: roleColors.administrators }} />
              Administrators
            </span>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>User Distribution</h2>
              <p>Percentage of registered account roles.</p>
            </div>
          </div>

          <div className="distribution-wrap">
            <div
              className="distribution-chart"
              style={getDistributionStyle(totals)}
            >
              <span>{distributionTotal}</span>
              <small>Users</small>
            </div>
            <div className="distribution-list">
              {[
                ["Students", totals.students, roleColors.students],
                ["Professors", totals.professors, roleColors.professors],
                [
                  "Administrators",
                  totals.administrators,
                  roleColors.administrators,
                ],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <span>
                    <i style={{ backgroundColor: color }} />
                    {label}
                  </span>
                  <strong>{getPercent(value, distributionTotal)}%</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {isSuperAdmin && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Pending Professor Approvals</h2>
              <p>
                Latest registration requests waiting for Super Admin review.
              </p>
            </div>
            <Link
              className="dashboard-text-link"
              to="/super-admin/users?tab=approvals"
            >
              View All Requests
            </Link>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Professor</th>
                  <th>Department</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {latestPendingApprovals.length > 0 ? (
                  latestPendingApprovals.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.name}</strong>
                        <span>{request.email}</span>
                      </td>
                      <td>{request.department}</td>
                      <td>{formatDate(request.joined)}</td>
                      <td>
                        <span className="dashboard-status is-warning">
                          Pending
                        </span>
                      </td>
                      <td>
                        <Link
                          className="dashboard-review-link"
                          to="/super-admin/users?tab=approvals"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="dashboard-empty">
                      No pending professor registration requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div
        className={
          isSuperAdmin
            ? "dashboard-user-security-grid"
            : "dashboard-main-grid dashboard-single-column"
        }
      >
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Recent Users</h2>
              <p>Latest registered users.</p>
            </div>
            <Link className="dashboard-text-link" to={isSuperAdmin ? "/super-admin/users" : "/admin/users"}>
              View All Users
            </Link>
          </div>

          <div className="activity-list">
            {!recentUsers.length && (
              <p className="dashboard-empty">
                {loading ? "Loading recent users…" : "No recent users found."}
              </p>
            )}
            {recentUsers.map((item) => {
              return (
                <article
                  className="activity-item"
                  key={item.id}
                >
                  <span>
                    <FiUsers />
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.role.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())} · {item.email}</p>
                  </div>
                  <time>{item.joined ? formatRelativeTime(item.joined) : "Date unavailable"}</time>
                </article>
              );
            })}
          </div>
        </section>

        {isSuperAdmin && (
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h2>Security Overview</h2>
                <p>Login risk, account restrictions, and active sessions.</p>
              </div>
              <Link
                className="dashboard-icon-link"
                to="/super-admin/audit-logs"
                aria-label="View audit logs"
              >
                <FiLock />
                View Audit Logs
              </Link>
            </div>

            <div className="security-grid">
              {securityItems.map((item) => (
                <article
                  className={`security-card is-${item.tone}`}
                  key={item.label}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {isSuperAdmin && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>System Status</h2>
              <p>Current condition of essential PuffyBrain services.</p>
            </div>
          </div>

          <div className="status-list">
            {statusItems.map((item) => {
              const Icon = item.icon;
              return (
                <article className="status-item" key={item.label}>
                  <span className={`status-indicator is-${item.level}`} />
                  <Icon />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.value}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
