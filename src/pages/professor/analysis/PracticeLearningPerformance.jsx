import { Fragment, useId, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCheckCircle,
  FiChevronRight,
  FiCircle,
  FiFlag,
} from "react-icons/fi";
import ResultsPagination from "../../../components/students/ResultsPagination.jsx";
import {
  practiceReviewCriteria,
  summarizePracticeLearning,
} from "../../../utils/practiceLearningPerformance.js";
import { AssessmentReportTable } from "./ProfessorStudentPerformance.jsx";
import styles from "./PracticeLearningPerformance.module.css";

const statuses = {
  review: {
    label: "Needs Review",
    description: "Students are struggling with the topic.",
    icon: FiFlag,
  },
  insufficient: {
    label: "Not Enough Data",
    description: "Too few students or responses to evaluate reliably.",
    icon: FiCircle,
  },
  onTrack: {
    label: "On Track",
    description: "Class performance meets the expected threshold.",
    icon: FiCheckCircle,
  },
};
const threshold = practiceReviewCriteria.accuracy;
const percent = (value) =>
  value == null ? "No data" : `${Number(value.toFixed(1))}%`;
const accuracy = (value) =>
  value != null && value < threshold && Number(value.toFixed(1)) === threshold
    ? `<${threshold}%`
    : percent(value);
const count = (value, noun) => `${value} ${noun}${value === 1 ? "" : "s"}`;
const sample = (row) =>
  `${count(row.students, "student")} · ${count(row.responses, "response")}`;

function StatusBadge({ status }) {
  const { label, icon: Icon } = statuses[status];
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}

function AccuracyBar({ value }) {
  return (
    <span className={styles.track} aria-hidden="true">
      <span style={{ width: `${value ?? 0}%` }} />
    </span>
  );
}

