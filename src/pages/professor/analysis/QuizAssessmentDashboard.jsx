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
import { practiceModuleRows, summarizeAssessment, summarizePracticeReport } from "../../../utils/assessmentAnalytics.js";
import { AssessmentReportTable } from "./ProfessorStudentPerformance.jsx";
import ProfessorPracticeHistory from "./ProfessorPracticeHistory.jsx";
import PracticeLearningPerformance from "./PracticeLearningPerformance.jsx";
import {
  tutorialAssessmentAttempts,
  tutorialAssessmentStudents,
  tutorialMainQuizResponses,
} from "../tutorial/professorTutorialExamples.js";

const pct = (value) =>
  value == null || !Number.isFinite(value)
    ? "Not assessed"
    : `${Math.round(value)}%`;

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
      return a.name.localeCompare(b.name) || a.moduleIndex - b.moduleIndex || a.key.localeCompare(b.key);
    });
  }
  const measures = attention ? ["Average Score", "Practice Attempts"] : ["Practice Attempts", "Average Score"];
  const selectedStudent = rows.find((student) => student.key === selectedKey);

  return (
    <section className={`${reportStyles.panel} ${reportStyles.studentReport} ${reportStyles.practiceReport}`} aria-labelledby={headingId}>
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
              {sections.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          {!attention && (
            <>
              <label className={reportStyles.yearSectionFilter}>
                <span>Module</span>
                <select value={selectedModule} disabled={moduleScope !== "all"} onChange={(event) => setModuleFilter(event.target.value)}>
                  {moduleScope === "all" && <option value="all">All Modules</option>}
                  {modules.map((module, index) => (moduleScope === "all" || String(index) === moduleScope) && (
                    <option key={module.id ?? index} value={String(index)}>{assessmentModuleTitle(modules, index)}</option>
                  ))}
                  {moduleScope === "all" && students.some((student) => student.moduleIndex === -1) && (
                    <option value="-1">Module unavailable</option>
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
            <input type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder={attention ? "Search students or courses" : "Search students or modules"} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>
      </div>
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
        fixedPageSize={attention ? 10 : 5}
        empty={students.length ? "No students match these filters." : empty}
      />
      {selectedStudent && (
        <ProfessorPracticeHistory
          key={selectedKey}
          student={selectedStudent}
          onClose={() => setSelectedKey(null)}
        />
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
  useEffect(() => {
    setModuleIndex("all");
  }, [courseId]);
  const moduleTitle =
    moduleIndex === "all"
      ? "All Modules"
      : modules[Number(moduleIndex)]?.title || "Module";
  const scopedItems =
    moduleIndex === "all"
      ? items
      : modules[Number(moduleIndex)]?.quizItems ||
        modules[Number(moduleIndex)]?.quiz_items ||
        [];
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
  const [data, setData] = useState(() =>
    tutorialMode
      ? { attempts: tutorialAssessmentAttempts, students: tutorialAssessmentStudents }
      : { attempts: [], students: [] },
  );
  const [status, setStatus] = useState(tutorialMode ? "" : "Loading recorded attempts…");
  const [refresh, setRefresh] = useState(0);
  const loadedCourseId = useRef(null);
  const [refreshError, setRefreshError] = useState("");
  const [passing, setPassing] = useState(tutorialMode ? 70 : null);
  const [thresholdStatus, setThresholdStatus] = useState(
    tutorialMode ? "" : "Loading the reporting threshold…",
  );
  useEffect(() => {
    if (tutorialMode) return;

    const controller = new AbortController();
    setPassing(null);
    setThresholdStatus("Loading the reporting threshold.");
    fetch(`${API_BASE}/reports/professor/assessments?courseId=${encodeURIComponent(courseId)}`, {
      credentials: "include",
      headers: lessonAuthHeaders(),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error("Could not load professor assessment summary.");
        }
        if (controller.signal.aborted) return;

        const value = result.passingPercentage;
        setPassing(
          value != null &&
          value !== "" &&
          Number.isFinite(Number(value))
            ? Number(value)
            : null,
        );

        setThresholdStatus("");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setThresholdStatus("Could not load the reporting threshold.");
        }
      });
    return () => controller.abort();
  }, [tutorialMode, courseId]);
  useEffect(() => {
    if (!tutorialMode) return;
    setType(tutorialStep?.id === "analysis-main" || tutorialStep?.id === "analysis-responses" ? "main" : "practice");
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
  }, []);
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
        if (!response.ok || !result.success)
          throw Error(result.message || "Could not load attempts.");
        if (controller.signal.aborted) return;
        setData(result);
        loadedCourseId.current = courseId;
        setRefreshError("");
        setStatus("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          if (isInitialLoad) setStatus(error.message);
          else
            setRefreshError(
              "Could not refresh results. Showing the last loaded data.",
            );
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
    fetch(`${API_BASE}/courses/${encodeURIComponent(courseId)}/enrollments`, { credentials: "include", headers: lessonAuthHeaders(), signal: controller.signal })
      .then(async response => { if (!response.ok) return; const result = await response.json(); if (!controller.signal.aborted) setEnrolledStudents(Array.isArray(result.enrolled) ? result.enrolled : []); })
      .catch(() => {});
    return () => controller.abort();
  }, [courseId, tutorialMode]);
  const yearOf = (s) => {
    const value = String(s.year_level ?? s.yearLevel ?? s.student_year_level ?? s.year ?? s.student?.year_level ?? "").trim();
    return value.match(/[1-4]/)?.[0] || value;
  };
  const sectionOf = (s) => String(s.section_name ?? s.sectionName ?? s.student_section ?? s.section ?? s.student?.section ?? "").trim();
  const years = ["1", "2", "3", "4"];
  const roster = [...new Map([...data.students, ...enrolledStudents].map(s => [String(s.user_id ?? s.userId ?? s.id), s])).values()];
  const sections = [...new Set([...roster, ...data.attempts].map(sectionOf).filter(value => value && value !== "N/A"))].sort();
  const studentMatches = s => (yearFilter === "all" || yearOf(s) === yearFilter) && (sectionFilter === "all" || sectionOf(s) === sectionFilter);
  const filteredStudents = roster.filter(studentMatches);
  const filteredAttempts = data.attempts.filter(a => {
    const student = roster.find(s => String(s.user_id ?? s.userId ?? s.id) === String(a.user_id ?? a.userId));
    return studentMatches({ ...a, ...student });
  });
  const { summary, scopedAttempts } = useMemo(
    () => {
      const attempts = filterModuleAttempts(
        filteredAttempts,
        moduleIndex,
        modules,
      ).filter((attempt) => attempt.assessment_type === type);
      return { summary: summarizeAssessment(attempts, filteredStudents, scopedItems), scopedAttempts: attempts };
    },
    [data, type, scopedItems, moduleIndex, modules, yearFilter, sectionFilter, enrolledStudents],
  );
  const selectType = (next) => {
    setType(next);
    setResponseView(false);
  };
  const { studentsNeedingAttention } =
    summarizePracticeReport(summary, passing);
  const modulePerformance = useMemo(
    () => practiceModuleRows(data.attempts, modules, courseTitle),
    [data.attempts, modules, courseTitle],
  );
  const practiceRoster = new Map([...data.attempts, ...roster].map((student) =>
    [String(student.user_id ?? student.userId ?? student.id), student],
  ));
  const withStudentSection = (student) => {
    const record = practiceRoster.get(String(student.id)) ?? {};
    return {
      ...student,
      name: record.student_name || record.name || student.name || "Student",
      year: yearOf(record) || yearOf(student),
      section: sectionOf(record) || student.section || "",
    };
  };

  const displayedStudentPerformance = modulePerformance
    .map(withStudentSection)
    .filter(studentMatches);
  const metrics = [
    ["Students", summary.assessedStudents],
    ["Attempts", summary.attempts],
    ["Avg. Score", pct(summary.average)],
    ...["LOTS", "HOTS"].map((skill) => [
      `Avg. ${skill}`,
      pct(summary.cognitive.find((r) => r.label === skill)?.percent ?? null),
    ]),
  ];
  return (
    <section className="qa-dashboard">
      {refreshError && <p role="status">{refreshError}</p>}
      <div className="qa-module-filter qa-shared-filters">
        <div className="qa-filter-caption">Filter Responses <button type="button" onClick={() => { setYearFilter("all"); setSectionFilter("all"); setModuleIndex("all"); setView("graph"); }}>Clear all</button></div>
        <label>Year Level<select value={yearFilter} onChange={e => setYearFilter(e.target.value)}><option value="all">All Year Levels</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
        <label>Section<select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}><option value="all">All Sections</option>{sections.map(s => <option key={s}>{s}</option>)}</select></label>
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
          <label>View as
            <select value={view} onChange={event => setView(event.target.value)}>
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
        {(
          <button
            className="qa-response-button"
            type="button"
            data-tutorial="analysis-responses-tab"
            aria-pressed={responseView}
            onClick={() => { setType("main"); setResponseView(true); }}
          >
            Responses
          </button>
        )}
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
          <div className={`${styles.detailTop} qa-heading`}> {exportActions}
            <div className={styles.detailTitle}>
              <p className={styles.detailEyebrow}>
                PRACTICE QUIZ ANALYSIS
              </p>
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
                description="View each student's submitted Adaptive Practice Quiz attempts and average score by module."
                students={displayedStudentPerformance}
                modules={modules}
                moduleScope={moduleIndex}
                years={years}
                sections={sections}
                empty="No practice attempts match these filters."
              />
              <PracticeStudentReport
                key={`attention:${courseId}:${moduleIndex}:${yearFilter}:${sectionFilter}`}
                title="Students Needing Attention"
                description={passing == null ? "The reporting threshold is not configured." : `Students with a practice average below the ${pct(passing)} reporting threshold.`}
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
