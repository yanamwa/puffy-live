import { useId, useState } from "react";
import styles from "./lessonresult.module.css";

function ReviewTopics({ reviews }) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, reviews.length - 1);
  const review = reviews[index];
  const cardId = useId();
  return (
    <section className={styles.feedbackSection}>
      <div className={styles.sectionHeading}>
        <h4>Suggested Review Topics</h4>
        {reviews.length > 1 && <small>{index + 1} of {reviews.length}</small>}
      </div>
      {review ? (
        <>
          <article id={cardId} className={styles.reviewTopicCard} aria-live="polite" aria-atomic="true">
            <h5>{review.topic}</h5>
            {review.historicalOnly && <small>Earlier difficulty · {review.improved ? "Correct this time; verify with another example" : "Review and verify understanding"}</small>}
            <dl className={styles.reviewDetails}>
              <dt>What to Understand</dt><dd>{review.explanation}</dd>
              <dt className={styles.studyTipLabel}>Study Tip</dt><dd className={styles.studyTipText}>{review.studyTip}</dd>
              <dt>Quick Self-Check</dt><dd>{review.selfCheck}</dd>
            </dl>
          </article>
          {reviews.length > 1 && (
            <nav className={styles.reviewNumbers} aria-label="Suggested review topics">
              {reviews.map((item, number) => (
                <button key={item.topic} type="button" aria-controls={cardId}
                  aria-pressed={index === number} aria-label={`Review topic ${number + 1}: ${item.topic}`}
                  onClick={() => setSelected(number)}>{number + 1}</button>
              ))}
            </nav>
          )}
        </>
      ) : <p>No missed concepts were recorded for this topic.</p>}
    </section>
  );
}

export default function PracticeFeedbackCard({ feedback, modeLabel, index, count, onPage }) {
  const reviews = feedback.suggestedReviewTopics || [];
  const strengths = feedback.strengths || [];
  const assessed = feedback.latestTotal > 0 && feedback.latestAccuracy != null && !feedback.selfAssessed;
  const history = feedback.historicalAccuracy != null && feedback.historicalTotal !== 0;
  return (
    <div className={styles.adaptiveFeedbackCard}>
      <div className={styles.feedbackBody}>
        <header className={styles.feedbackTopic}>
          <span>{modeLabel}</span>
          <h3>{feedback.topic}</h3>
        </header>
        <dl className={styles.accuracyTiles}>
          <div>
            <dt>Latest Topic Accuracy</dt>
            <dd>{assessed ? `${feedback.latestAccuracy}%` : "Not Assessed"}</dd>
            <small>{feedback.selfAssessed && feedback.recallPercentage != null
              ? `Self-rated recall: ${feedback.recallPercentage}%` : "Most recent attempt"}</small>
          </div>
          <div>
            <dt>Recent Graded Accuracy</dt>
            <dd>{history ? `${feedback.historicalAccuracy}%` : "Unavailable"}</dd>
            <small>{history && feedback.gradedAttempts > 0 ? `Across ${feedback.gradedAttempts} graded ${feedback.gradedAttempts === 1 ? "attempt" : "attempts"}` : history ? "Recorded graded responses" : "No graded history available"}</small>
          </div>
        </dl>
        <section className={styles.feedbackStatus}>
          <h4>{feedback.understanding}</h4>
          <p>{feedback.recommendation}</p>
        </section>
        <div className={styles.feedbackSummary}>
          <section>
            <h4>Strengths</h4>
            {strengths.length ? <ul>{strengths.map(item => <li key={item}>{item}</li>)}</ul>
              : <p>A graded example is needed to confirm a strength here.</p>}
          </section>
          <section>
            <h4>Areas for Improvement</h4>
            {reviews.length ? <ul>{reviews.map(item => <li key={item.topic}>{item.topic}{item.historicalOnly && <small>{item.improved ? "Improved this attempt" : "Earlier practice"}</small>}</li>)}</ul>
              : <p>No missed concepts recorded.</p>}
          </section>
        </div>
        <section className={styles.feedbackPriority}>
          <div className={styles.sectionHeading}><h4>Adaptive Recommendation</h4><small>{feedback.difficulty}</small></div>
          <p>{feedback.adaptiveRecommendation}</p>
        </section>
        <ReviewTopics key={index} reviews={reviews} />
        <section className={styles.feedbackSection}>
          <h4>Next Goal</h4><p>{feedback.nextGoal}</p>
        </section>
      </div>
      <footer className={styles.adaptiveFooter}>
        <span className={styles.feedbackCounter}>Page {index + 1} of {count}</span>
        <nav className={styles.feedbackNavigation} aria-label="Feedback pages">
          <button type="button" disabled={index === 0} onClick={() => onPage(index - 1)}>Back</button>
          <button type="button" disabled={index >= count - 1} onClick={() => onPage(index + 1)}>Next</button>
        </nav>
      </footer>
    </div>
  );
}
