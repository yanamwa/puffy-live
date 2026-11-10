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

export default function StudentImportPanel({ busy, disabled, onImport }) {
  const titleId = useId();
  const fileInputRef = useRef(null);
  const [pending, setPending] = useState(null);

  function selectFile(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setPending(null);
    onImport(file, () =>
      parseStudentImportFile(file, (table) => setPending({ file, ...table })),
    );
  }

  function importMappedRows() {
    const { file, rows, layout } = pending;
    setPending(null);
    onImport(file, () => mapStudentImportRows(rows, layout));
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
          Use a full name and email, or use first and last names to generate a
          CvSU email.
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

      {pending && (
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
            {STUDENT_FIELDS.map(([field, label]) => (
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
            Year can be read from the section. Email can be generated when both
            name columns are matched.
          </p>
          <div className="student-import-actions">
            <button
              className="student-import-button"
              type="button"
              disabled={!canImportStudentLayout(layout)}
              onClick={importMappedRows}
            >
              Import mapped students
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
