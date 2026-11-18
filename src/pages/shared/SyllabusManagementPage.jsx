import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { FiUpload } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import { getUserRole } from "../../utils/roles.js";
import {
  catalogRequest,
  notifyCatalogChanged,
} from "../../services/catalogApi.js";
import {
  CatalogModal,
  PdfPreview,
} from "../../components/catalog/CatalogModal.jsx";
import { readCoverage } from "../../components/catalog/CoverageModules.jsx";
import SyllabusWizard from "../../components/catalog/SyllabusWizard.jsx";
import "../admin/modules/Modules.css";
import "../superadmin/SuperAdminDashboard.css";
import "../../components/catalog/catalog.css";
import "./SyllabusManagementPage.css";

const tabs = [
  ["syllabi", "Syllabi"],
  ["approval", "Syllabus Approval"],
  ["history", "Syllabus History"],
];
const formatDate = (value) => (value ? new Date(value).toLocaleString() : "—");
const period = (record) =>
  [record.academic_year, record.semester].filter(Boolean).join(" / ") ||
  "Not specified";
const statusLabel = (record) =>
  record.archived_at
    ? "Archived"
    : record.status === "draft"
      ? "Pending Approval"
      : record.status === "active"
        ? "Active"
        : record.status === "rejected"
          ? "Rejected"
          : "Inactive";

const statusActions = {
  draft: [
    ["approve", "Approve"],
    ["reject", "Reject"],
  ],
  active: [["deactivate", "Deactivate"]],
  inactive: [["activate", "Activate"]],
};
const actionsFor = (record) =>
  record.archived_at ? [] : statusActions[record.status] || [];

function StatusBadge({ record }) {
  return (
    <span
      className={`syllabus-status syllabus-status-${record.archived_at ? "archived" : record.status}`}
    >
      {statusLabel(record)}
    </span>
  );
}

