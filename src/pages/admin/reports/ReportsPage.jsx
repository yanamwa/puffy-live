import { useEffect, useMemo, useState } from "react";
import {
  FiActivity, FiBarChart2, FiBookOpen, FiCalendar, FiDownload,
  FiFileText, FiLayers, FiPrinter, FiSearch, FiShield,
  FiUserCheck, FiUsers, FiAlertCircle,
} from "react-icons/fi";
import { fetchReports, fetchReportConfig } from "../../../services/reportApi";
import { downloadReportsPdf } from "../../../services/reportPdf";
import AdminStatCard from "../shared/AdminStatCard.jsx";
import "./ReportsPage.css";

const FILTERS = [
  ["today", "Today"], ["week", "This Week"], ["month", "This Month"],
  ["semester", "Semester"], ["school-year", "School Year"], ["custom", "Custom Date Range"],
];
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = value => value == null || !Number.isFinite(Number(value)) ? "N/A" : `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
const dateString = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const isAcademic = f => f === "semester" || f === "school-year";
function getRange(filter, custom, settings) {
  if (filter === "custom") return custom;
  if (filter === "semester") return { start: settings?.semesterStartDate || "", end: settings?.semesterEndDate || "" };
  if (filter === "school-year") return { start: settings?.schoolYearStartDate || "", end: settings?.schoolYearEndDate || "" };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (filter === "month") start.setDate(1);
  return { start: dateString(start), end: dateString(now) };
}
function Section({ icon: Icon, title, subtitle, action, children }) {
  return <section className="report-section">
    <div className="report-section-header"><span className="report-section-icon"><Icon /></span>
      <div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}
  </section>;
}
function Table({ columns, rows, empty = "No records found." }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);
  const renderTable = (tableRows, print = false) => <table className="report-table">
    <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>{tableRows.length ? tableRows.map((r, i) => <tr key={r.key ?? i}>{r.cells.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) :
      <tr><td colSpan={columns.length} className="report-table-empty">{empty}</td></tr>}</tbody>
  </table>;
  return <div className="report-paginated-table">
    <div className="report-table-wrap">{renderTable(visibleRows)}</div>
    <div className="report-print-table">{renderTable(rows, true)}</div>
    {rows.length > 0 && <div className="report-pagination">
      <span className="report-pagination-info">Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length} records</span>
      <div className="report-pagination-controls">
        <label>Rows per page <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
          <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
        </select></label>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(1)}>First</button>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span>{currentPage} / {totalPages}</span>
        <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
        <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>Last</button>
      </div>
    </div>}
  </div>;
}
function Bars({ items }) {
  const max = Math.max(1, ...items.map(x => number(x.value)));
  return <div className="report-bars">{items.length ? items.map((item, i) =>
    <div className="report-bar-row" key={`${item.label}-${i}`}><div><span>{item.label}</span><strong>{item.value}</strong></div>
      <i><b style={{ width: `${100 * number(item.value) / max}%` }} /></i></div>) : <p>No activity recorded for this period.</p>}</div>;
}
function csvCell(v) {
  let value = String(v ?? "");
  if (/^\s*[=+\-@\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replace(/"/g, '""')}"`;
}
function saveCSV(rows, filename) {
  const csv = "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ReportsPage({ superAdmin = false }) {
  const reportOwner = superAdmin ? "Super Admin" : "Admin";
  const [filter, setFilter] = useState("month");
  const [custom, setCustom] = useState(() => ({ start: dateString(new Date()), end: dateString(new Date()) }));
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportSettings, setReportSettings] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configError, setConfigError] = useState("");
  const [clockDay, setClockDay] = useState(() => dateString(new Date()));
  const range = useMemo(() => getRange(filter, custom, reportSettings), [filter, custom, reportSettings, clockDay]);
  const academicFilter = isAcademic(filter);
  const valid = validDate(range.start) && validDate(range.end) && range.start <= range.end;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadConfig() {
      try {
        const settings = await fetchReportConfig({ signal: controller.signal });
        if (active) { setReportSettings(settings); setConfigError(""); }
      } catch (e) {
        if (active && e.name !== "AbortError") setConfigError(e.message || "Report configuration unavailable.");
      } finally { if (active) setConfigLoaded(true); }
    }
    loadConfig();
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (academicFilter && !configLoaded) { setLoading(true); return; }
    if (!valid) {
      setError(academicFilter ? configError || "Configure valid academic start and end dates in System Settings." : "Select a valid start and end date.");
      setLoading(false); setData(null); return;
    }
    let active = true;
    let busy = false;
    const controller = new AbortController();
    setLoading(true); setData(null); setError("");
    async function load() {
      if (!active || busy || document.hidden) return;
      busy = true;
      try {
        const result = await fetchReports({ start: range.start, end: range.end, signal: controller.signal });
        if (active) { setData(result); setError(""); if (result.settings) setReportSettings(result.settings); }
      } catch (e) {
        if (active && e.name !== "AbortError") setError(e.message || "Reports could not be loaded.");
      } finally { busy = false; if (active) setLoading(false); }
    }
    function onVisible() { if (!document.hidden) { setClockDay(dateString(new Date())); load(); } }
    load();
    const timer = setInterval(() => { setClockDay(dateString(new Date())); load(); }, 20000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [range.start, range.end, valid, academicFilter, configLoaded, configError]);

  const view = useMemo(() => {
    const r = data || {};
    const courses = r.courses || [], students = r.students || [], professors = r.professors || [];
    const modules = r.modules || [], attempts = r.attempts || [], progress = r.progress || [];
    const configuredPassing = r.settings?.passingPercentage ?? reportSettings?.passingPercentage;
    const passing = configuredPassing == null || configuredPassing === "" || !Number.isFinite(Number(configuredPassing)) ? null : Number(configuredPassing);
    const courseMap = new Map(courses.map(c => [String(c.id), c]));
    const professorMap = new Map(professors.map(p => [String(p.id), p.name]));
    const activeScores = attempts.filter(a => a.score != null && a.total != null && Number.isFinite(Number(a.score)) && Number(a.total) > 0);
    const exactPercent = a => Number(a.score) / Number(a.total) * 100;
    const passed = passing == null ? null : activeScores.filter(a => exactPercent(a) >= passing).length;
    const mean = arr => arr.length ? arr.reduce((s, a) => s + exactPercent(a), 0) / arr.length : null;
    const scoreMean = mean(activeScores);
    const progressSet = new Set(progress.filter(p => number(p.progressPercent) >= 100).map(p => `${p.userId}:${p.lessonId}`));
    const studentRows = students.flatMap(s => (s.courseIds || []).map(id => {
      const ownModules = modules.filter(m => String(m.courseId) === String(id));
      const completed = ownModules.filter(m => progressSet.has(`${s.id}:${m.id}`)).length;
      const ownAttempts = activeScores.filter(a => String(a.userId) === String(s.id) && String(a.courseId) === String(id));
      const avg = mean(ownAttempts);
      return { key: `${s.id}:${id}`, name: s.name, course: courseMap.get(String(id))?.title || `Course ${id}`, avg, completed, total: ownModules.length, attempts: ownAttempts.length, intervention: passing != null && avg != null && avg < passing };
    }));
    const courseRows = courses.map(c => ({ key: c.id, name: c.title, professor: professorMap.get(String(c.professorId)) || "Unassigned", students: number(c.students), modules: number(c.modules), attempts: number(c.quizAttempts), average: c.averageScore, completion: c.moduleCompletionRate }));
    const modeRows = (r.quizModes || []).map(m => ({ label: m.name, value: number(m.count) }));
    const daily = new Map();
    for (const a of attempts) { if (!a.createdAt) continue; const day = String(a.createdAt).slice(0, 10); daily.set(day, (daily.get(day) || 0) + 1); }
    return { courses, students, professors, modules, attempts, passing, courseRows, studentRows, modeRows,
      participation: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })),
      totalAttempts: attempts.length, scored: activeScores.length, average: scoreMean,
      passRate: passing != null && activeScores.length ? 100 * passed / activeScores.length : null,
      intervention: studentRows.filter(s => s.intervention),
    };
  }, [data, reportSettings]);
  const matching = view.studentRows.filter(s => `${s.name} ${s.course}`.toLowerCase().includes(search.trim().toLowerCase()));
  const metrics = [
    { label: "Students", value: data?.overview?.totalStudents ?? 0, detail: "Active student accounts", icon: FiUsers },
    { label: "Professors", value: data?.overview?.totalProfessors ?? 0, detail: "Active professor accounts", icon: FiShield },
    { label: "Courses", value: data?.overview?.totalCourses ?? 0, detail: "Current non-archived courses", icon: FiBookOpen },
    { label: "Modules", value: data?.overview?.totalModules ?? 0, detail: "Current learning modules", icon: FiLayers },
    { label: "Quiz Attempts", value: view.totalAttempts, detail: "Selected date range", icon: FiActivity },
    { label: "Average Quiz Score", value: pct(view.average), detail: "Scored attempts in selected period", icon: FiBarChart2 },
  ];
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const exportPDF = async () => {
    if (!data || pdfExporting) return;
    setPdfExporting(true);
    setPdfError("");
    try {
      await downloadReportsPdf({ data, view, metrics, range, studentRows: matching, reportOwner });
    } catch (err) {
      setPdfError(err.message || "Unable to generate the PDF.");
    } finally {
      setPdfExporting(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [`PuffyBrain ${reportOwner} Reports`], ["Period", range.start, range.end], ["Generated", data.generatedAt || ""], [],
      ["Overview", "Value", "Scope"], ...metrics.map(m => [m.label, m.value, m.detail]), [],
      ["Courses", "Professor", "Students", "Modules", "Quiz Attempts", "Average Score", "Module Completion"],
      ...view.courseRows.map(c => [c.name, c.professor, c.students, c.modules, c.attempts, pct(c.average), pct(c.completion)]), [],
      ["Students", "Course", "Scored Attempts", "Average Score", "Modules Completed", "Attention Required"],
      ...matching.map(s => [s.name, s.course, s.attempts, pct(s.avg), `${s.completed}/${s.total}`, s.intervention ? "Yes" : "No"]), [],
      ["Professors", "Courses", "Modules", "Unique Students", "Quiz Attempts"],
      ...view.professors.map(p => [p.name, p.courses, p.modules, p.students, p.quizAttempts]), [],
      ["Quiz Summary", "Value"], ["Attempts", view.totalAttempts], ["Scored Attempts", view.scored],
      ["Average Score", pct(view.average)], ["Pass Threshold", pct(view.passing)], ["Pass Rate", pct(view.passRate)], [],
      ["Quiz Modes", "Attempts"], ...view.modeRows.map(m => [m.label, m.value]),
    ];
    const fileOwner = reportOwner.toLowerCase().replaceAll(" ", "-");
    saveCSV(rows, `puffybrain-${fileOwner}-report-${dateString(new Date())}.csv`);
  };
  return <div className="admin-page reports-page">
    <section className="reports-dashboard-header"><div><span className="reports-kicker"><FiBarChart2 /> {reportOwner} reports</span>
      <h1>Reports Dashboard</h1><p>Academic activity, course participation, and student performance across PuffyBrain.</p></div>
      <div className="report-export-actions">
        <button type="button" onClick={exportPDF} disabled={!data || pdfExporting}><FiDownload /> {pdfExporting ? "Generating PDF..." : "Save as PDF"}</button>
        <button type="button" onClick={exportCSV} disabled={!data}><FiFileText /> Export CSV</button>
        <button type="button" onClick={() => window.print()} disabled={!data}><FiPrinter /> Print Report</button>
      </div></section>
    <section className="report-date-filter"><div className="report-date-filter-heading"><FiCalendar /> Date Filter</div>
      <div className="report-range-filter">{FILTERS.map(([id, label]) => <button key={id} type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div>
      {filter === "custom" && <div className="report-custom-range"><label><span>Start</span><input type="date" value={custom.start} onChange={e => setCustom(v => ({ ...v, start: e.target.value }))} /></label>
        <label><span>End</span><input type="date" value={custom.end} onChange={e => setCustom(v => ({ ...v, end: e.target.value }))} /></label></div>}
      <p style={{ marginTop: 10, fontSize: 13 }}>Quiz activity and scores use the selected dates. Account, course, enrollment, and module totals reflect current records.</p>
    </section>
    {loading && !data && <div className="reports-loading">Loading live reports...</div>}
    {error && <div role="alert" style={{ padding: 14, marginBottom: 16, border: "1px solid #dc7777", borderRadius: 8 }}><FiAlertCircle /> {error}{data ? " Showing the last successful results." : ""}</div>}
    {!data ? (!loading && !error && <p>No report data available.</p>) : <>
      <section className="report-overview">
        {metrics.map(metric => <AdminStatCard key={metric.label} {...metric} />)}
      </section>
      <Section icon={FiBookOpen} title="Course Reports" subtitle="Current courses, approved enrollment, module completion, and quiz participation.">
        <Table columns={["Course", "Professor", "Students", "Modules", "Quiz Attempts", "Average Score", "Module Completion"]}
          rows={view.courseRows.map(c => ({ key: c.key, cells: [<strong className="table-strong">{c.name}</strong>, c.professor, c.students, c.modules, c.attempts, pct(c.average), pct(c.completion)] }))} empty="No active courses found." />
      </Section>
      <Section icon={FiUserCheck} title="Student Performance" subtitle="Students enrolled in current courses, with recorded quiz and module progress."
        action={<label className="report-search"><FiSearch /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students or courses..." /></label>}>
        <Table columns={["Student", "Course", "Scored Attempts", "Average Score", "Modules Completed", "Assessment Status"]}
          rows={matching.map(s => ({ key: s.key, cells: [<strong className="table-strong">{s.name}</strong>, s.course, s.attempts, pct(s.avg), `${s.completed}/${s.total}`, s.avg == null ? "Not assessed" : view.passing == null ? "Threshold not configured" : s.intervention ? "Needs attention" : "Assessed"] }))} empty="No matching enrolled students found." />
      </Section>
      <Section icon={FiShield} title="Professor Activity" subtitle="Course ownership and academic activity from current records.">
        <Table columns={["Professor", "Courses Handled", "Modules", "Unique Students", "Quiz Attempts"]}
          rows={view.professors.map(p => ({ key: p.id, cells: [<strong className="table-strong">{p.name}</strong>, p.courses, p.modules, p.students, p.quizAttempts] }))} empty="No active professors found." />
      </Section>
      <Section icon={FiActivity} title="Quiz Participation" subtitle="Real quiz attempts and assessment activity within the selected date range.">
        <div className="report-quiz-summary">
          {[["Attempts", view.totalAttempts], ["Scored Attempts", view.scored], ["Average Score", pct(view.average)], ["Passing Threshold", pct(view.passing)], ["Pass Rate", pct(view.passRate)]].map(([label, value]) =>
            <div className="report-small-metric tone-blue" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="report-analytics-grid two-column"><div className="report-chart-block"><h3>Quiz Mode Activity</h3><Bars items={view.modeRows} /></div>
          <div className="report-chart-block"><h3>Attempts by Date</h3><Bars items={view.participation} /></div></div>
      </Section>
      <Section icon={FiAlertCircle} title="Students Needing Attention" subtitle={view.passing == null ? "Configure the university reporting threshold in System Settings to enable attention flags." : `Students with a recorded course quiz average below the configured ${pct(view.passing)} reporting threshold. This is an advisory flag, not a final grade.`}>
        <Table columns={["Student", "Course", "Average Score", "Quiz Attempts"]}
          rows={view.intervention.map(s => ({ key: s.key, cells: [s.name, s.course, pct(s.avg), s.attempts] }))} empty={view.passing == null ? "Reporting threshold is not configured." : "No enrolled students currently meet the attention criteria."} />
      </Section>
    </>}
  </div>;
}
