export function readCoverage(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export default function CoverageModules({ value, onChange, busy = false }) {
  const modules = readCoverage(value);
  return (
    <fieldset className="catalog-coverage">
      <legend>Course Coverage — Suggested Modules ({modules.length})</legend>
      <p>
        Suggested from the main headings in the syllabus Topic column. Review,
        correct, or add titles below. These are saved with this syllabus
        version.
      </p>
      {!modules.length && (
        <p>No module headings were detected. You can add them manually.</p>
      )}
      {modules.map((module, index) => (
        <div className="catalog-coverage-row" key={index}>
          <label>
            Module {index + 1}
            {module.source_page ? ` · PDF page ${module.source_page}` : ""}
            <input
              aria-label={`Module ${index + 1} title`}
              value={module.title}
              maxLength={255}
              disabled={busy}
              onChange={(event) =>
                onChange(
                  modules.map((row, i) =>
                    i === index ? { ...row, title: event.target.value } : row,
                  ),
                )
              }
            />
          </label>
          <button
            className="catalog-button catalog-coverage-remove"
            type="button"
            disabled={busy}
            onClick={() => onChange(modules.filter((_, i) => i !== index))}
            aria-label={`Remove module ${index + 1}`}
          >
            Remove
          </button>
          {(module.syllabus_description || module.description || module.topics?.length > 0 || module.learning_objectives) && (
            <details>
              <summary>Module coverage</summary>
              {module.syllabus_description && <p><strong>Description from the syllabus</strong> {module.syllabus_description}</p>}
              {module.description && <p><strong>Topic-based summary</strong> {module.description}</p>}
              {!!module.topics?.length && <ol>{module.topics.map((topic, i) => <li key={i}>{topic}</li>)}</ol>}
              {module.learning_objectives && <p><strong>Learning objectives</strong> {module.learning_objectives}</p>}
            </details>
          )}
        </div>
      ))}
      <button
        className="catalog-button catalog-coverage-add"
        type="button"
        disabled={busy || modules.length >= 150}
        onClick={() => onChange([...modules, { title: "", source_page: null }])}
      >
        + Add Module Title
      </button>
      <p className="catalog-note">
        Professors can use these topics to organize instructional materials in their own courses.
      </p>
    </fieldset>
  );
}
