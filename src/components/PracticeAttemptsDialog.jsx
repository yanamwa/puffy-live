import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ResultsPagination, { RESULTS_PER_PAGE } from "./students/ResultsPagination.jsx";
import "./students/RecentMainQuizResults.css";
import "./students/PracticeProgress.css";

const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric", minute: "2-digit", hour12: true,
});

export function formatPracticeScore({ score, total }) {
  return `${score}/${total} (${percentFormat.format(score / total)})`;
}

function AttemptTable({ attempts, recorded }) {
  const tableId = useId();
  const [selectedPage, setPage] = useState(1);
  if (!attempts.length) {
    return <p role="status">Individual score details are unavailable.</p>;
  }
  const pageCount = Math.ceil(attempts.length / RESULTS_PER_PAGE);
  const page = Math.min(selectedPage, pageCount);
  const start = (page - 1) * RESULTS_PER_PAGE;
  const labels = recorded ? ["entry", "entries"] : ["attempt", "attempts"];
  return (
    <>
      <p className="home-practice-attempts-count">
        Showing {start + 1}&ndash;{Math.min(start + RESULTS_PER_PAGE, attempts.length)} of{" "}
        {attempts.length} {attempts.length === 1 ? labels[0] : labels[1]} &middot; Latest first
      </p>
      <table id={tableId} className="home-practice-attempts-table">
        <thead>
          <tr>
            <th scope="col">{recorded ? "Entry" : "Attempt"}</th>
            <th scope="col">Score</th>
            <th scope="col">{recorded ? "Display date" : "Date & time"}</th>
          </tr>
        </thead>
        <tbody>
          {attempts.slice(start, start + RESULTS_PER_PAGE).map((attempt, index) => {
            const date = attempt.completedAt ? new Date(attempt.completedAt) : null;
            return (
              <tr key={attempt.id}>
                <th scope="row">
                  {attempt.number ?? attempts.length - start - index}
                  {attempt.moduleTitle && <small>{attempt.moduleTitle}</small>}
                </th>
                <td>{formatPracticeScore(attempt)}</td>
                <td>
                  {date && Number.isFinite(date.getTime()) ? (
                    <time dateTime={date.toISOString()}>
                      <span>{dateFormat.format(date)}</span>
                      <span className="home-practice-attempts-time">{timeFormat.format(date)}</span>
                    </time>
                  ) : "Unavailable"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ResultsPagination
        label="Practice attempts pagination"
        tableId={tableId}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </>
  );
}

export default function PracticeAttemptsDialog({
  heading, description, attempts, recorded = false, onClose, children,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
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

  return createPortal(
    <dialog
      ref={dialogRef}
      className="home-practice-attempts-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
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
        <h3>{heading}</h3>
        <p id={descriptionId}>{description}</p>
        {children}
        <AttemptTable key={recorded ? "recorded" : "submitted"} attempts={attempts} recorded={recorded} />
      </div>
    </dialog>,
    document.body,
  );
}
