import "./JoinCourseModal.css";

export default function JoinCourseModal({
  open,
  courseCode,
  onCourseCodeChange,
  onCancel,
  onJoin,
}) {
  if (!open) return null;

  return (
    <div
      className="join-course-overlay"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        className="join-course-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-course-title"
        aria-describedby="join-course-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="join-course-header">
          <h2 id="join-course-title">Course Code</h2>
        </header>

        <div className="join-course-body">
          <p id="join-course-description">
            Ask your professor for the class code, then enter the course code
            here.
          </p>
          <input
            type="text"
            aria-label="Course code"
            value={courseCode}
            placeholder="Course Code"
            autoFocus
            onChange={(event) => onCourseCodeChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onJoin();
              if (event.key === "Escape") onCancel();
            }}
          />
        </div>

        <footer className="join-course-actions">
          <button
            type="button"
            className="join-course-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="button" className="join-course-submit" onClick={onJoin}>
            Join
          </button>
        </footer>
      </section>
    </div>
  );
}
