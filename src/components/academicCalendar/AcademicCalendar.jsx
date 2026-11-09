import {
  calendarDateKey,
  eventsOnDate,
} from "../../services/academicCalendarDates.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { academicCalendarRequest } from "../../services/academicCalendarApi.js";
import "./academicCalendar.css";
export function useAcademicCalendars({ enabled = true } = {}) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setError("");
    setLoading(true);
    academicCalendarRequest("", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setRecords(data.records);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, revision]);
  return { records, loading, error, reload };
}
export function CalendarDocument({ calendar }) {
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [documentIndex, setDocumentIndex] = useState(0);
  useEffect(() => setDocumentIndex(0), [calendar.calendar_id]);
  const documents = calendar.documents || [
    {
      file_index: 0,
      filename: calendar.filename,
      mime_type: calendar.mime_type,
    },
  ];
  const selectedDocument =
    documents.find((item) => item.file_index === documentIndex) || documents[0];
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const controller = new AbortController();
    let objectUrl = "";
    setError("");
    setUrl("");
    academicCalendarRequest(
      `/${calendar.calendar_id}/file?index=${documentIndex}`,
      {
        document: true,
        signal: controller.signal,
      },
    )
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, calendar.calendar_id, calendar.updated_at, documentIndex]);
  return (
    <>
      <button
        type="button"
        className="academic-button"
        onClick={() => setOpen(true)}
      >
        View official calendar
      </button>
      <dialog
        className="academic-document-dialog"
        ref={dialog}
        onClose={() => setOpen(false)}
      >
        <header>
          <h2>
            {calendar.title} · {calendar.academic_year}
          </h2>
          <button
            type="button"
            className="academic-button"
            onClick={() => dialog.current.close()}
          >
            Close
          </button>
        </header>
        {documents.length > 1 && (
          <label>
            Document
            <select
              value={documentIndex}
              onChange={(e) => setDocumentIndex(Number(e.target.value))}
            >
              {documents.map((item) => (
                <option value={item.file_index} key={item.file_index}>
                  {item.filename}
                </option>
              ))}
            </select>
          </label>
        )}
        {error ? (
          <p role="alert">{error}</p>
        ) : url ? (
          <>
            <a href={url} target="_blank" rel="noreferrer">
              Open document in a new tab
            </a>
            {selectedDocument?.mime_type === "application/pdf" ? (
              <iframe src={url} title={calendar.title} />
            ) : (
              <img src={url} alt={calendar.title} />
            )}
          </>
        ) : (
          <p role="status">Loading calendar…</p>
        )}
      </dialog>
    </>
  );
}
export function StudentAcademicCalendar({
  selected,
  date,
  error,
  loading,
  onRetry,
}) {
  const events = eventsOnDate(selected?.events, calendarDateKey(date));
  return (
    <div className="student-academic-calendar">
      {error ? (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </p>
      ) : loading ? (
        <p role="status">Loading academic calendar…</p>
      ) : !selected ? (
        <p>No academic calendar published yet.</p>
      ) : (
        <>
          <section className="academic-day-events" aria-live="polite">
            <h4>
              {date.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h4>
            {events.length ? (
              events.map((event, index) => (
                <article key={index} className="academic-student-event">
                  <strong>{event.title}</strong>
                  {event.end_date > event.start_date && (
                    <small>
                      {event.start_date} — {event.end_date}
                    </small>
                  )}
                  {event.description && <p>{event.description}</p>}
                </article>
              ))
            ) : (
              <p>No academic events on this date.</p>
            )}
          </section>
          {selected.filename && <CalendarDocument calendar={selected} />}
        </>
      )}
    </div>
  );
}

export function CalendarInlinePreview({ file, calendar, index = 0 }) {
  const [preview, setPreview] = useState({ url: "", error: "" });
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    setPreview({ url: "", error: "" });
    if (file) {
      url = URL.createObjectURL(file);
      setPreview({ url, error: "" });
    } else if (calendar.calendar_id && calendar.filename) {
      academicCalendarRequest(`/${calendar.calendar_id}/file?index=${index}`, {
        document: true,
        signal: controller.signal,
      })
        .then((blob) => {
          if (controller.signal.aborted) return;
          url = URL.createObjectURL(blob);
          setPreview({ url, error: "" });
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setPreview({ url: "", error: e.message });
        });
    }
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    file,
    calendar.calendar_id,
    calendar.filename,
    calendar.updated_at,
    index,
  ]);
  if (!file && !calendar.filename)
    return (
      <div className="academic-inline-placeholder">
        Attach the official calendar to preview it beside the dates.
      </div>
    );
  const isPdf = file
    ? /\.pdf$/i.test(file.name)
    : calendar.mime_type === "application/pdf";
  return (
    <div className="academic-inline-preview">
      <h3>Official calendar</h3>
      {preview.error ? (
        <p role="alert">{preview.error}</p>
      ) : !preview.url ? (
        <p role="status">Loading document…</p>
      ) : (
        <>
          <a href={preview.url} target="_blank" rel="noreferrer">
            Open full size ↗
          </a>
          {isPdf ? (
            <iframe
              src={preview.url}
              title="Official academic calendar preview"
            />
          ) : (
            <a href={preview.url} target="_blank" rel="noreferrer">
              <img src={preview.url} alt="Official academic calendar" />
            </a>
          )}
        </>
      )}
    </div>
  );
}
