import { FiCalendar, FiFileText, FiBookOpen } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";
import { academicCalendarRequest } from "../../services/academicCalendarApi.js";
import {
  CalendarInlinePreview,
  useAcademicCalendars,
} from "../../components/academicCalendar/AcademicCalendar.jsx";
const empty = () => ({
  title: "CvSU Academic Calendar",
  academic_year: "",
  published: true,
  events: [],
});
export default function AcademicCalendarPage() {
  const { records, loading, error, reload } = useAcademicCalendars();
  const [value, setValue] = useState(empty);
  const [tab, setTab] = useState("Calendar View");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState("");
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("All Event Types");
  const [eventPage, setEventPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const addDialog = useRef(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
  });
  const upload = useRef(null);
  const typeOf = (event) =>
    /exam/i.test(event.title)
      ? "Examination"
      : /deadline|last day/i.test(event.title)
        ? "Deadline"
        : /payment|fee/i.test(event.title)
          ? "Payment"
          : "Academic";
  const matches = (event) =>
    event.title.toLowerCase().includes(search.toLowerCase()) &&
    (eventType === "All Event Types" || typeOf(event) === eventType);
  const filteredEvents = value.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => matches(event));
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / 5));
  const currentPage = Math.min(eventPage, pageCount);
  const pageEvents = filteredEvents.slice(
    (currentPage - 1) * 5,
    currentPage * 5,
  );
  useEffect(() => {
    setEventPage(1);
    setEditing(null);
  }, [search, eventType, value.calendar_id]);
  const [files, setFiles] = useState([]);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [importReview, setImportReview] = useState(null);
  const initialized = useRef(false);
  const [importing, setImporting] = useState(false);
  const loadCalendar = (record) => {
    setValue({
      ...record,
      title: "CvSU Academic Calendar",
      events: (record.events || []).map((event) => ({ ...event })),
    });
    setFiles([]);
    setFileKey((key) => key + 1);
    setSaveError("");
    setImportReview(null);
    if (record.filename && !(record.events || []).length)
      importEvents([], record);
  };
  useEffect(() => {
    if (loading || error || initialized.current) return;
    initialized.current = true;
    if (records[0]) loadCalendar(records[0]);
  }, [loading, error, records]);

  const importEvents = async (sourceFiles = files, sourceCalendar = value) => {
    if (
      sourceFiles.length > 5 ||
      sourceFiles.some((item) => item.size > 10 * 1024 * 1024)
    ) {
      setSaveError("Choose up to 5 files, each no larger than 10 MB.");
      return;
    }
    setImporting(true);
    setBusy(true);
    setSaveError("");
    setMessage("");
    try {
      let path = `/${sourceCalendar.calendar_id}/extract`;
      let body;
      if (sourceFiles.length) {
        body = new FormData();
        sourceFiles.forEach((item) => body.append("file", item));
        body.append("academic_year", sourceCalendar.academic_year);
        path = "/extract";
      }
      const data = await academicCalendarRequest(path, {
        method: "POST",
        body,
      });
      setValue((current) => {
        const key = (event) =>
          [
            event.title.trim().toLowerCase().replace(/\s+/g, " "),
            event.start_date,
            event.end_date || event.start_date,
            (event.description || "").trim().toLowerCase().replace(/\s+/g, " "),
          ].join("|");
        const seen = new Set(current.events.map(key));
        return {
          ...current,
          academic_year: current.academic_year || data.academic_year,
          events: [
            ...current.events,
            ...data.events.filter((event) => {
              const id = key(event);
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            }),
          ],
        };
      });
      setImportReview({
        count: data.events.length,
        undated: data.undated,
        reviewed: false,
      });
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setImporting(false);
      setBusy(false);
    }
  };
  const reset = () => {
    setValue(empty());
    setFiles([]);
    setFileKey((k) => k + 1);
    setSaveError("");
    setImportReview(null);
  };
  const changeEvent = (index, key, field) =>
    setValue((current) => ({
      ...current,
      events: current.events.map((event, i) =>
        i === index ? { ...event, [key]: field } : event,
      ),
    }));
  const save = async (event) => {
    event.preventDefault();
    setSaveError("");
    setMessage("");
    if (importReview && !importReview.reviewed) {
      setSaveError(
        "Review the imported event dates and tick the confirmation before saving.",
      );
      return;
    }
    if (!value.calendar_id && !files.length && !value.events.length) {
      setSaveError("Add an event or upload the official academic calendar.");
      return;
    }
    if (
      files.length > 5 ||
      files.some((item) => item.size > 10 * 1024 * 1024)
    ) {
      setSaveError("Choose up to 5 files, each no larger than 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      for (const key of ["title", "academic_year", "published"])
        body.append(key, value[key]);
      body.append("events", JSON.stringify(value.events));
      files.forEach((item) => body.append("file", item));
      await academicCalendarRequest(
        value.calendar_id ? `/${value.calendar_id}` : "",
        { method: value.calendar_id ? "PUT" : "POST", body },
      );
      setMessage(
        value.published
          ? "Academic calendar published. Students can now view events and descriptions on their calendar."
          : "Calendar saved as a draft. It is hidden from students.",
      );
      initialized.current = false;
      reload();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="academic-management">
      <header className="academic-page-heading super-page-heading">
        <div>
          <h1>Academic Calendar</h1>
          <p>
            Manage CvSU academic dates and descriptions. An official calendar
            document can also be attached.
          </p>
        </div>
        <div className="academic-header-controls">
          {records.length > 0 && (
            <label className="academic-saved-year">
              Academic year to manage
              <select
                disabled={busy}
                value={value.calendar_id || "new"}
                onChange={(e) => {
                  if (e.target.value === "new") reset();
                  else {
                    const record = records.find(
                      (item) => String(item.calendar_id) === e.target.value,
                    );
                    if (record) loadCalendar(record);
                  }
                }}
              >
                {records.map((record) => (
                  <option value={record.calendar_id} key={record.calendar_id}>
                    {record.academic_year}
                  </option>
                ))}
                <option value="new">Create a new academic year</option>
              </select>
            </label>
          )}
          <span
            className={`academic-publication-status ${value.published ? "is-published" : "is-draft"}`}
          >
            {value.published ? "Published" : "Draft"}
          </span>
        </div>
      </header>
      {message && (
        <p className="academic-success" role="status">
          {message}
        </p>
      )}
      {loading && <p role="status">Loading saved calendar and event dates…</p>}
      {error && (
        <p className="academic-error" role="alert">
          {error}{" "}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      <div className="academic-overview">
        <div>
          <FiCalendar className="academic-stat-icon" aria-hidden="true" />
          <small>Total Events</small>
          <strong>{value.events.length}</strong>
        </div>
        <div>
          <FiFileText className="academic-stat-icon" aria-hidden="true" />
          <small>Documents</small>
          <strong>
            {files.length ||
              value.documents?.length ||
              (value.filename ? 1 : 0)}
          </strong>
        </div>
        <div>
          <FiBookOpen className="academic-stat-icon" aria-hidden="true" />
          <small>Academic Year</small>
          <strong>{value.academic_year || "Not set"}</strong>
        </div>
      </div>
      <nav className="academic-tabs" aria-label="Calendar views">
        {["Calendar View", "Manage Events", "Documents"].map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "Calendar View" && (
        <section
          className="academic-dashboard-calendar"
          aria-label="Monthly academic calendar"
        >
          <header>
            <button
              type="button"
              className="academic-button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              &lsaquo;
            </button>
            <h2>
              {month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              type="button"
              className="academic-button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              &rsaquo;
            </button>
          </header>
          <div className="academic-dashboard-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <small key={day}>{day}</small>
            ))}
            {Array.from({ length: month.getDay() }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from(
              {
                length: new Date(
                  month.getFullYear(),
                  month.getMonth() + 1,
                  0,
                ).getDate(),
              },
              (_, i) => {
                const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                const events = value.events.filter(
                  (event) =>
                    event.start_date <= key &&
                    (event.end_date || event.start_date) >= key,
                );
                return (
                  <button
                    type="button"
                    key={key}
                    className={events.length ? "has-events" : ""}
                    aria-pressed={selectedDay === key}
                    aria-label={`${key}, ${events.length} events`}
                    title={events.map((event) => event.title).join("; ")}
                    onClick={() => setSelectedDay(key)}
                  >
                    {i + 1}
                    <span className="academic-date-dots">
                      {[...new Set(events.map(typeOf))].map((type) => (
                        <i
                          key={type}
                          className={`academic-category-${type.toLowerCase()}`}
                        />
                      ))}
                    </span>
                    {events.length > 0 && (
                      <span className="academic-cell-preview">
                        {events[0].title}
                        {events.length > 1 ? ` +${events.length - 1}` : ""}
                      </span>
                    )}
                  </button>
                );
              },
            )}
          </div>
          <div
            className="academic-calendar-legend"
            aria-label="Event categories"
          >
            {["Academic", "Examination", "Deadline", "Payment"].map((type) => (
              <span key={type}>
                <i className={`academic-category-${type.toLowerCase()}`} />
                {type}
              </span>
            ))}
          </div>
          {selectedDay && (
            <div className="academic-selected-events" aria-live="polite">
              <strong>
                {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </strong>
              {value.events
                .filter(
                  (event) =>
                    event.start_date <= selectedDay &&
                    (event.end_date || event.start_date) >= selectedDay,
                )
                .map((event, i) => (
                  <article key={i}>
                    <span
                      className={`academic-detail-type academic-type-${typeOf(event).toLowerCase()}`}
                    >
                      {typeOf(event)}
                    </span>
                    <strong>{event.title}</strong>
                    <small>
                      {event.start_date}
                      {event.end_date && event.end_date !== event.start_date
                        ? ` to ${event.end_date}`
                        : ""}
                    </small>
                    {event.description && <p>{event.description}</p>}
                  </article>
                ))}
              {!value.events.some(
                (event) =>
                  event.start_date <= selectedDay &&
                  (event.end_date || event.start_date) >= selectedDay,
              ) && <p>No activities on this date.</p>}
            </div>
          )}
        </section>
      )}
      <form
        className="academic-editor"
        hidden={tab === "Calendar View"}
        onSubmit={save}
      >
        <h2>
          {value.calendar_id
            ? "Edit academic calendar"
            : "Create academic calendar"}
        </h2>
        <fieldset disabled={busy} className="academic-editor-layout">
          <section
            hidden={tab !== "Documents"}
            className="academic-calendar-details"
            aria-label="Calendar details and document"
          >
            <label>
              Academic year
              <input
                required
                pattern="[0-9]{4}-[0-9]{4}"
                maxLength={9}
                placeholder="2026-2027"
                value={value.academic_year}
                onChange={(e) =>
                  setValue({ ...value, academic_year: e.target.value })
                }
              />
            </label>
            <div className="academic-document-card-heading">
              <div>
                <h3>Official Academic Calendar</h3>
                <p>
                  {files.length ||
                    value.documents?.length ||
                    (value.filename ? 1 : 0)}{" "}
                  attached document(s)
                </p>
              </div>
              <span>
                {files.length || value.filename ? "Attached" : "No document"}
              </span>
            </div>
            <div className="academic-upload-card">
              <strong>Official Calendar Document</strong>
              <p>PDF, PNG, JPEG · Maximum 10 MB per file · Up to 5 files</p>
              <button
                type="button"
                className="academic-button"
                onClick={() => upload.current?.click()}
              >
                {files.length || value.filename
                  ? "Replace Document"
                  : "Upload Document"}
              </button>
            </div>
            <label className="academic-file-input">
              Calendar attachments
              <input
                key={fileKey}
                ref={upload}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.jpe,application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  if (
                    selected.length > 5 ||
                    selected.some((item) => item.size > 10 * 1024 * 1024)
                  ) {
                    setSaveError(
                      "Choose up to 5 files, each no larger than 10 MB.",
                    );
                    e.target.value = "";
                    return;
                  }
                  setFiles(selected);
                  if (selected.length) importEvents(selected);
                }}
              />
            </label>
            {value.filename && (
              <p>
                Current documents:{" "}
                {(value.documents || [{ filename: value.filename }])
                  .map((item) => item.filename)
                  .join(", ")}
                . Select files above to replace it.
              </p>
            )}
            <button
              type="button"
              className="academic-button"
              disabled={!(files.length || value.filename)}
              onClick={() => importEvents()}
            >
              {busy ? "Reading calendar…" : "Import Events from Document"}
            </button>
            <p>
              Selecting images or PDFs automatically combines their dated
              activities in the table. Pages without dates are skipped. Review
              the extracted dates in the table before publishing.
            </p>
            {importReview && (
              <div className="academic-import-review" role="status">
                <p>
                  Found {importReview.count} dated activities. Exact matches
                  already in this calendar are kept once.
                </p>
                {importReview.undated.length > 0 && (
                  <>
                    <p>
                      These entries have no readable date and were not added:
                    </p>
                    <ul>
                      {importReview.undated.map((text, index) => (
                        <li key={index}>{text}</li>
                      ))}
                    </ul>
                  </>
                )}
                <label className="academic-publish">
                  <input
                    type="checkbox"
                    checked={importReview.reviewed}
                    onChange={(e) =>
                      setImportReview({
                        ...importReview,
                        reviewed: e.target.checked,
                      })
                    }
                  />
                  I checked the imported titles and dates against the official
                  calendar.
                </label>
              </div>
            )}
            {files.length ? (
              files.map((item, index) => (
                <CalendarInlinePreview
                  key={`${fileKey}-${index}`}
                  file={item}
                  calendar={value}
                />
              ))
            ) : value.documents?.length ? (
              value.documents.map((item) => (
                <CalendarInlinePreview
                  key={item.file_index}
                  calendar={{
                    ...value,
                    filename: item.filename,
                    mime_type: item.mime_type,
                  }}
                  index={item.file_index}
                />
              ))
            ) : (
              <CalendarInlinePreview calendar={value} />
            )}
          </section>
          <section
            hidden={tab !== "Manage Events"}
            className="academic-calendar-dates"
            aria-labelledby="academic-dates-title"
          >
            <div className="academic-dates-heading">
              <h3 id="academic-dates-title">
                Dates and activities <span>({value.events.length})</span>
              </h3>
              <button
                type="button"
                className="academic-button"
                disabled={value.events.length >= 200}
                onClick={() => {
                  setNewEvent({
                    title: "",
                    description: "",
                    start_date: "",
                    end_date: "",
                  });
                  addDialog.current.showModal();
                }}
              >
                + Add Event
              </button>
            </div>
            <p>
              Showing {filteredEvents.length ? (currentPage - 1) * 5 + 1 : 0}–
              {Math.min(currentPage * 5, filteredEvents.length)} of{" "}
              {filteredEvents.length} events
            </p>
            <div className="academic-event-filters">
              <input
                type="search"
                aria-label="Search activities"
                placeholder="Search activities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Event type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                {[
                  "All Event Types",
                  "Academic",
                  "Examination",
                  "Deadline",
                  "Payment",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="academic-event-list">
              {pageEvents.map(({ event, index }) => (
                <article key={index}>
                  <div>
                    <strong>{event.title || "Untitled event"}</strong>
                    <p>
                      {event.start_date || "Choose a date"}
                      {event.end_date && event.end_date !== event.start_date
                        ? ` to ${event.end_date}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`academic-type-badge academic-type-${typeOf(event).toLowerCase()}`}
                  >
                    {typeOf(event)}
                  </span>
                  <button
                    className="academic-button"
                    type="button"
                    aria-label={`Edit ${event.title || "event"}`}
                    onClick={() => setEditing(editing === index ? null : index)}
                  >
                    ✎
                  </button>
                </article>
              ))}
              {!value.events.some(matches) && <p>No matching activities.</p>}
            </div>
            <nav className="academic-event-pagination" aria-label="Event pages">
              <button
                type="button"
                className="academic-button"
                disabled={currentPage === 1}
                onClick={() => {
                  setEventPage(currentPage - 1);
                  setEditing(null);
                }}
              >
                Previous
              </button>
              <span aria-live="polite">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                className="academic-button"
                disabled={currentPage === pageCount}
                onClick={() => {
                  setEventPage(currentPage + 1);
                  setEditing(null);
                }}
              >
                Next
              </button>
            </nav>
            {editing !== null && (
              <button
                type="button"
                className="academic-button"
                onClick={() => setEditing(null)}
              >
                Done editing
              </button>
            )}
            <div
              className="academic-dates-table-wrap"
              hidden={editing === null}
            >
              <table className="academic-dates-table">
                <thead hidden={editing === null}>
                  <tr>
                    <th scope="col">Activity / Description</th>
                    <th scope="col">Start date</th>
                    <th scope="col">End date</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {value.events.length ? (
                    value.events.map((event, index) => (
                      <tr key={index} hidden={editing !== index}>
                        <td>
                          <input
                            aria-label={`Event ${index + 1} title`}
                            required
                            maxLength={200}
                            value={event.title}
                            onChange={(e) =>
                              changeEvent(index, "title", e.target.value)
                            }
                            placeholder="Activity title"
                          />
                          <textarea
                            aria-label={`Event ${index + 1} description`}
                            maxLength={2000}
                            rows={3}
                            value={event.description || ""}
                            onChange={(e) =>
                              changeEvent(index, "description", e.target.value)
                            }
                            placeholder="Description or instructions"
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Event ${index + 1} start date`}
                            required
                            type="date"
                            value={event.start_date}
                            onChange={(e) =>
                              changeEvent(index, "start_date", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Event ${index + 1} end date`}
                            type="date"
                            min={event.start_date}
                            value={event.end_date}
                            onChange={(e) =>
                              changeEvent(index, "end_date", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="academic-button"
                            aria-label={`Remove event ${index + 1}`}
                            onClick={() =>
                              setValue({
                                ...value,
                                events: value.events.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="academic-dates-empty">
                        {importing
                          ? "Reading the calendar and filling the event dates…"
                          : "Select a calendar document to fill this table, or add an event manually."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <div className="academic-editor-footer">
            <label className="academic-publish">
              <input
                type="checkbox"
                checked={value.published}
                onChange={(e) =>
                  setValue({ ...value, published: e.target.checked })
                }
              />
              Publish for students
            </label>
            {saveError && (
              <p className="academic-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="academic-form-actions">
              <button
                className="academic-button academic-save-button"
                type="submit"
              >
                {busy
                  ? "Saving…"
                  : value.published
                    ? "Save and Publish"
                    : "Save Draft"}
              </button>
              {value.calendar_id && (
                <button
                  className="academic-button academic-cancel-button"
                  type="button"
                  onClick={reset}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </div>
        </fieldset>
      </form>
      <dialog ref={addDialog} className="academic-add-dialog">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setValue((current) => ({
              ...current,
              events: [
                ...current.events,
                { ...newEvent, title: newEvent.title.trim() },
              ],
            }));
            setSearch("");
            setEventType("All Event Types");
            setEventPage(Math.ceil((value.events.length + 1) / 5));
            addDialog.current.close();
          }}
        >
          <header>
            <h2>Add Event</h2>
            <button
              type="button"
              className="academic-button"
              aria-label="Close"
              onClick={() => addDialog.current.close()}
            >
              ×
            </button>
          </header>
          <label>
            Activity title
            <input
              autoFocus
              required
              maxLength={200}
              value={newEvent.title}
              onChange={(e) =>
                setNewEvent({ ...newEvent, title: e.target.value })
              }
            />
          </label>
          <div className="academic-add-dates">
            <label>
              Start date
              <input
                type="date"
                required
                value={newEvent.start_date}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, start_date: e.target.value })
                }
              />
            </label>
            <label>
              End date (optional)
              <input
                type="date"
                min={newEvent.start_date}
                value={newEvent.end_date}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, end_date: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              rows={4}
              maxLength={2000}
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
            />
          </label>
          <p className="academic-add-note">
            Save the calendar to publish your changes.
          </p>
          <footer>
            <button
              type="button"
              className="academic-button"
              onClick={() => addDialog.current.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="academic-button academic-save-button"
              disabled={
                busy || value.events.length >= 200 || !newEvent.title.trim()
              }
            >
              Add Event
            </button>
          </footer>
        </form>
      </dialog>
    </main>
  );
}
