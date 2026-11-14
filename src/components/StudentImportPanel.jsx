import { useId, useRef, useState } from "react";
import { FiUpload } from "react-icons/fi";
import {
  canImportStudentLayout,
  getStudentImportLayout,
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
  const fileInputRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [preview, setPreview] = useState(null);

  function selectFile(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setPending(null);
    onImport(file, () =>
      parseStudentImportFile(file, (table) => setPending({ file, ...table }), {
        review: Boolean(reviewStudents),
      }),
    );
  }

  function importMappedRows() {
    const { file, rows, layout } = pending;
    if (reviewStudents) {
      setPreview(mapStudentImportRows(rows, layout, { preview: true }));
      return;
    }
    setPending(null);
    onImport(file, () => mapStudentImportRows(rows, layout));
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
    const { file } = pending;
    const students = preview.map(({ reviewName, ...student }) => student);
    setPreview(null);
    setPending(null);
    onImport(file, () => students);
  }

  function changeStartRow(rowIndex, hasHeaders) {
    setPending(({ file, rows }) => ({
      file,
      rows,
      layout: getStudentImportLayout(rows, rowIndex, hasHeaders),
    }));
  }

  function changeMapping(change) {
    setPending((current) => ({
      ...current,
      layout: { ...current.layout, ...change(current.layout) },
    }));
  }

  const layout = pending?.layout;
  const errors = preview ? reviewStudents(preview) : [];
  const columnOptions = layout
    ? Array.from(
        {
          length: pending.rows.reduce(
            (max, row) => Math.max(max, row.cells.length),
            0,
          ),
        },
        (_, index) => ({
          index,
          text: pending.rows[layout.rowIndex].cells[index] || "",
        }),
      )
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

      {pending && !preview && (
        <fieldset
          className="student-import-mapping"
          disabled={busy || disabled}
        >
          <legend>Match columns</legend>
          <p>
            {pending.file.name}. Match each student field to a column. Use each
            column once.
          </p>
          <div className="student-import-fields">
            <label>
              {layout.hasHeaders ? "Header row" : "First student row"}
              <select
                value={layout.rowIndex}
                onChange={(event) =>
                  changeStartRow(Number(event.target.value), layout.hasHeaders)
                }
              >
                {pending.rows.map(({ cells, sourceRow }, index) => (
                  <option key={sourceRow} value={index}>
                    {sourceRow} ·{" "}
                    {cells.filter(Boolean).slice(0, 3).join(" | ").slice(0, 80)}
                  </option>
                ))}
              </select>
            </label>
            <label className="student-import-checkbox">
              <input
                type="checkbox"
                checked={layout.hasHeaders}
                onChange={(event) =>
                  changeStartRow(layout.rowIndex, event.target.checked)
                }
              />
              File has column headers
            </label>
            {[
              ...STUDENT_FIELDS,
              ...(reviewStudents ? [["middleName", "Middle name"]] : []),
            ].map(([field, label]) => (
              <label key={field}>
                {label}
                <select
                  value={layout.columns[field] ?? -1}
                  onChange={(event) => {
                    const index = Number(event.target.value);
                    changeMapping(({ columns }) => ({
                      columns: { ...columns, [field]: index },
                    }));
                  }}
                >
                  <option value={-1}>Choose column</option>
                  {columnOptions.map(({ index, text }) => (
                    <option key={index} value={index}>
                      {index + 1}
                      {text && " · " + text.slice(0, 80)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Default section
              <input
                type="text"
                value={layout.defaultSection}
                placeholder="e.g. 3C"
                onChange={(event) => {
                  const defaultSection = event.target.value;
                  changeMapping(() => ({ defaultSection }));
                }}
              />
            </label>
          </div>
          <p>
            Match student ID, gender, and a section or enter a default section.
            {reviewStudents
              ? " Year level comes from the section."
              : " Year can be read from the section. Email can be generated when both name columns are matched."}
          </p>
          <div className="student-import-actions">
            <button
              className="student-import-button"
              type="button"
              disabled={!canImportStudentLayout(layout)}
              onClick={importMappedRows}
            >
              {reviewStudents ? "Preview students" : "Import mapped students"}
            </button>
            <button
              className="student-import-cancel"
              type="button"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      )}

      {preview && (
        <fieldset
          className="student-import-mapping"
          disabled={busy || disabled}
        >
          <legend>Review {preview.length} students</legend>
          <p>
            {preview.length
              ? "Check the names and email addresses before creating accounts. Edit the email directly if you change a name."
              : "No student records found after the selected header."}
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
              onClick={() => setPreview(null)}
            >
              Back to column matching
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

      {!pending && (
        <button
          className="student-import-button"
          type="button"
          disabled={busy || disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <FiUpload aria-hidden="true" />
          {busy ? "Reading file…" : "Import CSV or Excel"}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        hidden
        onChange={selectFile}
      />
    </section>
  );
}
