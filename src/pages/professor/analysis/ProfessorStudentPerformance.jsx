// @refresh reset
import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { fetchProfessorAssessmentSummary } from "../../../services/reportApi.js";
import { PracticeAttemptsTable } from "../../../components/PracticeAttemptsDialog.jsx";
import { formatPracticeAverage, practiceHistoryEntries } from "./ProfessorPracticeHistory.jsx";
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
    Math.min(page - Math.floor(visiblePageCount / 2), pageCount - visiblePageCount + 1),
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

export default function ProfessorStudentPerformance({ courses }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [attentionYearFilter, setAttentionYearFilter] = useState("all");
  const [attentionSectionFilter, setAttentionSectionFilter] = useState("all");
  const [attentionSearch, setAttentionSearch] = useState("");
  const [selection, setSelection] = useState(null);
  const selected = selection?.student;
  const selectedPractice = selection?.practice;

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
          setError(failure.message || "Could not load student performance.");
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [courses]);

  const query = search.trim().toLowerCase();
  const attentionQuery = attentionSearch.trim().toLowerCase();
  const students = report?.students || [];
  const matching = useMemo(
    () => students
      .filter((student) =>
        (yearFilter === "all" || getStudentYearNumber(student) === yearFilter) &&
        (sectionFilter === "all" || getStudentSectionLetter(student) === sectionFilter),
      )
      .flatMap((student) => student.practiceRows.map((practice) => ({ student, practice })))
      .filter(({ student, practice }) =>
        [student.name, student.course, student.courseCode, practice.moduleTitle]
          .join(" ").toLowerCase().includes(query),
      )
      .sort((a, b) => (b.practice.attempts ?? -1) - (a.practice.attempts ?? -1)),
    [students, query, yearFilter, sectionFilter],
  );
  const passing = report?.passingPercentage;
  const historiesUnavailable = students.some((student) => student.practiceAttempts == null);
  const attention = useMemo(
    () => students.filter((student) =>
      passing != null && student.practiceAverage != null && student.practiceAverage < passing,
    ),
    [students, passing],
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
              View each student's practice attempts and average score by module.
              Least Mastered shows their lowest-scoring topic across the course.
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
                placeholder="Search students, courses or modules"
                aria-label="Search students, courses or modules"
              />
            </label>
          </div>
        </div>
        <AssessmentReportTable
          pageKey={`${query}:${yearFilter}:${sectionFilter}`}
          columns={[
            "Student",
            "Course",
            "Module",
            "Attempts",
            "Average Score",
            "Modules Completed",
            "Least Mastered",
            "Action",
          ]}
          rows={matching.map(({ student, practice }) => {
            const viewDetails = () => setSelection({ student, practice });
            return {
              key: `${student.key}:${practice.key}`,
              onClick: viewDetails,
              cells: [
                <strong>{student.name}</strong>,
                student.course,
                practice.moduleTitle ?? "—",
                practice.attempts ?? "Unavailable",
                practice.attempts == null ? "Unavailable" : formatPracticeAverage(practice.average),
                `${student.completedModules}/${student.totalModules}`,
                <span className={styles.masteryButton}>
                  {student.topics?.length
                    ? `${student.topics[0].label} (${percentage(student.topics[0].percent)})`
                    : student.topics ? "No topic results" : "Topic data unavailable"}
                </span>,
                <button
                  type="button"
                  className={styles.viewButton}
                  aria-haspopup="dialog"
                  aria-label={`View performance details for ${student.name} in ${[student.course, practice.moduleTitle].filter(Boolean).join(", ")}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    viewDetails();
                  }}
                >
                  View
                </button>,
              ],
            };
          })}
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
          onClose={() => setSelection(null)}
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
                <dd>{selected.course}</dd>
              </div>
              {selected.program?.trim() && (
                <div>
                  <dt>Program</dt>
                  <dd>{selected.program}</dd>
                </div>
              )}
              <div>
                <dt>Year &amp; Section</dt>
                <dd>{yearAndSection(selected)}</dd>
              </div>
            </dl>
            <dl className={styles.detailsMetrics}>
              {selectedPractice.moduleTitle && (
                <>
                  <dt>Module</dt>
                  <dd>{selectedPractice.moduleTitle}</dd>
                </>
              )}
              <dt>Attempts</dt>
              <dd>{selectedPractice.attempts ?? "Unavailable"}</dd>
              <dt>Average score</dt>
              <dd>{selectedPractice.attempts == null ? "Unavailable" : formatPracticeAverage(selectedPractice.average)}</dd>
              <dt>Modules completed</dt>
              <dd>
                {selected.completedModules}/{selected.totalModules}
              </dd>
            </dl>
            <h3>Course topic mastery</h3>
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
            <h3>Practice quiz history</h3>
            {selectedPractice.attempts > 0 ? (
              <PracticeAttemptsTable attempts={practiceHistoryEntries(selectedPractice.attemptHistory)} />
            ) : (
              <p>{selectedPractice.attempts === 0 ? "No practice attempts recorded." : "Practice history unavailable."}</p>
            )}
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
                : `Students whose practice average in a course falls below the configured ${percentage(passing)} reporting threshold.`}
              {historiesUnavailable && " Some course practice histories are unavailable."}
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
            "Attempts",
          ]}
          rows={filteredAttention.map((student) => ({
            key: student.key,
            cells: [
              <strong>{student.name}</strong>,
              student.course,
              formatPracticeAverage(student.practiceAverage),
              student.practiceAttempts.length,
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
    </>
  );
}
