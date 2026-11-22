import PracticeAttemptsDialog from "../../../components/PracticeAttemptsDialog.jsx";

function newestFirst(a, b) {
  const dateA = Date.parse(a.completedAt);
  const dateB = Date.parse(b.completedAt);
  if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA;
  if (Number.isFinite(dateA) !== Number.isFinite(dateB)) return Number.isFinite(dateA) ? -1 : 1;
  return Number(b.id) - Number(a.id) || 0;
}

export function formatPracticeAverage(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "Not assessed"
    : `${Math.round(Number(value))}%`;
}

export function practiceHistoryEntries(history) {
  return history.map((entry) => ({
    id: entry.attempts_id ?? entry.id,
    score: entry.score,
    total: entry.total,
    completedAt: entry.completed_at ?? entry.created_at ?? entry.completedAt,
  })).sort(newestFirst);
}

export default function ProfessorPracticeHistory({ student, onClose }) {
  return (
    <PracticeAttemptsDialog
      heading={student.name}
      description={student.moduleTitle}
      attempts={practiceHistoryEntries(student.attemptHistory)}
      onClose={onClose}
    >
      <dl className="practice-history-summary">
        <div>
          <dt>Practice attempts</dt>
          <dd>{student.attempts}</dd>
        </div>
        <div>
          <dt>Average score</dt>
          <dd>{formatPracticeAverage(student.average)}</dd>
        </div>
      </dl>
    </PracticeAttemptsDialog>
  );
}