function SyllabusDetails({ id, onClose, canManage, onStatus, busy }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    catalogRequest(`/syllabi/${id}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setRecord(data.syllabus);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [id]);
  return (
    <CatalogModal
      title="Syllabus Details"
      wide
      variant="details catalog-course-record"
      busy={busy}
      onClose={onClose}
    >
      {error ? (
        <p role="alert" className="catalog-error">
          {error}
        </p>
      ) : !record ? (
        <p role="status">Loading syllabus.</p>
      ) : (
        <>
          <dl className="catalog-info">
            {[
              ["Course", `${record.code} — ${record.title}`],
              ["Course status", statusLabel(record)],
              ["Syllabus period", period(record)],
              ["Filename", record.filename],
              ["Version", `#${record.version_id}`],
              ["Uploaded by", record.uploader],
              ["Submitted", formatDate(record.uploaded_at)],
              ["Course reviewed by", record.reviewer || "Awaiting review"],
              ["Course reviewed", formatDate(record.reviewed_at)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {readCoverage(record.coverage_modules).length > 0 && (
            <details className="syllabus-coverage">
              <summary>
                Module outline ({readCoverage(record.coverage_modules).length})
              </summary>
              <ol>
                {readCoverage(record.coverage_modules).map((module, index) => (
                  <li key={index}>{module.title}</li>
                ))}
              </ol>
            </details>
          )}
          <PdfPreview path={`/versions/${record.version_id}/pdf`} />
          {canManage && actionsFor(record).length > 0 && (
            <div className="catalog-actions">
              {actionsFor(record).map(([action, label]) => (
                <button
                  key={action}
                  className={`catalog-button catalog-action-${action}`}
                  disabled={busy}
                  onClick={() => onStatus(record, action)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </CatalogModal>
  );
}

export default function SyllabusManagementPage() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const superAdmin = role === "super_admin";
  const canUpload = ["admin", "professor"].includes(role);
  const [view, setView] = useState("syllabi");
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const closeUpload = useCallback(() => setUploadOpen(false), []);

  useEffect(() => {
    window.addEventListener("puffy-catalog-updated", refresh);
    return () => window.removeEventListener("puffy-catalog-updated", refresh);
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        view,
        q: query,
        program,
        status,
        page,
      });
      catalogRequest("/syllabi?" + params, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!Array.isArray(result.records))
            throw new Error("Could not read the syllabus list.");
          setData({ ...result, view });
          const lastPage = Math.max(1, Math.ceil(result.total / 10));
          if (page > lastPage) setPage(lastPage);
        })
        .catch((failure) => {
          if (!controller.signal.aborted) setError(failure.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [view, query, program, status, page, revision]);

  const changeTab = (next) => {
    setView(next);
    setQuery("");
    setProgram("");
    setStatus("");
    setPage(1);
    setSelectedId(null);
  };
  const updateStatus = async (record, action) => {
    const approving = action === "approve";
    const prompts = {
      approve: {
        title: "Approve this syllabus?",
        text: `${record.code} - ${record.title} will be approved and made active for new classes.`,
        confirm: "Approve",
        success: "Syllabus approved and course active",
      },
      reject: {
        title: "Reject this syllabus?",
        text: `${record.code} will stay unavailable for new classes. The uploader can revise and submit a new syllabus.`,
        confirm: "Reject",
        success: "Syllabus rejected",
      },
      activate: {
        title: "Activate this course?",
        text: `${record.code} will become available for new classes using its approved syllabus.`,
        confirm: "Activate",
        success: "Course is active",
      },
      deactivate: {
        title: "Make this course inactive?",
        text: `${record.code} will become unavailable for new classes. Its syllabus approval will be retained.`,
        confirm: "Deactivate",
        success: "Course is inactive",
      },
    };
    const prompt = prompts[action];
    if (!prompt || busy) return;
    const result = await Swal.fire({
      title: prompt.title,
      text: prompt.text,
      input: approving ? "checkbox" : undefined,
      inputPlaceholder: approving
        ? "I have reviewed the syllabus and module outline."
        : undefined,
      inputValidator: approving
        ? (value) =>
            value ? undefined : "Confirm your review before approving."
        : undefined,
      showCancelButton: true,
      confirmButtonText: prompt.confirm,
      confirmButtonColor: "#7fa8d6",
      customClass: {
        popup: "catalog-confirm-popup",
        container: "catalog-confirm-overlay",
      },
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      const updated = await catalogRequest("/" + record.catalog_id, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          reviewed: approving,
          versionId: record.version_id,
        }),
      });
      setSelectedId(null);
      notifyCatalogChanged();
      const messages = {
        sent: "The syllabus uploader was notified by email.",
        failed:
          "The status changed, but the notification email could not be sent.",
        unavailable:
          "The status changed, but the uploader's email was unavailable.",
        not_needed: "This syllabus already has the selected status.",
      };
      const needsAttention = ["failed", "unavailable"].includes(
        updated.notification,
      );
      Swal.fire({
        icon: needsAttention ? "warning" : "success",
        title: prompt.success,
        text: messages[updated.notification],
        confirmButtonColor: "#7fa8d6",
      });
    } catch (failure) {
      refresh();
      Swal.fire({
        icon: "error",
        title: "Could not update course",
        text: failure.message,
        confirmButtonColor: "#7fa8d6",
      });
    } finally {
      setBusy(false);
    }
  };
  const submitted = (message) => {
    closeUpload();
    refresh();
    Swal.fire({
      icon: "success",
      title: message,
      confirmButtonColor: "#7fa8d6",
    });
  };
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / 10));

  return (
    <div className="admin-page admin-modules-page catalog-page syllabus-management-page">
      <header className="super-dashboard-welcome catalog-heading super-page-heading">
        <div>
          <h1>Syllabus Management</h1>
          <p>
            {superAdmin
              ? "Approve or reject syllabus submissions, manage course availability, and view syllabus history."
              : "Upload syllabi and track their approval status."}
          </p>
        </div>
        {canUpload && (
          <button
            className="catalog-button catalog-upload-syllabus"
            onClick={() => setUploadOpen(true)}
            disabled={busy}
          >
            <FiUpload aria-hidden="true" /> Upload Syllabus
          </button>
        )}
      </header>
      <div className="catalog-summary">
        {[
          ["Current Submissions", "total"],
          ["Active Courses", "active"],
          ["Pending Approval", "pending"],
          ["Inactive Courses", "inactive"],
        ].map(([label, key]) => (
          <article className="dashboard-summary-card" key={key}>
            <span>{label}</span>
            <strong>{data?.summary?.[key] ?? "—"}</strong>
          </article>
        ))}
      </div>
      <nav
        className="catalog-tabs"
        role="tablist"
        aria-label="Syllabus Management"
      >
        {tabs.map(([key, label]) => (
          <button
            type="button"
            className="catalog-button catalog-tab"
            role="tab"
            id={`syllabus-tab-${key}`}
            aria-controls="syllabus-records"
            aria-selected={view === key}
            key={key}
            disabled={busy}
            onClick={() => changeTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section
        id="syllabus-records"
        className="catalog-workspace-panel"
        role="tabpanel"
        aria-labelledby={`syllabus-tab-${view}`}
      >
        <div className="catalog-toolbar">
          <input
            type="search"
            placeholder="Search course, syllabus or uploader..."
            aria-label="Search syllabi"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Program filter"
            value={program}
            onChange={(event) => {
              setProgram(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All programs</option>
            <option>BSIT</option>
            <option>BSCS</option>
          </select>
          {view !== "approval" && (
            <select
              aria-label="Course status filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending Approval</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="rejected">Rejected</option>
              {view === "history" && <option value="archived">Archived</option>}
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
        ) : loading || data?.view !== view ? (
          <p role="status">Loading syllabi.</p>
        ) : (
          <>
            <div className="admin-modules-table-wrap">
              <table className="admin-modules-table">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Syllabus</th>
                    <th>Uploaded By</th>
                    <th>Course Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((record) => (
                    <tr key={record.version_id}>
                      <td>{record.code}</td>
                      <td>
                        {record.title}
                        <small className="syllabus-row-note">
                          {record.programs.join(", ") ||
                            "Programs not specified"}
                        </small>
                      </td>
                      <td className="syllabus-file-cell">
                        {record.filename}
                        <small className="syllabus-row-note">
                          {period(record)}
                        </small>
                        <small className="syllabus-row-note">
                          Version #{record.version_id} ·{" "}
                          {formatDate(record.uploaded_at)}
                        </small>
                      </td>
                      <td>{record.uploader}</td>
                      <td>
                        <StatusBadge record={record} />
                      </td>
                      <td>
                        <div className="catalog-row-actions">
                          <button
                            className="catalog-button catalog-action-view"
                            disabled={busy}
                            onClick={() => setSelectedId(record.version_id)}
                          >
                            {superAdmin && view === "approval"
                              ? "Review"
                              : "View"}
                          </button>
                          {superAdmin &&
                            view !== "history" &&
                            !record.archived_at &&
                            actionsFor(record).map(([action, label]) => (
                              <button
                                key={action}
                                className={`catalog-button catalog-action-${action}`}
                                disabled={busy}
                                onClick={() => updateStatus(record, action)}
                              >
                                {label}
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.records.length && (
                    <tr>
                      <td colSpan={6} className="admin-modules-empty">
                        {view === "approval"
                          ? "No syllabi are awaiting approval."
                          : view === "history"
                            ? "No syllabus uploads found."
                            : "No syllabi found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="catalog-pagination">
              <span>
                {data.total} records · Page {page} of {totalPages}
              </span>
              <button
                className="catalog-button catalog-page-previous"
                disabled={page <= 1 || busy}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                className="catalog-button catalog-page-next"
                disabled={page >= totalPages || busy}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
      {uploadOpen && (
        <SyllabusWizard onClose={closeUpload} onSaved={submitted} />
      )}
      {selectedId != null && (
        <SyllabusDetails
          key={selectedId}
          id={selectedId}
          onClose={() => setSelectedId(null)}
          canManage={superAdmin && view !== "history"}
          busy={busy}
          onStatus={updateStatus}
        />
      )}
    </div>
  );
}
