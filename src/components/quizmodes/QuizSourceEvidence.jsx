export default function QuizSourceEvidence({ question }) {
  if (!question?.source_chunks?.length) return null;
  return (
    <details
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #dce5ee",
        borderRadius: 10,
        fontSize: 12,
      }}
    >
      <summary>Source references</summary>
      <p>
        Review these excerpts alongside the question, answer, and explanation
        before saving.
      </p>
      {question.source_chunks.map((citation, index) => (
        <blockquote
          key={index}
          style={{
            margin: "10px 0",
            paddingLeft: 12,
            borderLeft: "3px solid #a9c9ed",
          }}
        >
          <p>{citation.quote}</p>
          <small>{citation.filename || "Uploaded source"}</small>
        </blockquote>
      ))}
    </details>
  );
}
