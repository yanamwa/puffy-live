import Swal from "sweetalert2";
import { findArchivedCatalogCodeMatches, findCatalogCodeMatches, normalizeCatalogCode } from "../../services/catalogDuplicates.js";
import CoverageModules from "./CoverageModules.jsx";
import { useEffect, useRef, useState } from "react";
import {
  catalogRequest,
  notifyCatalogChanged,
} from "../../services/catalogApi.js";
import { CatalogModal, PdfPreview } from "./CatalogModal.jsx";

export function CatalogFields({
  value,
  onChange,
  readOnly = false,
  invalid = false,
}) {
  const field = (key, label, type = "text", required = false) => (
    <label key={key}>
      {label}
      {required ? " *" : ""}
      {key === "description" ? (
        <textarea
          value={value[key] || ""}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          readOnly={readOnly}
          maxLength={15000}
        />
      ) : (
        <input
          type={type}
          value={value[key] ?? ""}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          readOnly={readOnly}
          required={required}
          aria-invalid={invalid && required && !String(value[key] || "").trim()}
          maxLength={key === "code" ? 50 : 255}
          min={type === "number" ? 0 : undefined}
          max={type === "number" ? 99 : undefined}
          step={type === "number" ? "0.5" : undefined}
        />
      )}
    </label>
  );
  return (
    <div className="catalog-fields">
      {field("code", "Course code", "text", true)}
      {field("title", "Course title", "text", true)}
      {field("description", "Course description")}
      {field("units", "Credit units", "number")}
      <fieldset>
        <legend>Applicable programs</legend>
        {["BSIT", "BSCS"].map((program) => (
          <label className="catalog-check" key={program}>
            <input
              type="checkbox"
              disabled={readOnly}
              checked={(value.programs || []).includes(program)}
              onChange={(e) =>
                onChange({
                  ...value,
                  programs: e.target.checked
                    ? [...(value.programs || []), program]
                    : (value.programs || []).filter((p) => p !== program),
                })
              }
            />
            {program}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
export default function SyllabusWizard({ course, onClose, onSaved }) {
  const [upload, setUpload] = useState(null),
    [details, setDetails] = useState({ programs: [] }),
    [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false),
    [matches, setMatches] = useState([]),
    [attach, setAttach] = useState(course || null),
    [invalid, setInvalid] = useState(false);
  const pending = useRef(null);
  const setError = (message) => {
    if (!message) return;
    void Swal.fire({
      icon: "warning",
      title: "Please check before continuing",
      text: message,
      confirmButtonText: "OK",
      confirmButtonColor: "#80a9d3",
      allowOutsideClick: false,
      didOpen: () => {
        const container = Swal.getContainer();
        if (container) container.style.zIndex = "2000";
      },
    });
  };
  const duplicateNotice = useRef("");
  useEffect(() => {
    const code = normalizeCatalogCode(details.code);
    if (duplicateNotice.current !== code) duplicateNotice.current = "";
    if (
      course ||
      !matches.some((match) => normalizeCatalogCode(match.code) === code) ||
      duplicateNotice.current === code
    ) return;
    duplicateNotice.current = code;
    Swal.fire({
      icon: "warning",
      title: "Course code already exists",
      text: "Return to Course Management and select the existing course to upload a new syllabus version.",
      confirmButtonText: "OK",
      confirmButtonColor: "#80a9d3",
      didOpen: () => {
        Swal.getContainer().style.zIndex = "2000";
      },
    }).then((result) => {
      if (result.isConfirmed) onClose();
    });
  }, [course, details.code, matches, onClose]);
  useEffect(
    () => () => {
      if (pending.current)
        catalogRequest(`/uploads/${pending.current}`, {
          method: "DELETE",
        }).catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (!upload || course) return;
    setMatches([]);
    if (!details.code) return;
    let active = true;
    const timer = setTimeout(() => {
      findCatalogCodeMatches(details.code, catalogRequest)
        .then((records) => {
          if (active) setMatches(records);
        })
        .catch((e) => {
          if (active) setError(`Could not check the course code: ${e.message}`);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [details.code, upload, course]);
  const choose = async (file) => {
    if (!file) return;
    setError("");
    if (!/\.pdf$/i.test(file.name) || file.size > 15 * 1024 * 1024) {
      setError("Choose a PDF no larger than 15 MB.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const data = await catalogRequest("/uploads", { method: "POST", body });
      pending.current = data.uploadId;
      setUpload(data);
      setReviewed(false);
      setDetails({
        ...data.suggestions,
        ...(course
          ? {
              ...course,
              academic_year: data.suggestions.academic_year,
              semester: data.suggestions.semester,
              coverage_modules: data.suggestions.coverage_modules || [],
            }
          : {}),
      });
      setMatches(data.matches || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const reextract = async () => {
    setBusy(true);
    setError("");
    setReviewed(false);
    try {
      const data = await catalogRequest(`/uploads/${upload.uploadId}/extract`, {
        method: "POST",
      });
      setUpload({ ...upload, ...data });
      setDetails({
        ...data.suggestions,
        ...(attach
          ? {
              ...attach,
              academic_year: data.suggestions.academic_year,
              semester: data.suggestions.semester,
              coverage_modules: data.suggestions.coverage_modules,
            }
          : {}),
      });
      setMatches(data.matches || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const change = (value) => {
    setDetails(value);
    setReviewed(false);
    if (!course && attach && value.code !== details.code) setAttach(null);
  };
  const save = async (activate) => {
    setInvalid(true);
    setError("");
    if (!attach && (!details.code?.trim() || !details.title?.trim())) {
      setError("Course code and title are required.");
      return;
    }
    if ((activate || attach?.status === "active") && !reviewed) {
      setError(
        "Confirm review before activating or adding a version to an active course.",
      );
      return;
    }
    setBusy(true);
    try {
      // Always check the current code again, even before the debounced lookup finishes.
      if (!attach) {
        const existing = await findCatalogCodeMatches(
          details.code,
          catalogRequest,
        );
        setMatches(existing);
        if (existing.length) {
          duplicateNotice.current = "";
          return;
        }
        const archived = await findArchivedCatalogCodeMatches(details.code, catalogRequest);
        if (archived.length) {
          const previous = archived[0];
          const choice = await Swal.fire({
            icon: "question",
            title: `Restore archived ${previous.code}?`,
            text: `${previous.title}. Restore this course and keep its syllabus history, or create a separate course with the same code. Restoring adds your uploaded PDF as a new syllabus version when you save.${archived.length > 1 ? " The most recently archived match will be restored." : ""}`,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: "Restore archived course",
            denyButtonText: "Create new course",
            cancelButtonText: "Back",
            confirmButtonColor: "#80a9d3",
            denyButtonColor: "#576b80",
            didOpen: () => { Swal.getContainer().style.zIndex = "2000"; },
          });
          if (choice.isConfirmed) {
            setAttach(previous);
            setDetails(current => ({ ...current, code: previous.code, title: previous.title, description: previous.description, units: previous.units, programs: previous.programs }));
            setReviewed(false);
            return;
          }
          if (!choice.isDenied) return;
        }
      }
      const saved = await catalogRequest("", {
        method: "POST",
        body: JSON.stringify({
          ...details,
          uploadId: upload.uploadId,
          catalogId: attach?.catalog_id,
          restoreArchived: Boolean(attach?.archived_at),
          activate,
          reviewed,
        }),
      });
      pending.current = null;
      notifyCatalogChanged();
      onSaved(saved.generationQueued ? "Course saved and activated. Draft lessons are generating in the background." : attach?.archived_at ? "Course restored and syllabus version saved." : attach ? "Syllabus version saved." : "Catalog course saved.");
    } catch (e) {
      setError(e.message);
      if (e.matches) setMatches(e.matches);
    } finally {
      setBusy(false);
    }
  };
  return (
    <CatalogModal
      title={course ? "Upload New Syllabus Version" : "Upload Syllabus"}
      variant="details"
      wide
      busy={busy}
      onClose={onClose}
    >
      <p className="catalog-note">
        {upload
          ? "2. Review Details → 3. Save"
          : "1. Upload PDF → 2. Review Details → 3. Save"}
      </p>
      {!upload ? (
        <div
          className="catalog-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) choose(e.dataTransfer.files[0]);
          }}
        >
          <strong>Drag and drop a syllabus PDF here</strong>
          <p>PDF only · Maximum 15 MB</p>
          <input
            type="file"
            aria-label="Choose syllabus PDF"
            accept=".pdf,application/pdf"
            disabled={busy}
            onChange={(e) => choose(e.target.files[0])}
          />
          {busy && (
            <p role="status">Uploading and extracting searchable PDF text…</p>
          )}
        </div>
      ) : (
        <>
          {upload.extractionMessage && (
            <p className="catalog-note" role="status">
              {upload.extractionMessage}
            </p>
          )}
          <p>Review the extracted information before activating this course.</p>
          <button
            className="catalog-button catalog-extract"
            type="button"
            disabled={busy}
            onClick={reextract}
          >
            {busy
              ? "Analyzing PDF…"
              : "Re-extract PDF Details and Module Titles"}
          </button>
          {!course && matches.length > 0 && (
            <div className="catalog-note">
              <strong>Existing course</strong>
              <p>
                This code matches an existing catalog course, ignoring spaces
                and letter case. Select it to add a syllabus version instead of
                creating a duplicate.
              </p>
              {matches.map((match) => (
                <label className="catalog-check" key={match.catalog_id}>
                  <input
                    type="radio"
                    name="existing-course"
                    checked={attach?.catalog_id === match.catalog_id}
                    disabled={!!match.archived_at || busy}
                    onChange={() => {
                      setAttach(match);
                      setDetails({ ...details, ...match });
                      setReviewed(false);
                    }}
                  />{" "}
                  Attach as a new version to {match.code} — {match.title}
                  {match.archived_at
                    ? " (archived — restore this course first)"
                    : ""}
                </label>
              ))}
            </div>
          )}
          {attach && (
            <p className="catalog-note">
              This PDF will be added to {attach.code} — {attach.title}. Existing
              PDFs and professor class selections are preserved. Use Edit
              Details to change the catalog information.
            </p>
          )}
          {attach?.archived_at && <p className="catalog-note" role="status">You selected the archived {attach.code}. Review its original course details below. Saving will restore it and add this PDF as a new syllabus version. Existing classes and syllabus history will be kept.</p>}
          <div className="catalog-review">
            <PdfPreview path={`/uploads/${upload.uploadId}/pdf`} />
            <div className="catalog-fields">
              <CatalogFields
                value={details}
                onChange={change}
                readOnly={!!attach}
                invalid={invalid}
              />
              <label>
                Syllabus academic year
                <input
                  value={details.academic_year || ""}
                  maxLength={30}
                  placeholder="e.g. 2026–2027"
                  onChange={(e) =>
                    change({ ...details, academic_year: e.target.value })
                  }
                />
              </label>
              <label>
                Syllabus semester
                <input
                  value={details.semester || ""}
                  maxLength={30}
                  placeholder="e.g. First Semester"
                  onChange={(e) =>
                    change({ ...details, semester: e.target.value })
                  }
                />
              </label>
              <CoverageModules
                value={details.coverage_modules}
                busy={busy}
                onChange={(coverage_modules) =>
                  change({ ...details, coverage_modules })
                }
              />
              <label className="catalog-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I have reviewed the course information and syllabus period.
              </label>
            </div>
          </div>
          {!reviewed && (
            <p className="catalog-note">
              To activate this course or save a version to an active course,
              tick the review confirmation above.
            </p>
          )}
          <div className="catalog-actions">
            <button
              type="button"
              className="catalog-button catalog-cancel"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="catalog-button catalog-save-draft"
              disabled={busy}
              onClick={() => save(false)}
            >
              {attach ? "Save Syllabus Version" : "Save Draft"}
            </button>
            {(!attach || attach.status === "draft") && (
              <button
                type="button"
                className="catalog-button catalog-save-activate"
                disabled={busy}
                onClick={() => save(true)}
              >
                Save and Activate
              </button>
            )}
            {busy && <span role="status">Saving…</span>}
          </div>
        </>
      )}
      {!upload && (
        <button
          type="button"
          className="catalog-button catalog-cancel"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
      )}
    </CatalogModal>
  );
}