function LevelList({ rows }) {
  return (
    <ul className={styles.levels}>
      {rows.map((row) => (
        <li key={JSON.stringify([row.label, row.skill])}>
          <div className={styles.levelHeading}>
            <span>
              {row.label}
              {row.skill && (
                <small className={styles.skillTag}>{row.skill}</small>
              )}
            </span>
            <strong>{accuracy(row.accuracy)}</strong>
          </div>
          {row.responses > 0 && (
            <>
              <AccuracyBar value={row.accuracy} />
              <small>
                {sample(row)}
                {row.skill && ` · ${count(row.questions, "question")}`}
              </small>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function TopicDetails({ topic }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const evidenceId = useId();
  return (
    <div className={styles.breakdown}>
      <h5>Performance by cognitive level</h5>
      <LevelList rows={topic.levels} />
      <button
        type="button"
        className={styles.evidenceButton}
        aria-expanded={showEvidence}
        aria-controls={evidenceId}
        onClick={() => setShowEvidence(!showEvidence)}
      >
        <FiBookOpen aria-hidden="true" />
        {showEvidence ? "Hide question evidence" : "View question evidence"}
      </button>
      <div id={evidenceId} hidden={!showEvidence} className={styles.evidence}>
        {showEvidence && (
          <AssessmentReportTable
            columns={[
              "Practice question",
              "Cognitive level",
              "Thinking skill",
              "Students",
              "Responses",
              "Correct",
            ]}
            rows={topic.evidence.map((q) => ({
              key: q.key,
              cells: [
                q.text,
                q.level,
                q.skill,
                q.students,
                q.responses,
                q.correct,
              ],
            }))}
            pageKey={topic.key}
            hideSinglePageNavigation
            empty="No question evidence is available."
          />
        )}
      </div>
    </div>
  );
}

function TopicRow({ topic, showModule, table, expanded, onToggle }) {
  const detailId = useId();
  const toggle = (
    <button
      type="button"
      className={styles.topicToggle}
      aria-expanded={expanded}
      aria-controls={detailId}
      onClick={onToggle}
    >
      <FiChevronRight aria-hidden="true" />
      <span>
        <strong>{topic.label}</strong>
        {showModule && <small>{topic.moduleTitle}</small>}
      </span>
      {!table && (
        <b className={styles.topicScore}>{accuracy(topic.accuracy)}</b>
      )}
    </button>
  );
  const details = (
    <div id={detailId} hidden={!expanded}>
      {expanded && <TopicDetails topic={topic} />}
    </div>
  );
  if (table)
    return (
      <Fragment>
        <tr>
          <th scope="row">{toggle}</th>
          <td>{accuracy(topic.accuracy)}</td>
          <td>{topic.students}</td>
          <td>{topic.responses}</td>
          <td>{percent(topic.below)}</td>
          <td>
            <StatusBadge status={topic.status} />
          </td>
        </tr>
        <tr hidden={!expanded}>
          <td colSpan={6}>{details}</td>
        </tr>
      </Fragment>
    );
  return (
    <article className={styles.topicCard} data-expanded={expanded}>
      {toggle}
      <div className={styles.topicSummary}>
        <AccuracyBar value={topic.accuracy} />
        <div className={styles.topicMeta}>
          <small>
            {sample(topic)} · {percent(topic.below)} of students below{" "}
            {threshold}%
          </small>
          <StatusBadge status={topic.status} />
        </div>
      </div>
      {details}
    </article>
  );
}

function TopicResults({ topics, showModule, table }) {
  const [openKey, setOpenKey] = useState(topics[0]?.key);
  const [selectedPage, setPage] = useState(1);
  const listId = useId();
  const pageSize = 10;
  const pageCount = Math.ceil(topics.length / pageSize);
  const page = Math.min(selectedPage, pageCount);
  const rows = topics
    .slice((page - 1) * pageSize, page * pageSize)
    .map((topic) => (
      <TopicRow
        key={topic.key}
        topic={topic}
        showModule={showModule}
        table={table}
        expanded={openKey === topic.key}
        onToggle={() => setOpenKey(openKey === topic.key ? null : topic.key)}
      />
    ));
  return (
    <>
      {table ? (
        <div
          id={listId}
          className={styles.tableScroll}
          tabIndex={0}
          role="region"
          aria-label="Topic performance table"
        >
          <table>
            <thead>
              <tr>
                {[
                  "Topic",
                  "Class accuracy",
                  "Students",
                  "Responses",
                  `Students below ${threshold}%`,
                  "Status",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      ) : (
        <div id={listId} className={styles.topics}>
          {rows}
        </div>
      )}
      <ResultsPagination
        label="Topic performance pages"
        tableId={listId}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </>
  );
}

function ThinkingPerformance({ report, table }) {
  const [lots, hots, ...other] = report.skills;
  const classified = lots.responses + hots.responses;
  const share = (row) =>
    classified ? (100 * row.responses) / classified : null;
  const unclassified = other.reduce((total, row) => total + row.responses, 0);
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h3 id={titleId}>Performance by Thinking Skill and Cognitive Level</h3>
      <div className={styles.charts} data-table={table}>
        <section className={styles.chartCard}>
          <h4>Question Mix Served in Practice</h4>
          {table ? (
            <AssessmentReportTable
              columns={[
                "Thinking skill",
                "Share served",
                "Class accuracy",
                "Students",
                "Responses",
              ]}
              rows={report.skills.map((row) => ({
                key: row.label,
                cells: [
                  row.label,
                  row === lots || row === hots ? percent(share(row)) : "—",
                  accuracy(row.accuracy),
                  row.students,
                  row.responses,
                ],
              }))}
              hideSinglePageNavigation
            />
          ) : (
            <div className={styles.mix}>
              <div
                className={styles.donut}
                role="img"
                aria-label={`${count(classified, "classified question appearance")}`}
                data-classified={classified > 0}
                style={{ "--lots-share": `${share(lots) ?? 0}%` }}
              >
                <span>
                  <b>{classified}</b>
                  <small>classified</small>
                </span>
              </div>
              <dl className={styles.mixLegend}>
                {[lots, hots].map((row) => (
                  <div key={row.label}>
                    <dt>
                      <i data-skill={row.label} />
                      <abbr
                        title={
                          row === lots
                            ? "Lower-order thinking skills"
                            : "Higher-order thinking skills"
                        }
                      >
                        {row.label}
                      </abbr>
                    </dt>
                    <dd>{percent(share(row))}</dd>
                    <dd className={styles.mixAccuracy}>
                      {row.responses
                        ? `${accuracy(row.accuracy)} class accuracy`
                        : "No scored responses"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p className={styles.note}>
            Each scored appearance of a LOTS or HOTS question counts toward the
            mix.
          </p>
          {unclassified > 0 && (
            <p className={styles.note}>
              {count(unclassified, "response")} without a recorded thinking
              skill.
            </p>
          )}
        </section>
        <section className={styles.chartCard}>
          <h4>Accuracy by Bloom’s Level</h4>
          {table ? (
            <AssessmentReportTable
              columns={[
                "Cognitive level",
                "Class accuracy",
                "Students",
                "Responses",
              ]}
              rows={report.levels.map((row) => ({
                key: row.label,
                cells: [
                  row.label,
                  accuracy(row.accuracy),
                  row.students,
                  row.responses,
                ],
              }))}
              hideSinglePageNavigation
            />
          ) : (
            <LevelList rows={report.levels} />
          )}
        </section>
      </div>
    </section>
  );
}

export default function PracticeLearningPerformance({
  attempts,
  modules,
  items,
  showModule,
  view,
  attemptScope,
  onAttemptScopeChange,
}) {
  const report = useMemo(
    () =>
      summarizePracticeLearning(
        attempts,
        modules,
        items,
        attemptScope === "first",
      ),
    [attempts, modules, items, attemptScope],
  );
  const titleId = useId();
  const priority = report.topics
    .filter((topic) => topic.status === "review")
    .slice(0, 3);
  return (
    <div className={styles.report}>
      <section className={styles.section} aria-labelledby={titleId}>
        <header className={styles.heading}>
          <div>
            <h3 id={titleId}>Topic Performance Summary</h3>
            <p className={styles.note}>
              Class accuracy gives each participating student equal weight.
            </p>
          </div>
          <div
            className={styles.switch}
            role="group"
            aria-label="Attempts included in topic and thinking-skill results"
          >
            {[
              ["all", "All attempts"],
              ["first", "First attempts"],
            ].map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                aria-pressed={attemptScope === scope}
                onClick={() => onAttemptScopeChange(scope)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        {attemptScope === "first" && (
          <p className={styles.scopeNote}>
            Showing each student’s first scored Practice attempt per module.
            {report.unlinkedAttempts > 0 &&
              ` Excluded ${count(report.unlinkedAttempts, "attempt")} without a module link.`}
          </p>
        )}
        {report.topics.length > 0 ? (
          <>
            <div className={styles.reviewFirst}>
              <FiBookOpen aria-hidden="true" />
              <div>
                <strong>Review first</strong>
                <div className={styles.priority}>
                  {priority.length
                    ? priority.map((topic) => (
                        <span key={topic.key}>
                          {topic.label}
                          {showModule &&
                          report.topics.some(
                            (other) =>
                              other.key !== topic.key &&
                              other.label === topic.label,
                          )
                            ? ` (${topic.moduleTitle})`
                            : ""}{" "}
                          · {accuracy(topic.accuracy)}
                        </span>
                      ))
                    : report.topics.every(
                          (topic) => topic.status === "insufficient",
                        )
                      ? "More students or responses are needed to identify a class review topic."
                      : "No topics meet the review criteria in this selection."}
                </div>
                <p className={styles.note}>
                  Adaptive Practice can revisit missed concepts, so a topic may
                  receive more responses.
                </p>
              </div>
            </div>
            <TopicResults
              key={attemptScope}
              topics={report.topics}
              showModule={showModule}
              table={view === "table"}
            />
          </>
        ) : (
          <p className={styles.empty}>
            No scored question responses are available for this selection.
          </p>
        )}
        <ul className={styles.guide} aria-label="Topic status guide">
          {Object.entries(statuses).map(([status, { description }]) => (
            <li key={status}>
              <StatusBadge status={status} />
              <span>{description}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Topics need at least {practiceReviewCriteria.minStudents} students and{" "}
          {practiceReviewCriteria.minResponses} scored responses for a class
          rating. The review threshold is {threshold}% class accuracy.
        </p>
      </section>
      <ThinkingPerformance report={report} table={view === "table"} />
    </div>
  );
}
