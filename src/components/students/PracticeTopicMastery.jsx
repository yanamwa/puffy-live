const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});
const visibleTopicCount = 4;

function TopicList({ topics, showScores = false }) {
  const rows = topics.map(({ topic, correct, total }) => (
    <li key={topic}>
      <span>
        {topic}
        {showScores && (
          <small>
            {correct} of {total} correct
          </small>
        )}
      </span>
      {showScores && <strong>{percentFormat.format(correct / total)}</strong>}
    </li>
  ));
  const more = rows.length - visibleTopicCount;

  return (
    <>
      <ul>{rows.slice(0, visibleTopicCount)}</ul>
      {more > 0 && (
        <details>
          <summary>
            {more} more {more === 1 ? "topic" : "topics"}
          </summary>
          <ul>{rows.slice(visibleTopicCount)}</ul>
        </details>
      )}
    </>
  );
}

export default function PracticeTopicMastery({ topics = [] }) {
  const lowest = topics?.[0];
  const leastMastered =
    lowest &&
    topics.filter(
      ({ correct, total }) => correct * lowest.total === lowest.correct * total,
    );

  return (
    <div className="home-practice-topics">
      <section>
        <h4>Least mastered</h4>
        {!lowest ? (
          <p>No topic to rank yet.</p>
        ) : lowest.correct === lowest.total ? (
          <p>You answered every graded topic question correctly.</p>
        ) : (
          <>
            <strong className="home-practice-lowest-rate">
              {percentFormat.format(lowest.correct / lowest.total)}
            </strong>
            {leastMastered.length > 1 &&
            leastMastered.length === topics.length ? (
              <p>All {topics.length} topics share this score.</p>
            ) : (
              <TopicList topics={leastMastered} />
            )}
          </>
        )}
      </section>
      <section>
        <h4>Topic mastery</h4>
        {lowest ? (
          <TopicList topics={topics} showScores />
        ) : (
          <p>
            No graded answers with topic details are available for these
            attempts.
          </p>
        )}
      </section>
    </div>
  );
}
