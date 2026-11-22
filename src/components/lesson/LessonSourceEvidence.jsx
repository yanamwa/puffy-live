export default function LessonSourceEvidence({ page }) {
  if (
    !page?.statements?.length ||
    page.content !== page.statements.map((s) => s.text.trim()).join("\n\n")
  )
    return null;
  return (
    <details
      style={{
        marginTop: 16,
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <summary>Source references</summary>
      {page.syllabus_topic && <p><strong>Syllabus topic</strong> {page.syllabus_topic}</p>}
      {page.learning_objective && <p><strong>Learning objective</strong> {page.learning_objective}</p>}
      <p>
        Source: {page.source_filename || "Uploaded document"}. These excerpts
        support the generated statements. Review them alongside the original
        document.
      </p>
      {page.statements.map((statement, index) => (
        <div key={index} style={{ marginTop: 12 }}>
          <strong>{statement.text}</strong>
          {statement.citations.map((citation, sourceIndex) => {
            const positions = citation.source_position || [];
            const pages = [
              ...new Set(positions.map((p) => p.page).filter(Boolean)),
            ];
            const slides = [
              ...new Set(positions.map((p) => p.slide).filter(Boolean)),
            ];
            const sections = [
              ...new Set(positions.map((p) => p.section).filter(Boolean)),
            ];
            const location = pages.length
              ? "Page " + pages.join(", ")
              : slides.length
                ? "Slide " + slides.join(", ")
                : sections.length
                  ? "Text section " + sections.join(", ")
                  : "Source chunk " + citation.chunk_id;
            return (
              <blockquote
                key={sourceIndex}
                style={{
                  margin: "8px 0",
                  paddingLeft: 12,
                  borderLeft: "3px solid #aaa",
                }}
              >
                <p>{citation.quote}</p>
                <small>
                  {citation.filename ? `${citation.filename} · ` : ""}
                  {location}
                </small>
              </blockquote>
            );
          })}
        </div>
      ))}
    </details>
  );
}
