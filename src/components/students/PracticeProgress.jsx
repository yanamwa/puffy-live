import { useEffect, useState } from "react";
import { API_BASE } from "../../config.js";
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import "./RecentMainQuizResults.css";

const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});
const changeFormat = new Intl.NumberFormat(undefined, {
  signDisplay: "always",
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function formatScore({ score, total }) {
  return `${score}/${total} (${percentFormat.format(score / total)})`;
}

function PracticeProgressRow({ record }) {
  const [expanded, setExpanded] = useState(false);
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
    <>
      <tr>
        <td>
          <strong>{moduleTitle}</strong>
          <span>{courseTitle}</span>
          {hasMultipleAttempts && (
            <button
              type="button"
              className="home-results-view-all"
              aria-expanded={expanded}
              aria-label={`${expanded ? "Hide" : "View all"} attempts for ${moduleTitle}`}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide attempts" : "View all attempts"}
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
      {expanded && (
        <tr className="home-practice-history-row">
          <td colSpan={4}>
            <ol reversed aria-label={`Practice attempts for ${moduleTitle}`}>
              {attempts.map((attempt) => (
                <li key={attempt.id}>
                  <b>{formatScore(attempt)}</b>
                  {attempt.completedAt && (
                    <time dateTime={attempt.completedAt}>
                      {dateFormat.format(new Date(attempt.completedAt))}
                    </time>
                  )}
                </li>
              ))}
            </ol>
          </td>
        </tr>
      )}
    </>
  );
}

export default function PracticeProgress() {
  const [revision, setRevision] = useState(0);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
