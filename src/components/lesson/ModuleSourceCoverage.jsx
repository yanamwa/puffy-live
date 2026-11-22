export default function ModuleSourceCoverage({ coverage }) {
  if (!coverage) return null;
  return (
    <details>
      <summary>Topic coverage and references</summary>
      {!!coverage.missing_topics?.length && (
        <section>
          <h4>Topics needing more instructional material</h4>
          <p>
            Add a source that explains each topic before publishing its lesson.
          </p>
          <ul>
            {coverage.missing_topics.map((topic) => (
              <li key={topic}>
                <strong>{topic}</strong>{" "}
                {
                  coverage.missing_topic_details?.find(
                    (item) => item.topic === topic,
                  )?.reason
                }
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!coverage.consulted_sources?.length && (
        <section>
          <h4>Consulted instructional sources</h4>
          <ul>
            {coverage.consulted_sources.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      )}
      {!!coverage.syllabus_references?.length && (
        <section>
          <h4>References listed in the syllabus</h4>
          {coverage.syllabus_references.map((group, i) => (
            <div key={i}>
              <strong>{group.category}</strong>
              <ul>
                {group.entries.map((entry, j) => (
                  <li key={j}>
                    {entry.text} (syllabus p. {entry.source_page})
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </details>
  );
}
