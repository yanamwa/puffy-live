import { findCatalogCodeMatches } from "../../../services/catalogDuplicates.js";
import { readCoverage } from "../../../components/catalog/CoverageModules.jsx";
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getUserRole } from "../../../utils/roles.js";
import {
  catalogRequest,
  notifyCatalogChanged,
} from "../../../services/catalogApi.js";
import {
  CatalogModal,
  PdfPreview,
} from "../../../components/catalog/CatalogModal.jsx";
import SyllabusWizard, {
  CatalogFields,
} from "../../../components/catalog/SyllabusWizard.jsx";
import { ProfessorClassDetails } from "./ModuleManagementPage.jsx";
import { archiveCourseById } from "../../../services/courseApi.js";
import "./Modules.css";
import "../../superadmin/SuperAdminDashboard.css";
import "../../../components/catalog/catalog.css";

const date = (value) => (value ? new Date(value).toLocaleString() : "—");
const period = (row) =>
  [row.academic_year, row.semester].filter(Boolean).join(" / ") || "Not set";
const classStatus = (row) =>
  row.archived
    ? "Archived"
    : row.status === "published"
      ? "Published"
      : "Draft";
function Pagination({ page, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  if (pages <= 1) return null;
  return (
    <div className="catalog-pagination">
      <span>
        {total} records · Page {page} of {pages}
      </span>
      <button
        className="catalog-button catalog-page-previous"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <button
        className="catalog-button catalog-page-next"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
function ClassesTable({ records, onView, onArchive, busy }) {
  return (
    <div className="admin-modules-table-wrap">
      <table className="admin-modules-table">
        <thead>
          <tr>
            <th>Course code and title</th>
            <th>Professor</th>
            <th>Class / section</th>
            <th>Class period</th>
            <th>Students</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.course_id}>
              <td>
                {row.catalog_code || row.code} — {row.title}
                {!row.catalog_id && <div>Not linked to catalog</div>}
              </td>
              <td>{row.professor || "Unavailable"}</td>
              <td>
                {row.class_name ||
                  [row.program, row.year_level, row.section_name]
                    .filter(Boolean)
                    .join(" / ") ||
                  "Section not specified"}
              </td>
              <td>{period(row)}</td>
              <td>{row.student_count}</td>
              <td>
                <span
                  className={`catalog-class-status ${classStatus(row).toLowerCase()}`}
                >
                  {classStatus(row)}
                </span>
              </td>
              <td>
                <div className="catalog-class-actions">
                  <button
                    className="catalog-button catalog-class-view"
                    disabled={busy}
                    onClick={() => onView(row.course_id)}
                  >
                    View
                  </button>
                  {onArchive && (
                    <button
                      className={
                        "catalog-button catalog-class-state " +
                        (row.archived
                          ? "catalog-class-restore"
                          : "catalog-class-archive")
                      }
                      disabled={busy}
                      onClick={() => onArchive(row)}
                    >
                      {row.archived ? "Restore Class" : "Archive Class"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!records.length && (
            <tr>
              <td colSpan={7} className="admin-modules-empty">
                No professor classes found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function CatalogDetails({ id, onClose, onClass, onPdf }) {
  const [tab, setTab] = useState("classes");
  const [previewId, setPreviewId] = useState(null);
  const [data, setData] = useState(null),
    [classes, setClasses] = useState({ records: [], total: 0 }),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([
      catalogRequest("/" + id),
      catalogRequest(
        "/classes?" + new URLSearchParams({ catalogId: id, page }),
      ),
    ])
      .then(([detail, linked]) => {
        if (active) {
          setData(detail);
          setClasses(linked);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, page]);
  useEffect(() => {
    if (
      !data?.versions?.some((v) =>
        ["queued", "running"].includes(v.generation_status),
      )
    )
      return;
    let active = true;
    const timer = setInterval(
      () =>
        catalogRequest("/" + id)
          .then((result) => {
            if (active) setData(result);
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      5000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, data]);
  const retryLessons = async (versionId) => {
    try {
      await catalogRequest(`/versions/${versionId}/retry-lessons`, {
        method: "POST",
      });
      setData(await catalogRequest("/" + id));
    } catch (e) {
      setError(e.message);
    }
  };

  const preview = data?.versions.find((v) => v.version_id === previewId);
  if (preview)
    return (
      <CatalogModal
        title={`Syllabus #${preview.version_id} - Coverage & Lessons`}
        wide
        variant="details"
        onClose={() => setPreviewId(null)}
      >
        <button className="catalog-button" onClick={() => setPreviewId(null)}>
          Back to Syllabi
        </button>
        <p>
          {period(preview)} · {preview.filename}
        </p>
        <div className="catalog-coverage-preview">
          {readCoverage(preview.coverage_modules).map((module, index) => (
            <section key={index}>
              <h3>
                {index + 1}. {module.title}
              </h3>
              {module.source_page && <p>Source page {module.source_page}</p>}
              {module.lesson_pages?.length ? (
                module.lesson_pages.map((lesson, i) => (
                  <details key={i}>
                    <summary>{lesson.title || `Lesson ${i + 1}`}</summary>
                    <div className="catalog-lesson-preview">
                      {lesson.content}
                    </div>
                  </details>
                ))
              ) : (
                <p>No draft lessons available.</p>
              )}
            </section>
          ))}
        </div>
      </CatalogModal>
    );
  return (
    <CatalogModal
      title="Course Details"
      wide
      variant="details"
      onClose={onClose}
    >
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Loading course…</p>
      ) : (
        <>
          <section
            className="catalog-course-summary"
            aria-label="Course information"
          >
            <div className="catalog-course-heading">
              <div>
                <span className="catalog-course-code">{data.course.code}</span>
                <h3>{data.course.title}</h3>
              </div>
              <span className="catalog-course-badge">
                {data.course.archived_at ? "Archived" : data.course.status}
              </span>
            </div>
            <p>{data.course.description || "No description provided."}</p>
            <dl className="catalog-course-meta">
              <div>
                <dt>Units</dt>
                <dd>{data.course.units ?? "Not specified"}</dd>
              </div>
              <div>
                <dt>Applicable programs</dt>
                <dd>{data.course.programs.join(", ") || "Not specified"}</dd>
              </div>
            </dl>
          </section>
          <div
            className="catalog-detail-tabs"
            role="tablist"
            aria-label="Course details"
          >
            {[
              ["classes", "Linked Classes"],
              ["history", "Professor History"],
              ["syllabi", "Syllabi"],
            ].map(([key, label]) => (
              <button
                key={key}
                id={`course-tab-${key}`}
                className="catalog-button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`course-panel-${key}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <section
            role="tabpanel"
            id={`course-panel-${tab}`}
            aria-labelledby={`course-tab-${tab}`}
          >
            {tab === "classes" && (
              <>
                <h3>Linked Classes</h3>
                <ClassesTable records={classes.records} onView={onClass} />
                <Pagination
                  page={page}
                  total={classes.total}
                  onChange={setPage}
                />
              </>
            )}
            {tab === "history" && (
              <>
                <h3>Professor Assignment History</h3>
                <p>
                  Professors assigned to {data.course.code}, including archived
                  classes. Dates show when each linked class was created, newest
                  first.
                </p>
                <div className="admin-modules-table-wrap">
                  <table className="admin-modules-table">
                    <thead>
                      <tr>
                        <th>Professor</th>
                        <th>Class created</th>
                        <th>Class / section</th>
                        <th>Class status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.records.map((row) => (
                        <tr key={row.course_id}>
                          <td>{row.professor || "Unavailable"}</td>
                          <td>
                            {row.created_at
                              ? date(row.created_at)
                              : "Date unavailable"}
                          </td>
                          <td>
                            {row.class_name ||
                              [row.program, row.year_level, row.section_name]
                                .filter(Boolean)
                                .join(" / ") ||
                              "Section not specified"}
                          </td>
                          <td>
                            <span
                              className={`catalog-class-status ${classStatus(row).toLowerCase()}`}
                            >
                              {classStatus(row)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!classes.records.length && (
                        <tr>
                          <td colSpan={4}>
                            No professor assignments recorded for this course.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  total={classes.total}
                  onChange={setPage}
                />
              </>
            )}
            {tab === "syllabi" && (
              <>
                <h3>Syllabus Versions</h3>
                <p>
                  View uploaded syllabi, course coverage, and draft lessons.
                </p>
                <div className="admin-modules-table-wrap">
                  <table className="admin-modules-table">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Academic period</th>
                        <th>Filename</th>
                        <th>Uploaded</th>
                        <th>Uploader</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.versions.map((v) => (
                        <tr key={v.version_id}>
                          <td>#{v.version_id}</td>
                          <td>{period(v)}</td>
                          <td>
                            {v.filename}
                            {v.generation_status && (
                              <p role="status">
                                Draft lessons:{" "}
                                {v.generation_status === "completed"
                                  ? "Ready for professor review"
                                  : v.generation_status}
                              </p>
                            )}
                            {v.generation_status === "failed" && (
                              <>
                                <p role="alert">{v.generation_error}</p>
                                <button
                                  className="catalog-button"
                                  onClick={() => retryLessons(v.version_id)}
                                >
                                  Retry lesson generation
                                </button>
                              </>
                            )}
                          </td>
                          <td>
                            {v.uploaded_at
                              ? date(v.uploaded_at)
                              : "Date unavailable"}
                          </td>
                          <td>{v.uploader || "Unavailable"}</td>
                          <td>
                            <div className="catalog-syllabus-actions">
                              <button
                                className="catalog-button catalog-view-pdf"
                                onClick={() =>
                                  onPdf(`/versions/${v.version_id}/pdf`)
                                }
                              >
                                View PDF
                              </button>
                              {readCoverage(v.coverage_modules).length > 0 && (
                                <button
                                  className="catalog-button"
                                  onClick={() => setPreviewId(v.version_id)}
                                >
                                  View Coverage
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!data.versions.length && (
                        <tr>
                          <td colSpan={6}>No syllabus versions uploaded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </CatalogModal>
  );
}
function EditDetails({ course, onClose, onSaved }) {
  const [value, setValue] = useState(course),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const matches = await findCatalogCodeMatches(
        value.code,
        catalogRequest,
        course.catalog_id,
      );
      if (matches.length)
        throw new Error(
          `Course code ${value.code.trim()} already exists. Choose a different code.`,
        );
      if (course.status === "active" && !reviewed)
        throw new Error(
          "Tick the review confirmation before saving changes to an active course.",
        );
      await catalogRequest("/" + course.catalog_id, {
        method: "PATCH",
        body: JSON.stringify({ ...value, action: "edit", reviewed }),
      });
      notifyCatalogChanged();
      onSaved("Course details updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <CatalogModal
      title="Edit Course Details"
      variant="details"
      busy={busy}
      onClose={onClose}
    >
      <form className="catalog-edit-form" onSubmit={save}>
        {error && (
          <p className="catalog-error" role="alert">
            {error}
          </p>
        )}
        <CatalogFields
          value={value}
          onChange={(v) => {
            setValue(v);
            setReviewed(false);
          }}
        />
        <p className="catalog-note">
          Existing professor classes keep their saved official details and
          syllabus version.
        </p>
        <label className="catalog-check">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />{" "}
          I have reviewed these details.
        </label>
        <div className="catalog-actions">
          <button
            className="catalog-button catalog-cancel"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="catalog-button catalog-save-details"
            type="submit"
            disabled={busy}
          >
            Save Details
          </button>
        </div>
      </form>
    </CatalogModal>
  );
}

export default function CourseManagementPage() {
  const { user } = useAuth(),
    superAdmin = getUserRole(user) === "super_admin";
  const [tab, setTab] = useState("catalog"),
    [q, setQ] = useState(""),
    [program, setProgram] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null),
    [data, setData] = useState({ tab: "catalog", records: [], total: 0 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [selectedClass, setSelectedClass] = useState(null);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    window.addEventListener("puffy-catalog-updated", refresh);
    return () => window.removeEventListener("puffy-catalog-updated", refresh);
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        page,
        q,
        program,
        status,
        ...(tab === "archived" ? { archived: "1" } : {}),
      });
      const path = tab === "classes" ? "/classes" : "";
      Promise.all([
        catalogRequest("/summary"),
        catalogRequest(path + "?" + query),
      ])
        .then(([counts, result]) => {
          if (active) {
            if (!Array.isArray(result.records)) {
              throw new Error(
                "The server returned an invalid course list. Please retry.",
              );
            }
            setSummary(counts.summary);
            setData({ ...result, tab });
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab, q, program, status, page, revision]);
  const close = useCallback(() => setDialog(null), []);
  const saved = (message) => {
    setDialog(null);
    refresh();
    Swal.fire({
      confirmButtonColor: "#7fa8d6",
      cancelButtonColor: "#7d8798",
      icon: "success",
      title: message,
      timer: 1600,
      showConfirmButton: false,
    });
  };
  const viewClass = async (id) => {
    setBusy(true);
    try {
      const data = await catalogRequest("/classes/" + id);
      setSelectedClass(data.course);
    } catch (e) {
      Swal.fire({
        confirmButtonColor: "#7fa8d6",
        cancelButtonColor: "#7d8798",
        icon: "error",
        title: "Could not load class",
        text: e.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const archiveClass = async (course) => {
    const answer = await Swal.fire({
      confirmButtonColor: "#7fa8d6",
      cancelButtonColor: "#7d8798",
      title: course.archived
        ? "Restore professor class?"
        : "Archive professor class?",
      text: course.archived
        ? "Restore this class to active classes?"
        : "This archives the professor class for students. Its catalog entry is managed separately.",
      showCancelButton: true,
      confirmButtonText: course.archived ? "Restore Class" : "Archive Class",
    });
    if (!answer.isConfirmed) return;
    setBusy(true);
    try {
      await archiveCourseById(course.course_id, !course.archived, {
        fallback: false,
      });
      refresh();
    } catch (e) {
      Swal.fire({
        confirmButtonColor: "#7fa8d6",
        cancelButtonColor: "#7d8798",
        icon: "error",
        title: "Could not update class",
        text: e.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const action = async (course, action) => {
    const activation = action === "activate";
    const answer = await Swal.fire({
      confirmButtonColor: "#7fa8d6",
      cancelButtonColor: "#7d8798",
      title: activation
        ? "Activate reviewed course?"
        : action === "archive"
          ? "Archive catalog course?"
          : "Restore catalog course?",
      text: activation
        ? "Review the course details and syllabus before confirming activation."
        : action === "archive"
          ? "This archives the catalog course and its active professor classes. Professors will be notified, and class records will remain available under Archived."
          : "The course will retain its previous draft or active status.",
      showCancelButton: true,
      confirmButtonText: activation
        ? "I reviewed it — Activate"
        : action === "archive"
          ? "Archive"
          : "Restore",
      ...(activation
        ? {
            input: "checkbox",
            inputPlaceholder:
              "I have reviewed the course information and syllabus.",
            inputValidator: (value) =>
              !value ? "Review confirmation is required." : undefined,
          }
        : {}),
    });
    if (!answer.isConfirmed) return;
    setBusy(true);
    try {
      await catalogRequest("/" + course.catalog_id, {
        method: "PATCH",
        body: JSON.stringify({ action, reviewed: activation }),
      });
      notifyCatalogChanged();
      refresh();
      Swal.fire({
        confirmButtonColor: "#7fa8d6",
        cancelButtonColor: "#7d8798",
        icon: "success",
        title: "Course updated",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire({
        confirmButtonColor: "#7fa8d6",
        cancelButtonColor: "#7d8798",
        icon: "error",
        title: "Could not update course",
        text: e.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const changeTab = (value) => {
    if (value === tab) return;
    // Effects run after render: clear the old table before changing its schema.
    setLoading(true);
    setError("");
    setData({ tab: value, records: [], total: 0 });
    setTab(value);
    setQ("");
    setProgram("");
    setStatus("");
    setPage(1);
  };
  return (
    <div className="admin-page admin-modules-page catalog-page">
      <div className="super-dashboard-welcome catalog-heading super-page-heading">
        <div>
          <h1>Course Management</h1>
          <p>Manage course information, syllabi, and professor classes.</p>
        </div>
        <button
          className="catalog-button catalog-upload-syllabus"
          type="button"
          onClick={() => setDialog({ type: "upload" })}
        >
          Upload Syllabus
        </button>
      </div>
      <div className="catalog-summary">
        {[
          ["Total Catalog Courses", "total"],
          ["Active Catalog Courses", "active"],
          ["Draft Catalog Courses", "draft"],
          ["Professor Classes", "classes"],
        ].map(([label, key]) => (
          <article className="dashboard-summary-card" key={key}>
            <span>{label}</span>
            <strong>{summary ? summary[key] : "—"}</strong>
          </article>
        ))}
      </div>
      <div
        className="catalog-tabs"
        role="tablist"
        aria-label="Course Management"
      >
        {[
          ["catalog", "Course Catalog"],
          ["classes", "Professor Classes"],
          ["archived", "Archived Courses"],
        ].map(([key, label]) => (
          <button
            className={`catalog-button catalog-tab catalog-tab-${key}`}
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => changeTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="catalog-toolbar">
        <input
          aria-label="Search courses"
          placeholder={
            tab === "classes"
              ? "Search course, professor or class…"
              : "Search course code or title…"
          }
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        {tab !== "classes" && (
          <select
            aria-label="Program filter"
            value={program}
            onChange={(e) => {
              setProgram(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All programs</option>
            <option>BSIT</option>
            <option>BSCS</option>
          </select>
        )}
        {tab !== "archived" && (
          <select
            aria-label="Status filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {(tab === "classes"
              ? [
                  ["published", "Published"],
                  ["draft", "Draft"],
                  ["archived", "Archived"],
                ]
              : [
                  ["active", "Active"],
                  ["draft", "Draft"],
                ]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      {error ? (
        <div className="catalog-error" role="alert">
          {error}{" "}
          <button className="catalog-button catalog-retry" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : loading || data.tab !== tab ? (
        <p role="status">
          Loading {tab === "classes" ? "professor classes" : "course records"}…
        </p>
      ) : (
        <>
          {tab === "classes" ? (
            <ClassesTable
              records={data.records}
              onView={viewClass}
              onArchive={archiveClass}
              busy={busy}
            />
          ) : (
            <div className="admin-modules-table-wrap">
              <table className="admin-modules-table">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Applicable Programs</th>
                    <th>{tab === "archived" ? "Archived Date" : "Status"}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((course) => (
                    <tr key={course.catalog_id}>
                      <td>{course.code}</td>
                      <td>{course.title}</td>
                      <td>
                        {(Array.isArray(course.programs)
                          ? course.programs
                          : []
                        ).join(", ") || "Not set"}
                      </td>
                      <td>
                        {tab === "archived" ? (
                          date(course.archived_at)
                        ) : (
                          <span
                            className={`admin-module-status ${course.status === "active" ? "publish" : "draft"}`}
                          >
                            {course.status === "active" ? "Active" : "Draft"}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="catalog-row-actions">
                          <button
                            className="catalog-button catalog-action-view"
                            disabled={busy}
                            onClick={() =>
                              setDialog({ type: "view", id: course.catalog_id })
                            }
                          >
                            View
                          </button>
                          {tab === "archived" ? (
                            <button
                              disabled={busy}
                              className="catalog-button catalog-action-restore"
                              onClick={() => action(course, "restore")}
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                className="catalog-button catalog-action-edit"
                                disabled={busy}
                                onClick={() =>
                                  setDialog({ type: "edit", course })
                                }
                              >
                                Edit Details
                              </button>
                              {course.status === "draft" && (
                                <button
                                  disabled={busy}
                                  className="catalog-button catalog-action-activate"
                                  onClick={() => action(course, "activate")}
                                >
                                  Activate
                                </button>
                              )}
                              <button
                                disabled={busy}
                                className="catalog-button catalog-action-archive"
                                onClick={() => action(course, "archive")}
                              >
                                Archive
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.records.length && (
                    <tr>
                      <td colSpan={5} className="admin-modules-empty">
                        {tab === "archived"
                          ? "No archived catalog courses found."
                          : "No catalog courses found. Upload a syllabus to get started."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={data.total} onChange={setPage} />
        </>
      )}
      {dialog?.type === "upload" && (
        <SyllabusWizard
          course={dialog.course}
          onClose={close}
          onSaved={saved}
        />
      )}
      {dialog?.type === "edit" && (
        <EditDetails course={dialog.course} onClose={close} onSaved={saved} />
      )}
      {dialog?.type === "view" && (
        <CatalogDetails
          id={dialog.id}
          onClose={close}
          onClass={viewClass}
          onPdf={(path) => setDialog({ ...dialog, pdf: path })}
        />
      )}
      {dialog?.pdf && (
        <CatalogModal
          title="Syllabus PDF"
          variant="details"
          wide
          onClose={() => setDialog({ ...dialog, pdf: null })}
        >
          <PdfPreview path={dialog.pdf} />
        </CatalogModal>
      )}
      {selectedClass && (
        <ProfessorClassDetails
          course={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}
