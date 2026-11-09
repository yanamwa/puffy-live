import { useEffect, useState } from "react";
import { API_BASE } from "../../config.js";
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import { useStudentTutorial } from "../../pages/student/tutorial/StudentTutorialContext.js";
import { tutorialQuizResults } from "../../pages/student/tutorial/studentTutorialExamples.js";
import "./RecentMainQuizResults.css";
export default function RecentMainQuizResults() {
  const tutorial = useStudentTutorial();
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(() => ({ records: tutorial ? tutorialQuizResults : [] }));
  const [loading, setLoading] = useState(!tutorial);
  const [error, setError] = useState("");
  const page = 1;
  const pageSize = 5;
  useEffect(() => {
    if (tutorial) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `${API_BASE}/lessons/main-quiz/history?${new URLSearchParams({ page, pageSize })}`,
      { headers: lessonAuthHeaders(), signal: controller.signal },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || result.success === false)
          throw new Error(result.message || "Could not load quiz results.");
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, revision, tutorial]);
  return (
    <section
      className="home-section home-recent-quiz-results"
      aria-labelledby="recent-main-quiz-title"
    >
      <div className="home-section-header">
        <h2 id="recent-main-quiz-title">Recent Main Quiz Results</h2>
      </div>
      {loading ? (
        <p role="status">Loading quiz results…</p>
      ) : error ? (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRevision((r) => r + 1)}>
            Retry
          </button>
        </p>
      ) : !data.records.length ? (
        <p className="home-results-empty">
          No Main Quiz results yet. Your completed quizzes will appear here.
        </p>
      ) : (
        <>
          <div className="home-results-table-wrap">
            <table className="home-results-table">
              <thead>
                <tr>
                  <th scope="col">Module / Main Quiz</th>
                  <th scope="col">Score</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.records.slice(0, 5).map((record) => (
                  <tr key={record.result_id}>
                    <td>
                      <strong>{record.module_title || record.quiz_title?.replace(/\s*—\s*Main Quiz$/, "") || "Module Main Quiz"}</strong>
                      <span>{record.course_title} · Main Quiz</span>
                    </td>
                    <td className="home-results-score">
                      {record.score}/{record.total}
                    </td>
                    <td>
                      <span
                        className={`home-results-outcome ${record.passed ? "passed" : "failed"}`}
                      >
                        <span aria-hidden="true">
                          {record.passed ? "✓" : "×"}
                        </span>
                        {record.passed ? "Passed" : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
