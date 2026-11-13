import {
  assessmentModules,
  filterModuleAttempts,
} from "../../../utils/assessmentModuleScope.js";
import styles from "./AssessmentAnalysis.module.css";
import MainQuizAnalysis from "./MainQuizAnalysis.jsx";
import MainQuizResponses from "./MainQuizResponses.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../../config.js";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import "./QuizAssessmentDashboard.css";
import { summarizeAssessment } from "../../../utils/assessmentAnalytics.js";
import {
  tutorialAssessmentAttempts,
  tutorialAssessmentStudents,
  tutorialMainQuizResponses,
} from "../tutorial/professorTutorialExamples.js";

const pct = (value) =>
  value === null || !Number.isFinite(value) ? "0%" : `${Math.round(value)}%`;

function Bars({ rows }) {
  return (
    <div className="qa-bars">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <div
            className="qa-bar-track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={row.percent || 0}
            aria-label={row.label}
          >
            <div style={{ width: `${row.percent || 0}%` }} />
          </div>
          <strong>{pct(row.percent)}</strong>
        </div>
      ))}
    </div>
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
  });  const summary = useMemo(
    () =>
      summarizeAssessment(
        filterModuleAttempts(filteredAttempts, moduleIndex, modules).filter(
          (a) => a.assessment_type === type,
        ),
        filteredStudents,
        scopedItems,
      ),
    [data, type, scopedItems, moduleIndex, modules, yearFilter, sectionFilter, enrolledStudents],
  );
  const cognitiveRows = ["LOTS", "HOTS"].map((label) => ({
    label,
    percent: summary.cognitive.find((row) => row.label === label)?.percent || 0,
  }));
  const levels = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
  ].map((label) => ({
    label,
    percent: summary.levels.find((row) => row.label === label)?.percent || 0,
  }));
  const skillCounts = cognitiveRows.map((row) => ({
    ...row,
    count: summary.questions.filter((question) => question.skill === row.label)
      .length,
  }));
  const classifiedCount = skillCounts.reduce(
    (total, row) => total + row.count,
    0,
  );
  const lotsShare = classifiedCount
    ? (skillCounts[0].count / classifiedCount) * 100
    : 0;
  const selectType = (next) => {
    setType(next);
    setResponseView(false);
  };
  const metrics = [
    ["Students", summary.students.length],
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
          onChange={(event) => {
            setModuleIndex(event.target.value);

          }}
        >
          <option value="all">All Modules</option>
          {modules.map((module, index) => (
            <option key={module.id || index} value={String(index)}>
              {index + 1}. {module.title || `Module ${index + 1}`}
            </option>
          ))}
        </select></div><label>View as<select value={view} onChange={e => setView(e.target.value)}><option value="graph">Graphical View</option><option value="table">Table View</option></select></label>
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
      {(moduleIndex !== "all" || responseView) ? (
        <div className="qa-main-analysis">
          {tutorialMode && responseView ? (
            <MainQuizResponses
              courseId={courseId}
              courseTitle={`${courseTitle} - ${moduleTitle}`}
              quizTitle="Main Quiz 1"
              attempts={tutorialMainQuizResponses}
              passScore={1}
              onBack={() => setResponseView(false)}
              embedded
            />
          ) : (
            <MainQuizAnalysis
              key={`${courseId}:${moduleIndex}`}
              filteredAttempts={filteredAttempts}
              analysisView={view}
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
                {type === "practice"
                  ? "PRACTICE QUIZ ANALYSIS"
                  : "MAIN QUIZ ANALYSIS"}
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
              <>
                <div className={styles.analysisSectionTitle}>
                  Overall {type === "practice" ? "Practice" : "Main"} Quiz
                  Analysis
                </div>
                <div className={`${styles.performanceGrid} qa-metrics`}>
                  {metrics.map(([label, value]) => (
                    <article className={styles.performanceCard} key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>

                <div className={styles.analysisSectionTitle}>
                  Topic Performance
                </div>
                <p className="qa-topic-intro">
                  Topic performance shows how accurately students answered
                  questions about each topic across all recorded {type}
                  attempts. It helps identify which topics students understand
                  and which need further explanation or practice. Repeated
                  attempts are included in these results.
                </p>
                {!summary.topics.length ? (
                  <p>
                    Topic performance appears after attempts include question
                    responses.
                  </p>
                ) : view === "graph" ? (
                  <Bars rows={summary.topics} />
                ) : (
                  <div className="qa-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Topic</th>
                          <th>Correct</th>
                          <th>Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.topics.map((topic) => (
                          <tr key={topic.label}>
                            <td>{topic.label}</td>
                            <td>{pct(topic.percent)}</td>
                            <td>
                              {topic.percent >= 80
                                ? "Strong"
                                : topic.percent >= 60
                                  ? "Average"
                                  : "Weak"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className={styles.analysisSectionTitle}>
                  Performance by Thinking Skill
                </div>
                <div className="qa-cognitive-grid">
                  <article className="qa-cognitive-card">
                    <h4>LOTS / HOTS</h4>
                    {view === "graph" ? (
                      <>
                        <div
                          className="qa-donut"
                          role="img"
                          aria-label={
                            classifiedCount
                              ? `Question distribution: LOTS ${pct(lotsShare)}, HOTS ${pct(100 - lotsShare)}`
                              : "No classified question responses yet"
                          }
                          style={{
                            background: classifiedCount
                              ? `conic-gradient(#24476b 0 ${lotsShare}%, #7fa8d6 ${lotsShare}% 100%)`
                              : "#edf1f5",
                          }}
                        >
                          <span>
                            {classifiedCount}
                            <small>questions</small>
                          </span>
                        </div>
                        <div className="qa-chart-legend">
                          <span>
                            <i style={{ background: "#24476b" }} />
                            LOTS {pct(lotsShare)}
                          </span>
                          <span>
                            <i style={{ background: "#7fa8d6" }} />
                            HOTS {pct(classifiedCount ? 100 - lotsShare : 0)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="qa-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Thinking Skill</th>
                              <th>Questions</th>
                              <th>Share (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {skillCounts.map((row) => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>{row.count}</td>
                                <td>
                                  {pct(
                                    classifiedCount
                                      ? (row.count / classifiedCount) * 100
                                      : 0,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p>Share of classified questions in recorded responses.</p>
                  </article>
                  <article className="qa-cognitive-card">
                    <h4>Cognitive Levels</h4>
                    {view === "graph" ? (
                      <Bars rows={levels} />
                    ) : (
                      <div className="qa-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Level</th>
                              <th>Correct</th>
                            </tr>
                          </thead>
                          <tbody>
                            {levels.map((row) => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>{pct(row.percent)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p>Percentage of correct responses at each level.</p>
                  </article>
                </div>
                {view === "table" && (
                  <div className="qa-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Thinking Skill</th>
                          <th>Correct</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cognitiveRows.map((r) => (
                          <tr key={r.label}>
                            <td>{r.label}</td>
                            <td>{pct(r.percent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {view === "graph" && <Bars rows={cognitiveRows} />}
                <p className="qa-skill-guide">
                  LOTS: Lower-Order Thinking Skills · HOTS: Higher-Order
                  Thinking Skills
                </p>
              </>

              <>
                <div className={styles.analysisSectionTitle}>
                  Question Analysis
                </div>
                {!summary.questions.length ? (
                  <p>
                    Question analysis appears after attempts include question
                    responses. Older score-only attempts remain included in
                    overall score totals.
                  </p>
                ) : (
                  <>
                    <div className="qa-table qa-question-analysis">
                      <table>
                        <thead>
                          <tr>
                            <th>Question</th>
                            <th>Topic</th>
                            <th>Skill</th>
                            <th>Level</th>
                            <th>Responses</th>
                            <th>Correct (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.questions.map((q, i) => (
                            <tr key={i}>
                              <td>
                                <strong>Question {i + 1}</strong>
                                <p>{q.question}</p>
                              </td>
                              <td>{q.topic}</td>
                              <td>{q.skill}</td>
                              <td>{q.level || "Unclassified"}</td>
                              <td>{q.responses}</td>
                              <td>
                                {view === "graph" && (
                                  <div
                                    className="qa-bar-track qa-question-bar"
                                    role="meter"
                                    aria-label={`Question ${i + 1} correct responses`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={q.percent || 0}
                                  >
                                    <div
                                      style={{ width: `${q.percent || 0}%` }}
                                    />
                                  </div>
                                )}
                                {pct(q.percent)}
                                <small style={{ display: "block" }}>
                                  {q.correct} of {q.responses} correct
                                </small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            </>
          )}
        </div>
      )}
    </section>
  );
}
