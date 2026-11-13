// @refresh reset
import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { fetchProfessorAssessmentSummary } from "../../../services/reportApi.js";
import styles from "./AssessmentDashboard.module.css";

const percentage = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? "N/A"
    : `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;

function yearAndSection(student = {}) {
  const yearLevel =
    student.yearLevel ?? student.year_level ?? student.student_year_level;
  const section =
    student.section ?? student.sectionName ?? student.section_name;
  const year = String(yearLevel ?? "").match(/[1-4]/)?.[0];
  const sectionName = String(section ?? "").trim();
  if (!sectionName) return String(yearLevel ?? "").trim() || "Unavailable";
  return year && !/^\d/.test(sectionName)
    ? `${year}${sectionName}`
    : sectionName;
}

const practiceAttemptsLabel = "Scored Attempts (Practice Quiz)";
const YEAR_OPTIONS = [
  ["1", "1st Year"],
  ["2", "2nd Year"],
  ["3", "3rd Year"],
  ["4", "4th Year"],
];
const SECTION_OPTIONS = Array.from("ABCDEF");

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
const practiceCount = (student) =>
  student.practiceAttempts?.length ??
  (student.scoredAttempts === 0 ? 0 : "Unavailable");

export function AssessmentReportTable({
  columns,
  rows,
  empty,
  pageKey = "",
  fixedPageSize,
}) {
  const [selection, setSelection] = useState({ key: pageKey, page: 1 });
  const [selectedPageSize, setPageSize] = useState(10);
  const pageSize = fixedPageSize ?? selectedPageSize;
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
      {rows.length > 0 && (
        <div className={styles.reportPagination}>
          <span>
            Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of{" "}
            {rows.length} records
          </span>
          <div className={styles.reportPaginationControls}>
            {!fixedPageSize && (
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
            )}
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
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [attentionYearFilter, setAttentionYearFilter] = useState("all");
  const [attentionSectionFilter, setAttentionSectionFilter] = useState("all");
  const [attentionSearch, setAttentionSearch] = useState("");
  const [selected, setSelected] = useState(null);

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
  const attentionQuery = attentionSearch.trim().toLowerCase();
  const students = report?.students || [];
  const matching = useMemo(
    () =>
      students.filter(
        (student) =>
          (yearFilter === "all" ||
            getStudentYearNumber(student) === yearFilter) &&
          (sectionFilter === "all" ||
            getStudentSectionLetter(student) === sectionFilter) &&
          [student.name, student.course, student.courseCode]
            .join(" ")
            .toLowerCase()
            .includes(query),
      ),
    [students, query, yearFilter, sectionFilter],
  );
  const attention = useMemo(
    () => students.filter((student) => student.needsAttention),
    [students],
  );
  const filteredAttention = useMemo(
    () =>
      attention.filter(
        (student) =>
          (attentionYearFilter === "all" ||
            getStudentYearNumber(student) === attentionYearFilter) &&
          (attentionSectionFilter === "all" ||
            getStudentSectionLetter(student) === attentionSectionFilter) &&
          String(student.name || "").toLowerCase().includes(attentionQuery),
      ),
    [attention, attentionYearFilter, attentionSectionFilter, attentionQuery],
  );
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
              Scored practice quiz attempts and module progress for students
              enrolled in your courses. Select a row to view student details.
            </p>
          </div>
          <div className={styles.performanceFilters}>
            <label className={styles.yearSectionFilter}>
              <span>Year Level</span>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                aria-label="Filter by year"
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
                value={sectionFilter}
                onChange={(event) => setSectionFilter(event.target.value)}
                aria-label="Filter by section"
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students or courses…"
                aria-label="Search students or courses"
              />
            </label>
          </div>
        </div>
        <AssessmentReportTable
          pageKey={`${query}:${yearFilter}:${sectionFilter}`}
          columns={[
            "Student",
            "Course",
            practiceAttemptsLabel,
            "Average Score",
            "Modules Completed",
            "Least Mastered",
          ]}
          rows={matching.map((student) => ({
            key: student.key,
            onClick: () => setSelected(student),
            cells: [
              <strong>{student.name}</strong>,
              student.course,
              practiceCount(student),
              percentage(student.averageScore),
              `${student.completedModules}/${student.totalModules}`,
              <button
                type="button"
                className={styles.masteryButton}
                aria-haspopup="dialog"
                aria-label={`View performance details for ${student.name} in ${student.course}`}
                title="View student details"
              >
                {student.topics?.length
                  ? `${student.topics[0].label} (${percentage(student.topics[0].percent)})`
                  : student.scoredAttempts && !student.topics
                    ? "Topic data unavailable"
                    : "No topic results"}
              </button>,
            ],
          }))}
          empty="No matching enrolled students found."
        />
      </section>
      {selected && (
        <dialog
          className={styles.studentDetails}
          aria-labelledby="student-details-title"
          ref={(dialog) => {
            if (dialog && !dialog.open) dialog.showModal();
          }}
          onClose={() => setSelected(null)}
        >
          <header className={styles.detailsHeader}>
            <h2 id="student-details-title">Student Performance</h2>
            <form method="dialog">
              <button type="submit" aria-label="Close student details">
                <FiX size={36} aria-hidden="true" />
              </button>
            </form>
          </header>
          <div className={styles.detailsBody}>
            <dl className={styles.studentIdentity}>
              <div>
                <dt>Student Name</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt>Course</dt>
                <dd>{selected.program?.trim() || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Year &amp; Section</dt>
                <dd>{yearAndSection(selected)}</dd>
              </div>
            </dl>
            <dl className={styles.detailsMetrics}>
              <dt>{practiceAttemptsLabel}</dt>
              <dd>{practiceCount(selected)}</dd>
              <dt>Average score</dt>
              <dd>{percentage(selected.averageScore)}</dd>
              <dt>Modules completed</dt>
              <dd>
                {selected.completedModules}/{selected.totalModules}
              </dd>
            </dl>
            <h3>Topic mastery</h3>
            {selected.topics?.length ? (
              <ul>
                {selected.topics.map(({ label, percent }) => (
                  <li key={label}>
                    {label} ({percentage(percent)})
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {selected.topics
                  ? "No topic results recorded."
                  : "Topic data unavailable."}
              </p>
            )}
            <h3>Scored practice quiz history</h3>
            <AssessmentReportTable
              fixedPageSize={10}
              columns={["Date", "Score", "Percentage"]}
              rows={(selected.practiceAttempts ?? [])
                .slice()
                .reverse()
                .map((attempt) => ({
                  key: attempt.attempts_id,
                  cells: [
                    attempt.created_at
                      ? new Date(attempt.created_at).toLocaleDateString()
                      : "Unavailable",
                    `${attempt.score}/${attempt.total}`,
                    percentage((attempt.score / attempt.total) * 100),
                  ],
                }))}
              empty={
                selected.practiceAttempts
                  ? "No scored practice quiz attempts recorded."
                  : "Quiz history unavailable."
              }
            />
          </div>
        </dialog>
      )}
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
          <div className={styles.performanceFilters}>
            <label className={styles.yearSectionFilter}>
              <span>Year Level</span>
              <select
                value={attentionYearFilter}
                onChange={(event) =>
                  setAttentionYearFilter(event.target.value)
                }
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
                onChange={(event) =>
                  setAttentionSectionFilter(event.target.value)
                }
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
          columns={[
            "Student",
            "Course",
            "Average Score",
            practiceAttemptsLabel,
          ]}
          rows={filteredAttention.map((student) => ({
            key: student.key,
            cells: [
              <strong>{student.name}</strong>,
              student.course,
              percentage(student.averageScore),
              practiceCount(student),
            ],
          }))}
          empty={
            passing == null
              ? "Reporting threshold is not configured."
              : attention.length > 0
                ? "No students match your search and filters."
                : "No enrolled students currently meet the attention criteria."
          }
        />
      </section>
    </>
  );
}
