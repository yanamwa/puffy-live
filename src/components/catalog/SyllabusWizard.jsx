import Swal from "sweetalert2";
import { normalizeCatalogCode } from "../../services/catalogDuplicates.js";
import CoverageModules from "./CoverageModules.jsx";
import { useEffect, useRef, useState } from "react";
import {
  catalogRequest,
  notifyCatalogChanged,
} from "../../services/catalogApi.js";
import { CatalogModal, PdfPreview } from "./CatalogModal.jsx";

const unsupportedSyllabusMessage =
  "The uploaded document is not recognized as a Cavite State University (CvSU) syllabus. Please upload a valid CvSU syllabus.";
const verificationUnavailable = "SYLLABUS_VERIFICATION_UNAVAILABLE";

function requireValidatedSyllabus(data) {
  if (data.cvsuSyllabusValidated !== true) {
    throw Object.assign(
      new Error("The upload server did not return a CvSU verification result. Update the backend and try again."),
      { code: verificationUnavailable },
    );
  }
}

function discardUpload(uploadId) {
  if (uploadId) {
    void catalogRequest(`/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
  }
}

export function CatalogFields({
  value,
  onChange,
  readOnly = false,
  showPrograms = true,
}) {
  const field = (key, label, type = "text", required = false) => {
    const update = readOnly
      ? undefined
      : (e) => onChange({ ...value, [key]: e.target.value });
    return (
      <label key={key}>
        {label}
        {required && !readOnly ? " *" : ""}
        {key === "description" ? (
          <textarea
            value={value[key] || ""}
            onChange={update}
            readOnly={readOnly}
            placeholder={readOnly ? "Not detected" : undefined}
            maxLength={15000}
          />
        ) : (
          <input
            type={type}
            value={value[key] ?? ""}
            onChange={update}
            readOnly={readOnly}
            placeholder={readOnly ? "Not detected" : undefined}
            required={required && !readOnly}
            maxLength={key === "code" ? 50 : 255}
            min={type === "number" ? 0 : undefined}
            max={type === "number" ? 99 : undefined}
            step={type === "number" ? "0.5" : undefined}
          />
        )}
      </label>
    );
  };
  return (
    <div className="catalog-fields">
      {field("code", "Course code", "text", true)}
      {field("title", "Course title", "text", true)}
      {field("description", "Course description")}
      {field("units", "Credit units", "number")}
      {showPrograms && (
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
      )}
    </div>
  );
}
export default function SyllabusWizard({ course, onClose, onSaved }) {
  const [upload, setUpload] = useState(null),
    [details, setDetails] = useState({ programs: [] }),
    [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false),
    [matches, setMatches] = useState([]),
    [attach, setAttach] = useState(course || null);
  const courseMismatch = Boolean(
    upload &&
      attach &&
      normalizeCatalogCode(details.code) !== normalizeCatalogCode(attach.code),
  );
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
  const handleUploadError = (error) => {
    const unavailable = error.code === verificationUnavailable;
    if (error.code !== "INVALID_SYLLABUS" && !unavailable) {
      setError(error.message);
      return;
    }
    discardUpload(pending.current);
    pending.current = null;
    setUpload(null);
    setDetails({ programs: [] });
    setMatches([]);
    setAttach(course || null);
    setReviewed(false);
    void Swal.fire({
      title: unavailable ? "Syllabus Verification Unavailable" : "Unsupported Syllabus",
      text: unavailable ? error.message : unsupportedSyllabusMessage,
      confirmButtonText: "OK",
      showCloseButton: true,
      allowOutsideClick: false,
      buttonsStyling: false,
      customClass: {
        container: "catalog-confirm-overlay catalog-syllabus-alert-overlay",
        popup: "catalog-confirm-popup catalog-syllabus-alert",
      },
    });
  };
  const applyMatches = (found = []) => {
    setMatches(found);
    setAttach(course || (found.length === 1 ? found[0] : null));
  };
  useEffect(
    () => () => discardUpload(pending.current),
    [],
  );
  const choose = async (file) => {
    if (!file) return;
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
      requireValidatedSyllabus(data);
      setUpload(data);
      setReviewed(false);
      setDetails(data.suggestions);
      applyMatches(data.matches);
    } catch (error) {
      handleUploadError(error);
    } finally {
      setBusy(false);
    }
  };
  const reextract = async () => {
    setBusy(true);
    setReviewed(false);
    try {
      const data = await catalogRequest(`/uploads/${upload.uploadId}/extract`, {
        method: "POST",
      });
      requireValidatedSyllabus(data);
      setUpload({ ...upload, ...data });
      setDetails(data.suggestions);
      applyMatches(data.matches);
    } catch (error) {
      handleUploadError(error);
    } finally {
      setBusy(false);
    }
  };
  const changeCoverage = (coverage_modules) => {
    setDetails({ ...details, coverage_modules });
    setReviewed(false);
  };
  const save = async () => {
    if (courseMismatch || (!attach && matches.length)) return;
    if (!reviewed) {
      setError("Confirm that you reviewed the syllabus before submitting.");
      return;
    }
    setBusy(true);
    try {
      await catalogRequest("", {
        method: "POST",
        body: JSON.stringify({
          coverage_modules: details.coverage_modules,
          uploadId: upload.uploadId,
          catalogId: attach?.catalog_id,
          reviewed,
        }),
      });
      pending.current = null;
      notifyCatalogChanged();
      onSaved("Syllabus submitted for super admin review.");
    } catch (e) {
      handleUploadError(e);
      if (e.matches) {
        applyMatches(e.matches);
        setReviewed(false);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <CatalogModal
      title={course ? "Upload New Syllabus Version" : "Upload Syllabus"}
      variant="details catalog-syllabus-wizard"
      wide
      busy={busy}
      onClose={onClose}
      footer={
        <>
          {upload && !reviewed && (
            <p className="catalog-review-hint">
              Confirm review before submitting the syllabus for approval.
            </p>
          )}
          <div className="catalog-actions">
            {busy && <span role="status">Processing syllabus.</span>}
            <button
              type="button"
              className="catalog-button catalog-cancel"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            {upload && (
              <button
                type="button"
                className="catalog-button catalog-save-draft"
                disabled={busy || !reviewed || courseMismatch || (!attach && matches.length > 0)}
                onClick={save}
              >
                {attach ? "Submit Syllabus Version" : "Submit Syllabus"}
              </button>
            )}
          </div>
        </>
      }
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
          <strong>Drag and drop a CvSU syllabus PDF here</strong>
          <p>PDF only · Maximum 15 MB</p>
          <input
            type="file"
            aria-label="Choose CvSU syllabus PDF"
            accept=".pdf,application/pdf"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files[0];
              e.target.value = "";
              choose(file);
            }}
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
          <p>Review the course details extracted from the PDF before saving.</p>
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
                This syllabus matches an existing catalog course.
              </p>
              {matches.map((match) => (
                <label className="catalog-check" key={match.catalog_id}>
                  <input
                    type="radio"
                    name="existing-course"
                    checked={attach?.catalog_id === match.catalog_id}
                    disabled={busy}
                    onChange={() => {
                      setAttach(match);
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
          {courseMismatch ? (
            <p className="catalog-error" role="alert">
              This PDF is for {details.code}. Upload a syllabus for {attach.code}.
            </p>
          ) : attach && (
            <p className="catalog-note">
              This PDF will be added to {attach.code} — {attach.title}. Existing
              PDFs and professor class selections are preserved. Use Edit
              Details to change the catalog information.
            </p>
          )}
          <div className="catalog-review">
            <PdfPreview path={`/uploads/${upload.uploadId}/pdf`} />
            <div className="catalog-fields">
              <CatalogFields
                value={details}
                readOnly
                showPrograms={false}
              />
              <label>
                Syllabus academic year
                <input
                  value={details.academic_year || ""}
                  placeholder="Not detected"
                  readOnly
                />
              </label>
              <label>
                Syllabus semester
                <input
                  value={details.semester || ""}
                  placeholder="Not detected"
                  readOnly
                />
              </label>
              <CoverageModules
                value={details.coverage_modules}
                busy={busy}
                onChange={changeCoverage}
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
        </>
      )}
    </CatalogModal>
  );
}
