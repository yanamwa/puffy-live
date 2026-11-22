import { useCallback, useEffect, useId, useState } from "react";
import { API_BASE } from "../../config.js";
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import PracticeAttemptsDialog, { formatPracticeScore } from "../PracticeAttemptsDialog.jsx";
import ResultsPagination, { RESULTS_PER_PAGE } from "./ResultsPagination.jsx";
import "./RecentMainQuizResults.css";

const changeFormat = new Intl.NumberFormat(undefined, {
  signDisplay: "always",
  maximumFractionDigits: 1,
});

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
      <td className="home-results-score">{formatPracticeScore(first)}</td>
      <td className="home-results-score">
        {hasMultipleAttempts ? formatPracticeScore(latest) : "-"}
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
  const [page, setPage] = useState(1);
  const tableId = useId();
  const pageCount = Math.ceil(records.length / RESULTS_PER_PAGE);
  const start = (page - 1) * RESULTS_PER_PAGE;
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
        if (!controller.signal.aborted) {
          setRecords(
            data.records.filter((record) => record.moduleId !== "all-modules"),
          );
        }
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
          Your completed module practice attempts will appear here.
        </p>
      ) : (
        <div className="home-results-table-wrap">
          <table
            id={tableId}
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
              {records.slice(start, start + RESULTS_PER_PAGE).map((record) => (
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
      <ResultsPagination
        label="Practice progress pagination"
        tableId={tableId}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
      />
      {selectedRecord && (
        <PracticeAttemptsDialog
          heading={selectedRecord.moduleTitle}
          description={selectedRecord.courseTitle}
          attempts={selectedRecord.attempts}
          onClose={closeAttempts}
        />
      )}
    </section>
  );
}
