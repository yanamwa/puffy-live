import { useId, useRef, useState } from "react";
import { FiUpload } from "react-icons/fi";
import {
  mapStudentImportRows,
  parseStudentImportFile,
} from "../utils/studentImport.js";
import "./StudentImportPanel.css";

const STUDENT_FIELDS = [
  ["name", "Full name"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Email"],
  ["studentId", "Student ID"],
  ["gender", "Gender"],
  ["yearLevel", "Year level"],
  ["sectionName", "Section"],
  ["course", "Course / Program"],
];

const PREVIEW_FIELDS = STUDENT_FIELDS.filter(
  ([field]) => !["firstName", "lastName", "yearLevel"].includes(field),
);
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function StudentImportPanel({
  busy,
  disabled,
  onImport,
  reviewStudents,
}) {
  const titleId = useId();
  const rosterTitleId = useId();
  const fileInputRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [filenameSection, setFilenameSection] = useState("");

  function selectFile(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setPending(null);
    setPreview(null);
    setReviewOpen(false);
    setFilenameSection("");
    onImport(file, () =>
      parseStudentImportFile(
        file,
        ({ rows, layout }) => {
          const section = file.name
            .match(/\b([1-4][A-F])(?=\b)/i)?.[1]
            .toUpperCase();
          const students = mapStudentImportRows(
            rows,
            {
              ...layout,
              defaultSection: layout.defaultSection || section || "",
            },
            { preview: true },
          );
          if (!students.length) {
            throw new Error(
              "No student records could be detected. Check the roster headers and upload the file again.",
            );
          }
          setPending(file);
          setFilenameSection(layout.defaultSection ? "" : section || "");
          setPreview(students);
        },
        { review: true },
      ),
    );
  }

  function editStudent(index, field, value) {
    setPreview((students) =>
      students.map((student, row) => {
        if (row !== index) return student;
        const updated = { ...student, [field]: value };
        if (field === "sectionName") {
          updated.yearLevel = YEAR_LEVELS[Number(value.trim()[0]) - 1] ?? "";
        }
        return updated;
      }),
    );
  }

  function confirmImport() {
    const file = pending;
    const students = preview.map(({ reviewName, ...student }) => student);
    setPreview(null);
    setPending(null);
    onImport(file, () => students);
  }

  const errors = preview
    ? (reviewStudents?.(preview) ??
      preview.map((student) => {
        const missing = PREVIEW_FIELDS.filter(
          ([field]) => field !== "course" && !student[field]?.trim(),
        ).map(([, label]) => label);
        return missing.length ? [`Missing: ${missing.join(", ")}.`] : [];
      }))
    : [];

  return (
    <section className="student-import-panel" aria-labelledby={titleId}>
      <h3 id={titleId}>Bulk Import Students</h3>
      <div className="student-import-notes">
        <p>
          Upload a CSV or Excel roster with student details in any column order.
          Include a Course or Program column to save the degree program.
        </p>
        <p>
          {reviewStudents
            ? "CvSU email addresses are generated from student names when the roster has no email. Review the addresses before importing."
            : "Use a full name and email, or use first and last names to generate a CvSU email."}
        </p>
        <p className="student-import-examples">
          Download an example in{" "}
          <a
            href={import.meta.env.BASE_URL + "student-roster-example.csv"}
            download
          >
            CSV
          </a>{" "}
          or{" "}
          <a
            href={import.meta.env.BASE_URL + "student-roster-example.xlsx"}
            download
          >
            Excel
          </a>
          . Replace the sample rows before importing.
        </p>
      </div>

      {preview && (
        <dialog
          className="student-import-dialog"
          aria-labelledby={rosterTitleId}
          ref={(dialog) => {
            if (dialog && !dialog.open) dialog.showModal();
          }}
          onCancel={(event) => event.stopPropagation()}
          onClose={() => {
            setPreview(null);
            setPending(null);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={selectFile}
          />
          <h3 id={rosterTitleId}>
            {errors.some((row) => row.length)
              ? "Student details needed"
              : "Review roster"}
          </h3>
          {preview && !reviewOpen && (
            <fieldset
              className="student-import-mapping"
              disabled={busy || disabled}
            >
              <p>
                We found {preview.length}{" "}
                {preview.length === 1 ? "student" : "students"} in{" "}
                <strong>{pending.name}</strong>.
              </p>
              {filenameSection && (
                <p>
                  <strong>Section.</strong> We found {filenameSection} in the
                  filename. Confirm or edit it in the preview. The year level
                  will be set to {YEAR_LEVELS[Number(filenameSection[0]) - 1]}.
                </p>
              )}
              {preview.some((student) => !student.sectionName) && (
                <p>
                  <strong>Section.</strong> Fill in any missing sections in the
                  preview to set the year level.
                </p>
              )}
              {preview.some(
                (student) => !["Male", "Female"].includes(student.gender),
              ) && (
                <p>
                  <strong>Sex / Gender.</strong> Fill in the missing or invalid
                  values in the preview, or add a Sex column and upload the file
                  again.
                </p>
              )}
              <div className="student-import-actions">
                <button
                  className="student-import-button"
                  type="button"
                  onClick={() => setReviewOpen(true)}
                >
                  Review {preview.length}{" "}
                  {preview.length === 1 ? "student" : "students"}
                </button>
                <button
                  className="student-import-cancel"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload another file
                </button>
                <button
                  className="student-import-cancel"
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setPending(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </fieldset>
          )}

          {preview && reviewOpen && (
            <fieldset
              className="student-import-mapping"
              disabled={busy || disabled}
            >
              <p>
                {preview.length
                  ? "Check the names and email addresses before creating accounts. Edit the email directly if you change a name."
                  : "No student records found after the selected header."}
              </p>
              <p>
                {pending.name} · {preview.length} student records
              </p>
              <div className="student-import-preview">
                {preview.map((student, index) => (
                  <fieldset
                    key={student.sourceRow}
                    className="student-import-mapping"
                  >
                    <legend>
                      Row {student.sourceRow} ·{" "}
                      {student.yearLevel || "Year level pending"}
                    </legend>
                    {student.reviewName && (
                      <p>Check which names belong in the CvSU email.</p>
                    )}
                    <div className="student-import-fields">
                      {PREVIEW_FIELDS.map(([field, label]) => (
                        <label key={field}>
                          {label}
                          <input
                            type="text"
                            value={student[field] ?? ""}
                            onChange={(event) =>
                              editStudent(index, field, event.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                    {errors[index]?.length > 0 && (
                      <p className="student-import-error">
                        {errors[index].join(" ")}
                      </p>
                    )}
                  </fieldset>
                ))}
              </div>
              <div className="student-import-actions">
                <button
                  className="student-import-button"
                  type="button"
                  disabled={!preview.length || errors.some((row) => row.length)}
                  onClick={confirmImport}
                >
                  Confirm import
                </button>
                <button
                  className="student-import-cancel"
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setPending(null);
                  }}
                >
                  Clear preview
                </button>
              </div>
            </fieldset>
          )}
        </dialog>
      )}

      {!preview && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={selectFile}
          />
          <button
            className="student-import-button"
            type="button"
            disabled={busy || disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <FiUpload aria-hidden="true" />
            {busy
              ? "Reading file…"
              : pending
                ? "Upload another file"
                : "Import CSV or Excel"}
          </button>
        </>
      )}
    </section>
  );
}
