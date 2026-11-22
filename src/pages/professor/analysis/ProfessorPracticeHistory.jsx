import PracticeAttemptsDialog from "../../../components/PracticeAttemptsDialog.jsx";

function newestFirst(a, b) {
  const dateA = Date.parse(a.completedAt);
  const dateB = Date.parse(b.completedAt);
  if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA;
  if (Number.isFinite(dateA) !== Number.isFinite(dateB)) return Number.isFinite(dateA) ? -1 : 1;
  return Number(b.number ?? b.id) - Number(a.number ?? a.id) || 0;
}

function formatAverage(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "Not assessed"
    : `${Math.round(Number(value))}%`;
}

export default function ProfessorPracticeHistory({ student, onClose }) {
  const recorded = Array.isArray(student.recordedHistory);
  const attempts = recorded
    ? student.recordedHistory.map((entry, index) => ({
        id: `recorded-${entry.quizNumber ?? index + 1}`,
        number: entry.quizNumber ?? index + 1,
        score: entry.score,
        total: entry.total,
        completedAt: entry.proposedDisplayAt ?? null,
      }))
    : student.attemptHistory.map((entry) => ({
        id: entry.attempts_id ?? entry.id,
        score: entry.score,
        total: entry.total,
        completedAt: entry.completed_at ?? entry.created_at ?? entry.completedAt,
      }));

  return (
    <PracticeAttemptsDialog
      heading={student.name}
      description={student.moduleTitle}
      attempts={attempts.sort(newestFirst)}
      recorded={recorded}
      onClose={onClose}
    >
      <dl className="practice-history-summary">
        <div>
          <dt>{recorded ? "Recorded scores" : "Practice attempts"}</dt>
          <dd>{student.attempts}</dd>
        </div>
        <div>
          <dt>Average score</dt>
          <dd>{formatAverage(student.average)}</dd>
        </div>
      </dl>
      {recorded && attempts.length > 0 && attempts.length < student.attempts && (
        <p>
          Scores are available for {attempts.length} of {student.attempts} recorded entries.
        </p>
      )}
    </PracticeAttemptsDialog>
  );
}
