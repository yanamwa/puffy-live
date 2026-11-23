import { Fragment, useId, useMemo, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
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
  },
  insufficient: {
    label: "Not Enough Data",
    description: "Too few students or responses to evaluate reliably.",
  },
  onTrack: {
    label: "On Track",
    description: "Class performance meets the expected threshold.",
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

function TopicStatus({ status }) {
  return (
    <span className={`${styles.status} ${styles[status]}`}>
      {statuses[status].label}
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
        {showModule &&
          topic.moduleTitle.trim().toLowerCase() !==
            topic.label.trim().toLowerCase() && (
            <small>{topic.moduleTitle}</small>
          )}
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
            <TopicStatus status={topic.status} />
          </td>
        </tr>
        <tr hidden={!expanded}>
          <td colSpan={6}>{details}</td>
        </tr>
      </Fragment>
    );
  return (
    <article className={styles.topicRow}>
      {toggle}
      <div>
        <AccuracyBar value={topic.accuracy} />
        <div className={styles.topicMeta}>
          <small>
            {sample(topic)} · {percent(topic.below)} of students below{" "}
            {threshold}%
          </small>
          <TopicStatus status={topic.status} />
        </div>
      </div>
      {details}
    </article>
  );
}

function TopicResults({ topics, showModule, table }) {
  const [openKey, setOpenKey] = useState(null);
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
        <div id={listId}>{rows}</div>
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
  const [lots, hots] = report.skills;
  const classified = lots.responses + hots.responses;
  const share = (row) =>
    classified ? (100 * row.responses) / classified : null;
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.sectionHeading}>
        Performance by Thinking Skill and Cognitive Level
      </h3>
      <p className={styles.intro}>
        <strong>LOTS</strong> means Lower-Order Thinking Skills.{" "}
        <strong>HOTS</strong> means Higher-Order Thinking Skills.
      </p>
      <div className={styles.charts} data-table={table}>
        <section className={styles.chartCard}>
          <h4 className={styles.mixTitle}>Question Mix Served in Practice</h4>
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
            <figure className={styles.mix}>
              <div
                className={styles.donut}
                role="img"
                aria-label={
                  classified
                    ? `${count(classified, "classified response")}, LOTS ${percent(share(lots))}, HOTS ${percent(share(hots))}`
                    : "No classified responses"
                }
                data-classified={classified > 0}
                style={{ "--lots-share": `${share(lots) ?? 0}%` }}
              >
                <span>
                  <b>{classified}</b>
                  <small>responses</small>
                </span>
              </div>
              <figcaption>
                <p className={styles.note}>
                  Share of Practice responses with a LOTS or HOTS label.
                </p>
                <dl className={styles.mixLegend}>
                  {[lots, hots].map((row) => (
                    <div key={row.label}>
                      <dt>
                        <i data-skill={row.label} aria-hidden="true" />
                        {row.label}
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
              </figcaption>
            </figure>
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
}) {
  const report = useMemo(
    () => summarizePracticeLearning(attempts, modules, items),
    [attempts, modules, items],
  );
  const titleId = useId();
  return (
    <div className={styles.report}>
      <section className={styles.section} aria-labelledby={titleId}>
        <h3 id={titleId} className={styles.sectionHeading}>
          Topic Performance Summary
        </h3>
        <p className={styles.intro}>
          Class accuracy gives each participating student equal weight across
          submitted Practice attempts.
        </p>
        {report.topics.length > 0 ? (
          <TopicResults
            topics={report.topics}
            showModule={showModule}
            table={view === "table"}
          />
        ) : (
          <p className={styles.empty}>
            No scored question responses are available for this selection.
          </p>
        )}
        <div className={styles.statusGuide}>
          <ul className={styles.guide} aria-label="Topic status guide">
            {Object.entries(statuses).map(([status, { description }]) => (
              <li key={status}>
                <TopicStatus status={status} />
                <span>{description}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            A rating needs {practiceReviewCriteria.minStudents} students and{" "}
            {practiceReviewCriteria.minResponses} responses. The review threshold
            is {threshold}%.
          </p>
        </div>
      </section>
      <ThinkingPerformance report={report} table={view === "table"} />
    </div>
  );
}
