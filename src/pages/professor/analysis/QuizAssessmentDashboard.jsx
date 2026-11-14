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
import { summarizeAssessment, summarizePracticeReport } from "../../../utils/assessmentAnalytics.js";
import { AssessmentReportTable } from "./ProfessorStudentPerformance.jsx";
import {
  tutorialAssessmentAttempts,
  tutorialAssessmentStudents,
  tutorialMainQuizResponses,
} from "../tutorial/professorTutorialExamples.js";

const pct = (value) =>
  value == null || !Number.isFinite(value)
    ? "Not assessed"
    : `${Math.round(value)}%`;

const responseAccuracy = (row) =>
  row.responses > 0 ? (row.correct / row.responses) * 100 : null;

function topicRemark(topic) {
  if (!topic.responses) return "Not assessed";
  if (topic.responses < 5) return "Limited evidence";
  if (topic.percent < 50) return "Needs review";
  if (topic.percent < 80) return "Developing";
  return "Strong";
}

function Bars({ rows }) {
  return (
    <div className="qa-bars">
      {rows.map((row) => (
        <div key={row.key || row.label}>
          <span>
            {row.label}
            {row.detail && <small className="qa-bar-detail">{row.detail}</small>}
          </span>
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
          <strong className={row.percent == null ? "qa-bars-unassessed" : undefined}>
            {pct(row.percent)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function CoverageBars({ rows, pageSize = 10 }) {
  const [selectedPage, setSelectedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(selectedPage, pageCount);
  const firstVisiblePage = Math.max(
    1,
    Math.min(page - 2, pageCount - Math.min(pageCount, 5) + 1),
  );
  const visiblePages = Array.from(
    { length: Math.min(pageCount, 5) },
    (_, index) => firstVisiblePage + index,
  );
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div className="qa-bars qa-coverage-bars">
        {pageRows.map((row) => (
          <div key={row.key}>
            <span>
              {row.label}
              <small className="qa-bar-detail">{row.detail}</small>
            </span>
            <div className="qa-bar-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percent ?? 0} aria-label={`${row.label} accuracy`}>
              <div style={{ width: `${row.percent ?? 0}%` }} />
            </div>
            <strong>{pct(row.percent)}</strong>
          </div>
        ))}
      </div>
      {pageCount > 1 && (
        <nav className="qa-bars-pagination" aria-label="Table of specifications pages">
          <button type="button" disabled={page === 1} onClick={() => setSelectedPage(page - 1)}>
            Previous
          </button>
          {visiblePages.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              aria-current={page === pageNumber ? "page" : undefined}
              aria-label={`Page ${pageNumber}`}
              onClick={() => setSelectedPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button type="button" disabled={page === pageCount} onClick={() => setSelectedPage(page + 1)}>
            Next
          </button>
        </nav>
      )}
    </>
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
    fetch(`${API_BASE}/reports/professor/assessments`, {
      credentials: "include",
      headers: lessonAuthHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw Error();
        if (controller.signal.aborted) return;
        const value = result.passingPercentage;
        setPassing(value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
        setThresholdStatus("");
      })
      .catch(() => {
        if (!controller.signal.aborted) setThresholdStatus("Could not load the reporting threshold.");
      });
    return () => controller.abort();
  }, [tutorialMode]);
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
  const summary = useMemo(
    () => {
      const attempts = filterModuleAttempts(
        filteredAttempts,
        moduleIndex,
        modules,
      ).filter((attempt) => attempt.assessment_type === type);
      return summarizeAssessment(attempts, filteredStudents, scopedItems);
    },
    [data, type, scopedItems, moduleIndex, modules, yearFilter, sectionFilter, enrolledStudents],
  );
  const cognitiveRows = ["LOTS", "HOTS"].map((label) => ({
    label,
    percent: summary.cognitive.find((row) => row.label === label)?.percent ?? null,
  }));
  const levelLabels = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
    ...(summary.levels.some((row) => row.label === "Not specified")
      ? ["Not specified"]
      : []),
  ];
  const levels = levelLabels.map((label) => ({
    label,
    percent: summary.levels.find((row) => row.label === label)?.percent ?? null,
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
  const thinkingSkillRows = [
    ...cognitiveRows,
    ...summary.cognitive.filter(
      (row) => !["LOTS", "HOTS"].includes(row.label),
    ),
  ];
  const skillAndLevelRows = [
    ...thinkingSkillRows.map((row) => {
      const result = summary.cognitive.find((entry) => entry.label === row.label);
      const responses = result?.responses ?? 0;
      return {
        key: `skill:${row.label}`,
        cells: [
          `${row.label} (Thinking Skill)`,
          pct(result?.percent ?? null),
          responses,
          topicRemark({ responses, percent: result?.percent ?? null }),
        ],
      };
    }),
    ...levels.map((row) => {
      const result = summary.levels.find((entry) => entry.label === row.label);
      const responses = result?.responses ?? 0;
      return {
        key: `level:${row.label}`,
        cells: [
          `${row.label} (Cognitive Level)`,
          pct(result?.percent ?? null),
          responses,
          topicRemark({ responses, percent: result?.percent ?? null }),
        ],
      };
    }),
  ];
  const lotsShare = classifiedCount
    ? (skillCounts[0].count / classifiedCount) * 100
    : 0;
  const selectType = (next) => {
    setType(next);
    setResponseView(false);
  };
  const { coverage, studentPerformance, studentsNeedingAttention } =
    summarizePracticeReport(summary, passing);
  const studentColumns = ["Student", "Scored Practice Attempts", "Average Score"];
  const studentRow = (student) => ({
    key: student.id,
    cells: [student.name, student.attempts, student.average == null ? "N/A" : pct(student.average)],
  });
  const metrics = [
    ["Students", summary.assessedStudents],
    ["Attempts", summary.attempts],
    ["Avg. Score", pct(summary.average)],
    ...["LOTS", "HOTS"].map((skill) => [
      `Avg. ${skill}`,
      pct(summary.cognitive.find((r) => r.label === skill)?.percent ?? null),
    ]),
  ];
  const orderedTopics = [...summary.topics].sort(
    (a, b) => a.percent - b.percent,
  );
  const lowEvidenceTopics = orderedTopics.filter(
    (topic) => topic.responses < 5,
  );
  const topicsForReview = orderedTopics.filter(
    (topic) => topic.responses >= 5 && topic.percent < 50,
  );
  const priorityTopics = topicsForReview.slice(0, 3);
  const topicRecommendation = !summary.questions.length
    ? "Topic recommendations will appear after scored question responses are recorded."
    : [
        priorityTopics.length
          ? `Review first: ${priorityTopics
              .map((topic) => `${topic.label} (${pct(topic.percent)}, ${topic.responses} responses)`)
              .join("; ")}${topicsForReview.length > priorityTopics.length ? `; ${topicsForReview.length - priorityTopics.length} more topics are below 50%` : ""}.`
          : "No topic with enough responses currently falls below 50% accuracy.",
        lowEvidenceTopics.length
          ? `${lowEvidenceTopics.length} ${lowEvidenceTopics.length === 1 ? "topic has" : "topics have"} fewer than five responses; collect more data before judging mastery.`
          : "",
      ].join(" ");
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
      {((type === "main" && moduleIndex !== "all") || responseView) ? (
        <div className="qa-main-analysis">
          {tutorialMode && responseView ? (
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
                  {type === "practice" ? "Practice Quiz" : "Main Quiz"} Table of Specifications
                </div>
                {!coverage.length ? (
                  <p>
                    The {type} table of specifications appears after students
                    submit question responses.
                  </p>
                ) : view === "graph" ? (
                  <CoverageBars
                    key={`coverage:${courseId}:${type}:${moduleIndex}:${yearFilter}:${sectionFilter}`}
                    rows={coverage.map((row) => ({
                      key: row.key,
                      label: row.topic,
                      detail: `${row.skill} · ${row.level} · ${row.questions} ${row.questions === 1 ? "question" : "questions"} · ${row.responses} ${row.responses === 1 ? "response" : "responses"}`,
                      percent: responseAccuracy(row),
                    }))}
                  />
                ) : (
                  <AssessmentReportTable
                    columns={["Topic", "Thinking Skill", "Cognitive Level", "Questions", "Responses", "Accuracy"]}
                    rows={coverage.map((row) => ({
                      key: row.key,
                      cells: [row.topic, row.skill, row.level, row.questions, row.responses, pct(responseAccuracy(row))],
                    }))}
                    pageKey={`coverage:${courseId}:${type}:${moduleIndex}:${yearFilter}:${sectionFilter}`}
                    fixedPageSize={10}
                    empty={`The ${type} table of specifications appears after students submit question responses.`}
                  />
                )}

                <div className={styles.analysisSectionTitle}>
                  Topic Performance Summary
                </div>
                <p className="qa-topic-intro">
                  Topic accuracy combines correct responses across recorded {type} attempts,
                  including retakes. {topicRecommendation} Ratings are descriptive, not
                  grades: below 50% needs review, 50–79% is developing, and 80% or higher
                  is strong. Fewer than five responses means limited evidence.
                </p>
                {!summary.topics.length ? (
                  <p>
                    Topic performance appears after attempts include question
                    responses.
                  </p>
                ) : view === "graph" ? (
                  <Bars rows={summary.topics} />
                ) : (
                  <AssessmentReportTable
                    columns={["Topic", "Accuracy", "Responses", "Remark"]}
                    rows={summary.topics.map((topic) => ({
                      key: topic.label,
                      cells: [
                        topic.label,
                        pct(topic.percent),
                        topic.responses,
                        topicRemark(topic),
                      ],
                    }))}
                    pageKey={`topics:${type}:${moduleIndex}:${yearFilter}:${sectionFilter}`}
                    fixedPageSize={5}
                    empty="Topic results will appear after scored responses are recorded."
                  />
                )}
                <div className={styles.analysisSectionTitle}>
                  Performance by Thinking Skill and Cognitive Level
                </div>
                {view === "table" ? (
                  <AssessmentReportTable
                    columns={["Category", "Accuracy", "Responses", "Remark"]}
                    rows={skillAndLevelRows}
                    pageKey={`skills:${courseId}:${type}:${moduleIndex}:${yearFilter}:${sectionFilter}`}
                    fixedPageSize={10}
                    empty="Skill and cognitive-level results will appear after scored responses are recorded."
                  />
                ) : (
                  <>
                    <div className="qa-cognitive-grid">
                      <article className="qa-cognitive-card">
                        <h4>LOTS / HOTS Question Distribution</h4>
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
                        <p>
                          {classifiedCount
                            ? `Question distribution among ${classifiedCount} question records with a LOTS or HOTS classification.`
                            : "No LOTS or HOTS question records are available for the current filters."}
                        </p>
                      </article>
                      <article className="qa-cognitive-card">
                        <h4>Cognitive Levels</h4>
                        <Bars rows={levels} />
                        <p>Accuracy is based on recorded responses at each cognitive level. “Not assessed” means no responses were available.</p>
                      </article>
                    </div>
                    <Bars rows={cognitiveRows} />
                    <p className="qa-skill-guide">
                      LOTS: Lower-Order Thinking Skills · HOTS: Higher-Order
                      Thinking Skills. Accuracy describes submitted responses; “Not assessed” means no response data is available.
                    </p>
                  </>
                )}
              </>

              {type === "practice" ? (
                <>
                  <div className={styles.analysisSectionTitle}>Student Practice Performance</div>
                  <AssessmentReportTable
                    columns={studentColumns}
                    rows={studentPerformance.map(studentRow)}
                    empty="No students match these filters."
                  />
                  <div className={styles.analysisSectionTitle}>Students Needing Attention</div>
                  <AssessmentReportTable
                    columns={studentColumns}
                    rows={studentsNeedingAttention.map(studentRow)}
                    empty={thresholdStatus || (passing == null
                      ? "The reporting threshold is not configured."
                      : "No students with scored practice attempts are below the threshold.")}
                  />
                </>
              ) : (
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
                              <td>{q.level || "Not specified"}</td>
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
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
