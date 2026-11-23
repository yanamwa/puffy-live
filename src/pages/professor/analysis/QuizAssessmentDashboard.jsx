import {
  assessmentModuleTitle,
  assessmentModules,
  filterModuleAttempts,
} from "../../../utils/assessmentModuleScope.js";
import styles from "./AssessmentAnalysis.module.css";
import reportStyles from "./AssessmentDashboard.module.css";
import { FiSearch } from "react-icons/fi";
import MainQuizAnalysis from "./MainQuizAnalysis.jsx";
import MainQuizResponses from "./MainQuizResponses.jsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../../config.js";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import "./QuizAssessmentDashboard.css";
import {
  practiceModuleRows,
  summarizeAssessment,
  summarizePracticeReport,
} from "../../../utils/assessmentAnalytics.js";
import { AssessmentReportTable } from "./ProfessorStudentPerformance.jsx";
import ProfessorPracticeHistory from "./ProfessorPracticeHistory.jsx";
import PracticeAttemptsDialog from "../../../components/PracticeAttemptsDialog.jsx";
import PracticeLearningPerformance from "./PracticeLearningPerformance.jsx";
import {
  tutorialAssessmentAttempts,
  tutorialAssessmentStudents,
  tutorialMainQuizResponses,
} from "../tutorial/professorTutorialExamples.js";

const pct = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? "Not assessed"
    : `${Math.round(Number(value))}%`;

const studentId = (student) =>
  student?.userId ?? student?.user_id ?? student?.id ?? student?.studentId ?? null;

const yearOf = (student) => {
  const value = String(
    student?.year_level ??
    student?.yearLevel ??
    student?.student_year_level ??
    student?.year ??
    student?.student?.year_level ??
    "",
  ).trim();
  return value.match(/[1-4]/)?.[0] || value;
};

const sectionOf = (student) => String(
  student?.section_name ??
  student?.sectionName ??
  student?.student_section ??
  student?.section ??
  student?.student?.section ??
  "",
).trim();

