import { useState } from "react";
import PracticeAttemptsDialog from "../../../components/PracticeAttemptsDialog.jsx";
import { attemptModuleTitle } from "../../../utils/assessmentModuleScope.js";

function newestFirst(a, b) {
  const dateA = Date.parse(a.completedAt);
  const dateB = Date.parse(b.completedAt);
  if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA;
  if (Number.isFinite(dateA) !== Number.isFinite(dateB)) return Number.isFinite(dateA) ? -1 : 1;
  return Number(b.number ?? b.id) - Number(a.number ?? a.id) || 0;
}

export default function ProfessorPracticeHistory({ student, courseTitle, moduleTitle, modules, onClose }) {
  const hasRecorded = Array.isArray(student.recordedHistory);
  const submitted = hasRecorded ? student.submittedPractice : student;
  const [source, setSource] = useState(hasRecorded && student.recordedHistory.length ? "recorded" : "submitted");
  const recorded = hasRecorded && (source === "recorded" || !submitted);
  const summary = recorded ? student : submitted;
  const attempts = recorded
    ? student.recordedHistory.map((entry, index) => ({
        id: `recorded-${entry.quizNumber}-${index}`,
        number: entry.quizNumber,
        score: entry.score,
        total: entry.total,
        completedAt: entry.proposedDisplayAt,
      }))
    : summary.attemptHistory.map((entry) => ({
        id: entry.attempts_id ?? entry.id,
        score: entry.score,
        total: entry.total,
        completedAt: entry.completed_at ?? entry.created_at,
        moduleTitle: moduleTitle ? null : attemptModuleTitle(entry, modules),
      }));

  return (
    <PracticeAttemptsDialog
      heading={student.name}
      description={[courseTitle, moduleTitle].filter(Boolean).join(" · ")}
      attempts={attempts.sort(newestFirst)}
      recorded={recorded}
      onClose={onClose}
    >
      {hasRecorded && submitted && (
        <label className="practice-history-source">
          Score history
          <select value={recorded ? "recorded" : "submitted"} onChange={(event) => setSource(event.target.value)}>
            <option value="recorded">Recorded scores ({student.attempts})</option>
            <option value="submitted">Submitted practice ({submitted.attempts})</option>
          </select>
        </label>
      )}
      <dl className="practice-history-summary">
        <div><dt>{recorded ? "Recorded scores" : "Scored attempts"}</dt><dd>{summary.attempts}</dd></div>
        <div><dt>Average score</dt><dd>{Math.round(summary.average)}%</dd></div>
      </dl>
      {recorded && attempts.length > 0 && attempts.length < summary.attempts && (
        <p>Individual scores are available for {attempts.length} of {summary.attempts} entries.</p>
      )}
    </PracticeAttemptsDialog>
  );
}
