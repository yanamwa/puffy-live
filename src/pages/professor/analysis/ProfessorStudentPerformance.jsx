import { useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { fetchProfessorAssessmentSummary } from "../../../services/reportApi.js";
import { formatPracticeAverage } from "./ProfessorPracticeHistory.jsx";
import styles from "./AssessmentDashboard.module.css";

const YEAR_OPTIONS = [
  ["1", "1st Year"],
  ["2", "2nd Year"],
  ["3", "3rd Year"],
  ["4", "4th Year"],
];

const SECTION_OPTIONS = Array.from("ABCDEF");

const percentage = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? "N/A"
    : `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;

function getStudentYearNumber(student = {}) {
  const yearLevel =
    student.yearLevel ?? student.year_level ?? student.student_year_level;
  const year = String(yearLevel ?? "").match(/[1-4]/)?.[0];
  if (year) return year;

  const section = String(
    student.section ?? student.sectionName ?? student.section_name ?? "",
  )
    .trim()
    .match(/^([1-4])[A-F]$/i);

  return section?.[1] || "";
}

function getStudentSectionLetter(student = {}) {
  const section = String(
    student.section ?? student.sectionName ?? student.section_name ?? "",
  )
    .trim()
    .toUpperCase();

  return section.match(/^(?:[1-4])?([A-F])$/)?.[1] || "";
}

// Shared table used by the per-course Assessment Analysis dashboard as well.
// Do not remove or rename this named export.
export function AssessmentReportTable({
  columns,
  rows,
  empty,
  pageKey = "",
  fixedPageSize,
  hideSinglePageNavigation = false,
}) {
  const [selection, setSelection] = useState({ key: pageKey, page: 1 });
  const pageSize = fixedPageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(
    selection.key === pageKey ? selection.page : 1,
    pageCount,
  );
  const start = (page - 1) * pageSize;
  const setPage = (value) => setSelection({ key: pageKey, page: value });
  const visiblePageCount = Math.min(pageCount, 5);
  const firstVisiblePage = Math.max(
    1,
    Math.min(
      page - Math.floor(visiblePageCount / 2),
      pageCount - visiblePageCount + 1,
    ),
  );
  const visiblePages = Array.from(
    { length: visiblePageCount },
    (_, index) => firstVisiblePage + index,
  );

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
                <tr
                  key={row.key}
                  className={row.onClick ? styles.clickableRow : undefined}
                  onClick={row.onClick}
                >
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
      {rows.length > 0 && (!hideSinglePageNavigation || pageCount > 1) && (
        <div className={styles.reportPagination}>
          <nav className={styles.reportPaginationControls} aria-label="Table pages">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            {visiblePages.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                aria-current={page === pageNumber ? "page" : undefined}
                aria-label={`Page ${pageNumber}`}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </>
  );
}

// The duplicate "Student Performance" report and its modal have been removed.
// Keep "Students Needing Attention" on the professor's course overview page.
export default function ProfessorStudentPerformance({ courses }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [attentionYearFilter, setAttentionYearFilter] = useState("all");
  const [attentionSectionFilter, setAttentionSectionFilter] = useState("all");
  const [attentionSearch, setAttentionSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchProfessorAssessmentSummary({ signal: controller.signal, courses })
      .then((data) => {
        if (active) {
          setError("");
          setReport(data);
        }
      })
      .catch((failure) => {
        if (active && failure.name !== "AbortError") {
          setError(failure.message || "Could not load students needing attention.");
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [courses]);

  const students = report?.students || [];
  const passing = report?.passingPercentage;
  const historiesUnavailable = students.some(
    (student) => student.practiceAttempts == null,
  );
  const attentionQuery = attentionSearch.trim().toLowerCase();

  const attention = useMemo(
    () =>
      students.filter(
        (student) =>
          passing != null &&
          student.practiceAverage != null &&
          student.practiceAverage < passing,
      ),
    [report],
  );

  const filteredAttention = attention.filter(
    (student) =>
      (attentionYearFilter === "all" ||
        getStudentYearNumber(student) === attentionYearFilter) &&
      (attentionSectionFilter === "all" ||
        getStudentSectionLetter(student) === attentionSectionFilter) &&
      String(student.name || "").toLowerCase().includes(attentionQuery),
  );

  if (error) {
    return (
      <div className={`${styles.panel} ${styles.studentReport}`} role="alert">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`${styles.panel} ${styles.studentReport}`} role="status">
        Loading students needing attention…
      </div>
    );
  }

  return (
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
              : `Students whose practice average in a course falls below the configured ${percentage(passing)} reporting threshold.`}
            {historiesUnavailable &&
              " Some course practice histories are unavailable."}
          </p>
        </div>
        <div className={styles.performanceFilters}>
          <label className={styles.yearSectionFilter}>
            <span>Year Level</span>
            <select
              value={attentionYearFilter}
              onChange={(event) => setAttentionYearFilter(event.target.value)}
              aria-label="Filter students needing attention by year"
            >
              <option value="all">All Years</option>
              {YEAR_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.yearSectionFilter}>
            <span>Section</span>
            <select
              value={attentionSectionFilter}
              onChange={(event) => setAttentionSectionFilter(event.target.value)}
              aria-label="Filter students needing attention by section"
            >
              <option value="all">All Sections</option>
              {SECTION_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.searchBox}>
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              value={attentionSearch}
              onChange={(event) => setAttentionSearch(event.target.value)}
              placeholder="Search students…"
              aria-label="Search students needing attention"
            />
          </label>
        </div>
      </div>

      <AssessmentReportTable
        pageKey={`${attentionQuery}:${attentionYearFilter}:${attentionSectionFilter}`}
        columns={["Student", "Course", "Average Score", "Attempts"]}
        rows={filteredAttention.map((student) => ({
          key: student.key,
          cells: [
            <strong>{student.name}</strong>,
            student.course,
            formatPracticeAverage(student.practiceAverage),
            student.practiceAttempts == null
              ? "Unavailable"
              : student.practiceAttempts.length,
          ],
        }))}
        empty={
          passing == null
            ? "Reporting threshold is not configured."
            : attention.length > 0
              ? "No students match your search and filters."
              : "No students with available practice results are below the threshold."
        }
      />
    </section>
  );
}
