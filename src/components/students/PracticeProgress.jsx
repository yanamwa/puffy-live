import { useCallback, useEffect, useId, useRef, useState } from "react";
import { API_BASE } from "../../config.js";
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import "./RecentMainQuizResults.css";
import "./PracticeProgress.css";

const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});
const changeFormat = new Intl.NumberFormat(undefined, {
  signDisplay: "always",
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const ATTEMPTS_PER_PAGE = 5;

function formatScore({ score, total }) {
  return `${score}/${total} (${percentFormat.format(score / total)})`;
}

function PracticeAttemptsModal({ record, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const tableId = useId();
  const [page, setPage] = useState(1);
  const { attempts, moduleTitle, courseTitle } = record;
  const pageCount = Math.ceil(attempts.length / ATTEMPTS_PER_PAGE);
  const start = (page - 1) * ATTEMPTS_PER_PAGE;
  const visibleAttempts = attempts.slice(start, start + ATTEMPTS_PER_PAGE);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="home-practice-attempts-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="home-practice-attempts-header">
        <h2 id={titleId}>Practice Attempts</h2>
        <button
          type="button"
          className="home-practice-attempts-close"
          aria-label="Close practice attempts"
          onClick={onClose}
          autoFocus
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </header>
      <div className="home-practice-attempts-body">
        <h3>{moduleTitle}</h3>
        <p id={descriptionId}>{courseTitle}</p>
        <p className="home-practice-attempts-count">
          Showing {start + 1}&ndash;
          {Math.min(start + ATTEMPTS_PER_PAGE, attempts.length)} of{" "}
          {attempts.length} attempts &middot; Latest first
        </p>
        <table id={tableId} className="home-practice-attempts-table">
          <thead>
            <tr>
              <th scope="col">Attempt</th>
              <th scope="col">Score</th>
              <th scope="col">Date &amp; time</th>
            </tr>
          </thead>
          <tbody>
            {visibleAttempts.map((attempt, index) => (
              <tr key={attempt.id}>
                <th scope="row">{attempts.length - start - index}</th>
                <td>{formatScore(attempt)}</td>
                <td>
                  {attempt.completedAt ? (
                    <time dateTime={attempt.completedAt}>
                      <span>
                        {dateFormat.format(new Date(attempt.completedAt))}
                      </span>
                      <span className="home-practice-attempts-time">
                        {timeFormat.format(new Date(attempt.completedAt))}
                      </span>
                    </time>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageCount > 1 && (
          <nav
            className="home-results-pagination home-practice-attempts-pagination"
            aria-label="Practice attempts pagination"
          >
            <button
              type="button"
              aria-controls={tableId}
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span role="status" aria-live="polite">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              aria-controls={tableId}
              disabled={page === pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </dialog>
  );
}

function PracticeProgressRow({ record, onViewAttempts }) {
  const { attempts, moduleTitle, courseTitle } = record;
  const latest = attempts[0];
  const first = attempts.at(-1);
  const change =
    ((latest.score * first.total - first.score * latest.total) * 100) /
    (latest.total * first.total);
  const hasMultipleAttempts = attempts.length > 1;
  const status = hasMultipleAttempts
    ? change
      ? `${changeFormat.format(change)} percentage ${Math.abs(change) === 1 ? "point" : "points"}`
      : "Same score"
    : "First attempt recorded";
  const outcome = change > 0 ? "higher" : change < 0 ? "lower" : "neutral";

  return (
    <tr>
      <td>
        <strong>{moduleTitle}</strong>
        <span>{courseTitle}</span>
        {hasMultipleAttempts && (
          <button
            type="button"
            className="home-results-view-all"
            aria-haspopup="dialog"
            aria-label={`View all attempts for ${moduleTitle}`}
            onClick={() => onViewAttempts(record)}
          >
            View all attempts
          </button>
        )}
      </td>
      <td className="home-results-score">{formatScore(first)}</td>
      <td className="home-results-score">
        {hasMultipleAttempts ? formatScore(latest) : "—"}
      </td>
      <td>
        <span className={`home-results-outcome ${outcome}`}>{status}</span>
      </td>
    </tr>
  );
}

export default function PracticeProgress() {
  const [revision, setRevision] = useState(0);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const closeAttempts = useCallback(() => setSelectedRecord(null), []);

  useEffect(() => {
    const controller = new AbortController();
    const fallback = "Could not load practice progress.";

    async function loadProgress() {
      try {
        const response = await fetch(`${API_BASE}/lessons/practice/history`, {
          credentials: "include",
          headers: lessonAuthHeaders(),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.records))
          throw new Error(data?.message || fallback);
        if (!controller.signal.aborted) setRecords(data.records);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message || fallback);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProgress();
    return () => controller.abort();
  }, [revision]);

  function retry() {
    setError("");
    setLoading(true);
    setRevision((current) => current + 1);
  }

  return (
    <section
      className="home-section home-recent-quiz-results home-practice-progress"
      aria-labelledby="practice-progress-title"
    >
      <div className="home-section-header">
        <h2 id="practice-progress-title">Practice Progress</h2>
      </div>
      {loading ? (
        <p className="home-results-empty" role="status">
          Loading practice progress.
        </p>
      ) : error ? (
        <p className="home-results-empty" role="alert">
          {error}{" "}
          <button
            type="button"
            className="home-results-view-all"
            onClick={retry}
          >
            Retry
          </button>
        </p>
      ) : !records.length ? (
        <p className="home-results-empty">
          Your completed practice attempts will appear here.
        </p>
      ) : (
        <div className="home-results-table-wrap">
          <table
            className="home-results-table"
            aria-labelledby="practice-progress-title"
          >
            <thead>
              <tr>
                <th scope="col">Module</th>
                <th scope="col">First practice</th>
                <th scope="col">Latest practice</th>
                <th scope="col">Score change</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <PracticeProgressRow
                  key={`${record.courseId}:${record.moduleId}`}
                  record={record}
                  onViewAttempts={setSelectedRecord}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedRecord && (
        <PracticeAttemptsModal
          record={selectedRecord}
          onClose={closeAttempts}
        />
      )}
    </section>
  );
}