// The backend supplies these records through
// GET /reports/professor/assessments?courseId=...
// They are persisted course-level score histories, NOT new adaptive submissions.
function validRecordedHistory(value) {
  let history = value;
  if (typeof history === "string") {
    try {
      history = JSON.parse(history);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => {
      const score = Number(entry?.score);
      const total = Number(entry?.total);
      return entry?.score != null && entry?.total != null &&
        Number.isFinite(score) && Number.isFinite(total) &&
        total > 0 && score >= 0 && score <= total;
    })
    .map((entry, index) => ({
      quizNumber: Number.isInteger(Number(entry.quizNumber)) && Number(entry.quizNumber) > 0
        ? Number(entry.quizNumber)
        : index + 1,
      score: Number(entry.score),
      total: Number(entry.total),
      proposedDisplayAt: entry.proposedDisplayAt ?? entry.proposed_display_at ?? null,
    }));
}

function RecordedPracticeHistory({ student, courseTitle, onClose }) {
  const history = validRecordedHistory(student.recordedHistory);
  const attempts = history
    .map((entry) => ({
      id: `course-score-${entry.quizNumber}`,
      number: entry.quizNumber,
      score: entry.score,
      total: entry.total,
      completedAt: entry.proposedDisplayAt || null,
    }))
    .sort((a, b) => b.number - a.number);

  return (
    <PracticeAttemptsDialog
      heading={student.name}
      description={`${courseTitle || "Course"} · Course-level quiz scores`}
      attempts={attempts}
      recorded
      onClose={onClose}
    >
      <dl className="practice-history-summary">
        <div>
          <dt>Practice attempts</dt>
          <dd>{attempts.length}</dd>
        </div>
        <div>
          <dt>Average score</dt>
          <dd>{pct(student.average)}</dd>
        </div>
      </dl>
      <p style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
        These saved scores belong to the course and are separate from
        submitted adaptive Practice Quiz responses.
      </p>
    </PracticeAttemptsDialog>
  );
}

function PracticeStudentReport({
  title,
  description,
  students,
  courseTitle,
  years,
  sections,
  empty,
  attention = false,
  modules = [],
  moduleScope = "all",
  recordedLoading = false,
  recordedError = "",
  recordedUnavailable = false,
}) {
  const headingId = useId();
  const [year, setYear] = useState("all");
  const [section, setSection] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [sort, setSort] = useState("attempts");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const query = search.trim().toLowerCase();
  const selectedModule = moduleScope === "all" ? moduleFilter : moduleScope;
  const rows = students.filter((student) =>
    (year === "all" || student.year === year) &&
    (section === "all" || student.section === section) &&
    (attention || selectedModule === "all" || String(student.moduleIndex) === selectedModule) &&
    `${student.name} ${attention ? courseTitle : student.moduleTitle}`.toLowerCase().includes(query),
  );

  if (!attention) {
    rows.sort((a, b) => {
      if (sort === "attempts" && a.attempts !== b.attempts) return b.attempts - a.attempts;
      if (sort !== "attempts") {
        if (a.moduleIndex < 0 && b.moduleIndex >= 0) return 1;
        if (b.moduleIndex < 0 && a.moduleIndex >= 0) return -1;
        const byModule = sort === "title"
          ? a.moduleTitle.localeCompare(b.moduleTitle, undefined, { numeric: true })
          : a.moduleIndex - b.moduleIndex;
        if (byModule) return byModule;
      }
      return a.name.localeCompare(b.name) ||
        a.moduleIndex - b.moduleIndex ||
        String(a.key).localeCompare(String(b.key));
    });
  }

  const measures = attention
    ? ["Average Score", "Practice Attempts"]
    : ["Practice Attempts", "Average Score"];
  const selectedStudent = rows.find((student) => student.key === selectedKey);

  return (
    <section
      className={`${reportStyles.panel} ${reportStyles.studentReport} ${reportStyles.practiceReport}`}
      aria-labelledby={headingId}
    >
      <div className={reportStyles.tableHeading}>
        <div>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className={reportStyles.performanceFilters}>
          <label className={reportStyles.yearSectionFilter}>
            <span>Year Level</span>
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">All Years</option>
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className={reportStyles.yearSectionFilter}>
            <span>Section</span>
            <select value={section} onChange={(event) => setSection(event.target.value)}>
              <option value="all">All Sections</option>
              {sections.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          {!attention && (
            <>
              <label className={reportStyles.yearSectionFilter}>
                <span>Module</span>
                <select
                  value={selectedModule}
                  disabled={moduleScope !== "all"}
                  onChange={(event) => setModuleFilter(event.target.value)}
                >
                  {moduleScope === "all" && <option value="all">All Modules</option>}
                  {modules.map((module, index) =>
                    (moduleScope === "all" || String(index) === moduleScope) && (
                      <option key={module.id ?? index} value={String(index)}>
                        {assessmentModuleTitle(modules, index)}
                      </option>
                    ),
                  )}
                  {moduleScope === "all" && students.some((student) => student.moduleIndex === -1) && (
                    <option value="-1">Module unavailable</option>
                  )}
                  {moduleScope === "all" && students.some((student) => student.isRecorded) && (
                    <option value="-2">Course-level quiz scores</option>
                  )}
                </select>
              </label>
              <label className={reportStyles.yearSectionFilter}>
                <span>Sort by</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="attempts">Most attempts</option>
                  <option value="module">Module order</option>
                  <option value="title">Module A–Z</option>
                </select>
              </label>
            </>
          )}
          <label className={reportStyles.searchBox}>
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              aria-label={`Search ${title.toLowerCase()}`}
              placeholder={attention ? "Search students or courses" : "Search students or modules"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
      </div>
      {!attention && recordedLoading && <p role="status">Loading saved quiz scores…</p>}
      {!attention && recordedError && <p role="alert">{recordedError}</p>}
      {!attention && recordedUnavailable && !recordedError && (
        <p role="status">
          The backend report cannot read saved quiz scores. Showing submitted Practice attempts only.
        </p>
      )}
      <AssessmentReportTable
        columns={["Student", attention ? "Course" : "Modules", ...measures, ...(attention ? [] : ["Action"])]}
        rows={rows.map((student) => {
          const score = student.average == null ? "N/A" : pct(student.average);
          return {
            key: student.key ?? student.id,
            cells: [
              <strong>{student.name}</strong>,
              attention ? courseTitle : student.moduleTitle,
              ...(attention ? [score, student.attempts] : [student.attempts, score]),
              ...(!attention ? [
                <button
                  type="button"
                  className={reportStyles.viewButton}
                  aria-haspopup="dialog"
                  aria-label={`View practice attempts for ${student.name}, ${student.moduleTitle}`}
                  onClick={() => setSelectedKey(student.key)}
                >
                  View
                </button>,
              ] : []),
            ],
          };
        })}
        pageKey={JSON.stringify([year, section, selectedModule, sort, query])}
        fixedPageSize={10}
        empty={students.length ? "No students match these filters." : empty}
      />
      {selectedStudent && (
        selectedStudent.isRecorded ? (
          <RecordedPracticeHistory
            key={selectedKey}
            student={selectedStudent}
            courseTitle={courseTitle}
            onClose={() => setSelectedKey(null)}
          />
        ) : (
          <ProfessorPracticeHistory
            key={selectedKey}
            student={selectedStudent}
            courseTitle={courseTitle}
            modules={modules}
            onClose={() => setSelectedKey(null)}
          />
        )
      )}
    </section>
  );
}

export default function QuizAssessmentDashboard({
  courseId,
  courseTitle,
  exportActions,
  items = [],
  course,
  tutorialMode = false,
  tutorialStep,
  onResponseViewChange,
}) {
  const modules = useMemo(() => assessmentModules(course), [course]);
  const [moduleIndex, setModuleIndex] = useState("all");
  useEffect(() => { setModuleIndex("all"); }, [courseId]);
  const moduleTitle = moduleIndex === "all"
    ? "All Modules"
    : modules[Number(moduleIndex)]?.title || "Module";
  const scopedItems = moduleIndex === "all"
    ? items
    : modules[Number(moduleIndex)]?.quizItems ||
      modules[Number(moduleIndex)]?.quiz_items || [];

  const [type, setType] = useState(
    tutorialStep?.id === "analysis-main" || tutorialStep?.id === "analysis-responses"
      ? "main"
      : "practice",
  );
  const [responseView, setResponseView] = useState(
    tutorialStep?.id === "analysis-responses",
  );
  useEffect(() => {
    onResponseViewChange?.(responseView);
  }, [onResponseViewChange, responseView]);

  const [view, setView] = useState("graph");
  const [data, setData] = useState(() => tutorialMode
    ? { attempts: tutorialAssessmentAttempts, students: tutorialAssessmentStudents }
    : { attempts: [], students: [] });
  const [status, setStatus] = useState(tutorialMode ? "" : "Loading recorded attempts…");
  const [refresh, setRefresh] = useState(0);
  const loadedCourseId = useRef(null);
  const [refreshError, setRefreshError] = useState("");
  const [passing, setPassing] = useState(tutorialMode ? 70 : null);
  const [thresholdStatus, setThresholdStatus] = useState(
    tutorialMode ? "" : "Loading the reporting threshold…",
  );
  // This holds existing practice_score_entries returned by reportController.
  // Do not mutate the database or count these as genuine adaptive responses.
  const [recordedReport, setRecordedReport] = useState({
    students: [],
    loading: !tutorialMode,
    error: "",
    unavailable: false,
  });

  useEffect(() => {
    if (tutorialMode) {
      setRecordedReport({ students: [], loading: false, error: "", unavailable: false });
      return;
    }
    const controller = new AbortController();
    setPassing(null);
    setThresholdStatus("Loading the reporting threshold.");
    setRecordedReport({ students: [], loading: true, error: "", unavailable: false });

    fetch(`${API_BASE}/reports/professor/assessments?courseId=${encodeURIComponent(courseId)}`, {
      credentials: "include",
      headers: lessonAuthHeaders(),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load professor assessment summary.");
        }
        if (controller.signal.aborted) return;
        const value = result.passingPercentage;
        setPassing(
          value != null && value !== "" && Number.isFinite(Number(value))
            ? Number(value)
            : null,
        );
        setThresholdStatus("");
        setRecordedReport({
          students: Array.isArray(result.students) ? result.students : [],
          loading: false,
          error: "",
          unavailable: result.recordedScoresUnavailable === true,
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setThresholdStatus("Could not load the reporting threshold.");
          setRecordedReport({
            students: [],
            loading: false,
            error: "Could not load saved quiz scores from the professor report.",
            unavailable: false,
          });
        }
      });
    return () => controller.abort();
  }, [tutorialMode, courseId]);

  useEffect(() => {
    if (!tutorialMode) return;
    setType(
      tutorialStep?.id === "analysis-main" || tutorialStep?.id === "analysis-responses"
        ? "main"
        : "practice",
    );
    setResponseView(tutorialStep?.id === "analysis-responses");
  }, [tutorialMode, tutorialStep?.id]);

  useEffect(() => {
    if (tutorialMode) return;
    const update = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 10000);
    return () => {
      window.removeEventListener("focus", update);
      window.clearInterval(timer);
    };
  }, [tutorialMode]);

  useEffect(() => {
    if (tutorialMode) {
      setData({ attempts: tutorialAssessmentAttempts, students: tutorialAssessmentStudents });
      setStatus("");
      setRefreshError("");
      loadedCourseId.current = courseId;
      return;
    }
    const controller = new AbortController();
    const isInitialLoad = loadedCourseId.current !== courseId;
    if (isInitialLoad) setStatus("Loading recorded attempts…");
    fetch(`${API_BASE}/assessment-attempts/${encodeURIComponent(courseId)}`, {
      credentials: "include",
      headers: lessonAuthHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw Error(result.message || "Could not load attempts.");
        }
        if (controller.signal.aborted) return;
        setData(result);
        loadedCourseId.current = courseId;
        setRefreshError("");
        setStatus("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          if (isInitialLoad) setStatus(error.message);
          else setRefreshError("Could not refresh results. Showing the last loaded data.");
        }
      });
    return () => controller.abort();
  }, [courseId, refresh, tutorialMode]);

  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [enrolledStudents, setEnrolledStudents] = useState(
    tutorialMode ? tutorialAssessmentStudents : [],
  );
  useEffect(() => {
    if (tutorialMode) {
      setEnrolledStudents(tutorialAssessmentStudents);
      return;
    }
    const controller = new AbortController();
    setEnrolledStudents([]);
    fetch(`${API_BASE}/courses/${encodeURIComponent(courseId)}/enrollments`, {
      credentials: "include",
      headers: lessonAuthHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (!controller.signal.aborted) {
          setEnrolledStudents(Array.isArray(result.enrolled) ? result.enrolled : []);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [courseId, tutorialMode]);

  const years = ["1", "2", "3", "4"];
  const roster = [...new Map(
    [...data.students, ...enrolledStudents]
      .map((student) => [String(studentId(student)), student]),
  ).values()];
  const sections = [...new Set(
    [...roster, ...data.attempts, ...recordedReport.students]
      .map(sectionOf)
      .filter((value) => value && value !== "N/A"),
  )].sort();
  const studentMatches = (student) =>
    (yearFilter === "all" || yearOf(student) === yearFilter) &&
    (sectionFilter === "all" || sectionOf(student) === sectionFilter);
  const filteredStudents = roster.filter(studentMatches);
  const filteredAttempts = data.attempts.filter((attempt) => {
    const student = roster.find((candidate) =>
      String(studentId(candidate)) === String(studentId(attempt)),
    );
    return studentMatches({ ...attempt, ...student });
  });

  const { summary, scopedAttempts } = useMemo(() => {
    const attempts = filterModuleAttempts(
      filteredAttempts,
      moduleIndex,
      modules,
    ).filter((attempt) => attempt.assessment_type === type);
    return {
      summary: summarizeAssessment(attempts, filteredStudents, scopedItems),
      scopedAttempts: attempts,
    };
  }, [data, type, scopedItems, moduleIndex, modules, yearFilter, sectionFilter, enrolledStudents]);

  const selectType = (next) => {
    setType(next);
    setResponseView(false);
  };
  const { studentsNeedingAttention } = summarizePracticeReport(summary, passing);
  const modulePerformance = useMemo(
    () => practiceModuleRows(data.attempts, modules, courseTitle),
    [data.attempts, modules, courseTitle],
  );
  const practiceRoster = new Map(
    [...data.attempts, ...roster].map((student) => [String(studentId(student)), student]),
  );
  const withStudentSection = (student) => {
    const record = practiceRoster.get(String(student.id)) ?? {};
    return {
      ...student,
      name: record.student_name || record.name || student.name || "Student",
      year: yearOf(record) || yearOf(student),
      section: sectionOf(record) || student.section || "",
    };
  };

  // At All Modules, use the existing saved five-score history for students
  // who have it, while keeping other students' real adaptive submissions.
  // Filtering by a specific module continues to use actual adaptive attempts.
  const recordedStudents = useMemo(() => {
    if (tutorialMode || moduleIndex !== "all") return [];
    return recordedReport.students
      .filter((student) => String(student.courseId ?? student.course_id) === String(courseId))
      .map((student) => {
        const history = validRecordedHistory(student.recordedHistory);
        const id = studentId(student);
        if (id == null || !history.length) return null;
        const member = roster.find((item) => String(studentId(item)) === String(id)) || {};
        const average = student.recordedAverageScore == null
          ? NaN
          : Number(student.recordedAverageScore);
        const fromHistory = history.reduce(
          (sum, entry) => sum + (100 * entry.score) / entry.total,
          0,
        ) / history.length;
        return {
          id,
          key: `course-score:${courseId}:${id}`,
          name: student.name || member.student_name || member.name || `Student ${id}`,
          year: yearOf(student) || yearOf(member),
          section: sectionOf(student) || sectionOf(member),
          moduleIndex: -2,
          moduleTitle: "Course-level quiz scores",
          attempts: history.length,
          average: Number.isFinite(average) ? average : fromHistory,
          isRecorded: true,
          recordedHistory: history,
        };
      })
      .filter(Boolean);
  }, [courseId, moduleIndex, tutorialMode, recordedReport.students, roster]);

  const displayedStudentPerformance = useMemo(() => {
    const submitted = modulePerformance.map(withStudentSection);
    if (moduleIndex !== "all" || !recordedStudents.length) {
      return submitted.filter(studentMatches);
    }
    const savedIds = new Set(recordedStudents.map((student) => String(student.id)));
    return [
      ...submitted.filter((student) => !savedIds.has(String(student.id))),
      ...recordedStudents,
    ].filter(studentMatches);
  }, [modulePerformance, recordedStudents, moduleIndex, yearFilter, sectionFilter, data.attempts, enrolledStudents]);

  const metrics = [
    ["Students", summary.assessedStudents],
    ["Attempts", summary.attempts],
    ["Avg. Score", pct(summary.average)],
    ...["LOTS", "HOTS"].map((skill) => [
      `Avg. ${skill}`,
      pct(summary.cognitive.find((item) => item.label === skill)?.percent ?? null),
    ]),
  ];

  return (
    <section className="qa-dashboard">
      {refreshError && <p role="status">{refreshError}</p>}
      <div className="qa-module-filter qa-shared-filters">
        <div className="qa-filter-caption">
          Filter Responses
          <button
            type="button"
            onClick={() => {
              setYearFilter("all");
              setSectionFilter("all");
              setModuleIndex("all");
              setView("graph");
            }}
          >
            Clear all
          </button>
        </div>
        <label>
          Year Level
          <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">All Year Levels</option>
            {years.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          Section
          <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
            <option value="all">All Sections</option>
            {sections.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <div className="qa-filter-field">
          <label htmlFor="analysis-module">Module</label>
          <select
            id="analysis-module"
            value={moduleIndex}
            onChange={(event) => setModuleIndex(event.target.value)}
          >
            <option value="all">All Modules</option>
            {modules.map((module, index) => (
              <option key={module.id || index} value={String(index)}>
                {index + 1}. {module.title || `Module ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
        {type === "practice" && (
          <label>
            View as
            <select value={view} onChange={(event) => setView(event.target.value)}>
              <option value="graph">Graphical View</option>
              <option value="table">Table View</option>
            </select>
          </label>
        )}
      </div>
      <div className="qa-workspace-navigation">
        <nav className="qa-assessment-tabs" aria-label="Assessment type">
          {["practice", "main"].map((value) => (
            <button
              key={value}
              data-tutorial={value === "practice" ? "analysis-practice-tab" : "analysis-main-tab"}
              aria-pressed={type === value && !responseView}
              onClick={() => selectType(value)}
            >
              {value === "practice" ? "Practice Quiz" : "Main Quiz"}
            </button>
          ))}
        </nav>
        <button
          className="qa-response-button"
          type="button"
          data-tutorial="analysis-responses-tab"
          aria-pressed={responseView}
          onClick={() => {
            setType("main");
            setResponseView(true);
          }}
        >
          Responses
        </button>
      </div>
      {type === "main" ? (
        <div className="qa-main-analysis">
          {status ? (
            <p className={styles.message} role="status">{status}</p>
          ) : tutorialMode && responseView ? (
            <MainQuizResponses
              courseId={courseId}
              courseTitle={`${courseTitle} - ${moduleTitle}`}
              quizTitle="Main Quiz 1"
              assessmentTitle={`${courseTitle} - Main Quiz`}
              attempts={tutorialMainQuizResponses}
              passScore={1}
              onBack={() => setResponseView(false)}
              embedded
            />
          ) : (
            <MainQuizAnalysis
              key={JSON.stringify([courseId, moduleIndex, yearFilter, sectionFilter])}
              courseId={courseId}
              courseTitle={courseTitle}
              passScore={course?.passScore ?? course?.pass_score}
              attempts={scopedAttempts}
              students={filteredStudents}
              moduleIndex={moduleIndex}
              modules={modules}
              moduleTitle={moduleTitle}
              responseView={responseView}
              onSummary={() => setResponseView(false)}
            />
          )}
        </div>
      ) : (
        <div className="qa-content-panel qa-print-report">
          <div className={`${styles.detailTop} qa-heading`}>
            {exportActions}
            <div className={styles.detailTitle}>
              <p className={styles.detailEyebrow}>PRACTICE QUIZ ANALYSIS</p>
              <h2>{courseTitle}</h2>
              <p className="qa-report-module">{moduleTitle}</p>
            </div>
            <button
              type="button"
              className="qa-print-button"
              onClick={() => window.print()}
              disabled={Boolean(status)}
            >
              Print
            </button>
          </div>
          {status ? (
            <p role="status">{status}</p>
          ) : (
            <>
              <div className={styles.analysisSectionTitle}>
                Overall Practice Quiz Analysis
              </div>
              <div className={`${styles.performanceGrid} qa-metrics`}>
                {metrics.map(([label, value]) => (
                  <article className={styles.performanceCard} key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              <PracticeLearningPerformance
                key={JSON.stringify([courseId, moduleIndex, yearFilter, sectionFilter])}
                attempts={scopedAttempts}
                modules={modules}
                items={scopedItems}
                showModule={moduleIndex === "all"}
                view={view}
              />
              <PracticeStudentReport
                key={`performance:${courseId}:${moduleIndex}:${yearFilter}:${sectionFilter}`}
                title="Student Practice Performance"
                description="View saved quiz scores and submitted Practice Quiz attempts. Saved course scores appear under All Modules."
                students={displayedStudentPerformance}
                courseTitle={courseTitle}
                modules={modules}
                moduleScope={moduleIndex}
                years={years}
                sections={sections}
                recordedLoading={recordedReport.loading}
                recordedError={recordedReport.error}
                recordedUnavailable={recordedReport.unavailable}
                empty="No practice attempts match these filters."
              />
              <PracticeStudentReport
                key={`attention:${courseId}:${moduleIndex}:${yearFilter}:${sectionFilter}`}
                title="Students Needing Attention"
                description={passing == null
                  ? "The reporting threshold is not configured."
                  : `Students with a practice average below the ${pct(passing)} reporting threshold.`}
                students={studentsNeedingAttention.map(withStudentSection)}
                courseTitle={courseTitle}
                years={years}
                sections={sections}
                attention
                empty={thresholdStatus || (passing == null
                  ? "The reporting threshold is not configured."
                  : "No students with scored practice attempts are below the threshold.")}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
