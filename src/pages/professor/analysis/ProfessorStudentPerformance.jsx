import { useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { fetchProfessorAssessmentSummary } from "../../../services/reportApi.js";
import styles from "./AssessmentDashboard.module.css";

const percentage = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? "N/A"
    : `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;

export function AssessmentReportTable({ columns, rows, empty, pageKey = "" }) {
  const [selection, setSelection] = useState({ key: pageKey, page: 1 });
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(
    selection.key === pageKey ? selection.page : 1,
    pageCount,
  );
  const start = (page - 1) * pageSize;
  const setPage = (value) => setSelection({ key: pageKey, page: value });

  return (
    <>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.slice(start, start + pageSize).map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, index) => (
                    <td key={columns[index]} data-label={columns[index]}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div className={styles.reportPagination}>
          <span>
            Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of{" "}
            {rows.length} records
          </span>
          <div className={styles.reportPaginationControls}>
            <label>
              Rows per page
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              First
            </button>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span aria-live="polite">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => setPage(pageCount)}
            >
              Last
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ProfessorStudentPerformance() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchProfessorAssessmentSummary({ signal: controller.signal })
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((failure) => {
        if (active && failure.name !== "AbortError") {
          setError(failure.message || "Could not load student performance.");
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const query = search.trim().toLowerCase();
  const students = report?.students || [];
  const matching = useMemo(
    () =>
      students.filter((student) =>
        [student.name, student.course, student.courseCode]
          .join(" ")
          .toLowerCase()
          .includes(query),
      ),
    [students, query],
  );
  const attention = students.filter((student) => student.needsAttention);
  const passing = report?.passingPercentage;

  if (error)
    return (
      <div className={`${styles.panel} ${styles.studentReport}`} role="alert">
        {error}
      </div>
    );
  if (!report)
    return (
      <div className={`${styles.panel} ${styles.studentReport}`} role="status">
        Loading student performance…
      </div>
    );

  return (
    <>
      <section
        className={`${styles.panel} ${styles.studentReport}`}
        aria-labelledby="student-performance-title"
      >
        <div className={styles.tableHeading}>
          <div>
            <h2 id="student-performance-title">Student Performance</h2>
            <p>
              All recorded scored quiz attempts and module progress for students
              enrolled in your courses.
            </p>
          </div>
          <label className={styles.searchBox}>
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search students or courses…"
              aria-label="Search students or courses"
            />
          </label>
        </div>
        <AssessmentReportTable
          pageKey={query}
          columns={[
            "Student",
            "Course",
            "Scored Attempts",
            "Average Score",
            "Modules Completed",
            "Assessment Status",
          ]}
          rows={matching.map((student) => ({
            key: student.key,
            cells: [
              <strong>{student.name}</strong>,
              student.course,
              student.scoredAttempts,
              percentage(student.averageScore),
              `${student.completedModules}/${student.totalModules}`,
              <span className={styles.assessmentStatus}>
                {student.averageScore == null
                  ? "Not assessed"
                  : passing == null
                    ? "Threshold not configured"
                    : student.needsAttention
                      ? "Needs attention"
                      : "Assessed"}
              </span>,
            ],
          }))}
          empty="No matching enrolled students found."
        />
      </section>
      <section
        className={`${styles.panel} ${styles.studentReport}`}
        aria-labelledby="student-attention-title"
      >
        <div className={styles.tableHeading}>
          <div>
            <h2 id="student-attention-title">Students Needing Attention</h2>
            <p>
              {passing == null
                ? "The university reporting threshold is not configured."
                : `Students with a recorded course quiz average below the configured ${percentage(passing)} reporting threshold. This is an advisory flag, not a final grade.`}
            </p>
          </div>
        </div>
        <AssessmentReportTable
          columns={["Student", "Course", "Average Score", "Quiz Attempts"]}
          rows={attention.map((student) => ({
            key: student.key,
            cells: [
              <strong>{student.name}</strong>,
              student.course,
              percentage(student.averageScore),
              student.scoredAttempts,
            ],
          }))}
          empty={
            passing == null
              ? "Reporting threshold is not configured."
              : "No enrolled students currently meet the attention criteria."
          }
        />
      </section>
    </>
  );
}
