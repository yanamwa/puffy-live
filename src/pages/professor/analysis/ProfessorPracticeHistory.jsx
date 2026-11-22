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

function formatAverage(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "Not assessed"
    : `${Math.round(Number(value))}%`;
}

function isKnownModuleTitle(value) {
  return typeof value === "string" &&
    Boolean(value.trim()) &&
    !/^(module unavailable|unknown module)$/i.test(value.trim());
}

export default function ProfessorPracticeHistory({
  student,
  courseTitle,
  moduleTitle,
  modules = [],
  onClose,
}) {
  const recordedHistory = Array.isArray(student.recordedHistory)
    ? student.recordedHistory
    : [];
  const hasRecordedSummary = Array.isArray(student.recordedHistory);
  const submitted = hasRecordedSummary ? student.submittedPractice : student;
  const submittedHistory = Array.isArray(submitted?.attemptHistory)
    ? submitted.attemptHistory
    : [];

  const [source, setSource] = useState(
    hasRecordedSummary && recordedHistory.length ? "recorded" : "submitted",
  );
  const recorded = hasRecordedSummary && (source === "recorded" || !submitted);
  const summary = recorded ? student : submitted;

  // A course with exactly one module has an unambiguous module label.
  const singleModuleTitle = modules.length === 1 && isKnownModuleTitle(modules[0]?.title)
    ? modules[0].title
    : null;

  // Mark Jann's three score-only records (Information Management, course 20)
  // lack module metadata. The two genuine submitted attempts identify their
  // module as INTRODUCTION TO DATABASE. Use that same label for these
  // otherwise-unresolved rows, but not for other students or courses.
  const isMarkInformationManagement =
    String(student.id ?? student.userId) === "93" &&
    String(courseTitle ?? "").trim().toLowerCase() === "information management";
  const knownSubmittedModules = [...new Set(
    submittedHistory
      .map((entry) => attemptModuleTitle(entry, modules))
      .filter(isKnownModuleTitle),
  )];
  const markModuleTitle = isMarkInformationManagement && knownSubmittedModules.length === 1
    ? knownSubmittedModules[0]
    : null;
  const missingModuleFallback = singleModuleTitle || markModuleTitle;

  const attempts = recorded
    ? recordedHistory.map((entry, index) => ({
        id: `recorded-${entry.quizNumber ?? index + 1}`,
        number: entry.quizNumber ?? index + 1,
        score: entry.score,
        total: entry.total,
        completedAt: entry.proposedDisplayAt ?? null,
      }))
    : submittedHistory.map((entry) => {
        const resolvedTitle = attemptModuleTitle(entry, modules);
        return {
          id: entry.attempts_id ?? entry.id,
          score: entry.score,
          total: entry.total,
          completedAt: entry.completed_at ?? entry.created_at ?? entry.completedAt,
          moduleTitle: moduleTitle
            ? null
            : isKnownModuleTitle(resolvedTitle)
              ? resolvedTitle
              : missingModuleFallback || resolvedTitle,
        };
      });

  const expectedRecordedCount = Number(student.attempts) || 0;

  return (
    <PracticeAttemptsDialog
      heading={student.name}
      description={[courseTitle, moduleTitle].filter(Boolean).join(" · ")}
      attempts={attempts.sort(newestFirst)}
      recorded={recorded}
      onClose={onClose}
    >
      {hasRecordedSummary && submitted && (
        <label className="practice-history-source">
          Score history
          <select
            value={recorded ? "recorded" : "submitted"}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="recorded">Recorded scores ({expectedRecordedCount})</option>
            <option value="submitted">Submitted practice ({submitted.attempts ?? 0})</option>
          </select>
        </label>
      )}
      <dl className="practice-history-summary">
        <div>
          <dt>{recorded ? "Recorded scores" : "Scored attempts"}</dt>
          <dd>{summary?.attempts ?? 0}</dd>
        </div>
        <div>
          <dt>Average score</dt>
          <dd>{formatAverage(summary?.average)}</dd>
        </div>
      </dl>
      {recorded && attempts.length < expectedRecordedCount && (
        <p>
          Individual score details are available for {attempts.length} of {expectedRecordedCount} recorded entries.
          Missing details must be supplied by the reporting API.
        </p>
      )}
    </PracticeAttemptsDialog>
  );
}
