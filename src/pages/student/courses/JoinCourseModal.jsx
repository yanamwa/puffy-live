import { useRef, useState } from "react";
import "./JoinCourseModal.css";

export default function JoinCourseModal({
  open,
  courseCode,
  onCourseCodeChange,
  onCancel,
  onJoin,
}) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleJoin = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onJoin();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!submittingRef.current) onCancel();
  };

  if (!open) return null;

  return (
    <div
      className="join-course-overlay"
      role="presentation"
      onMouseDown={handleCancel}
    >
      <section
        className="join-course-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-course-title"
        aria-describedby="join-course-description"
        aria-busy={submitting}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="join-course-header">
          <h2 id="join-course-title">Course Code</h2>
        </header>

        <div className="join-course-body">
          <p id="join-course-description">
            Ask your professor for the class code, then enter the course code
            here to request enrollment. Your professor will review your request.
          </p>
          <input
            type="text"
            aria-label="Course code"
            value={courseCode}
            placeholder="Course Code"
            autoFocus
            disabled={submitting}
            onChange={(event) => onCourseCodeChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleJoin();
              }
              if (event.key === "Escape") handleCancel();
            }}
          />
        </div>

        <footer className="join-course-actions">
          <button
            type="button"
            className="join-course-cancel"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="join-course-submit"
            onClick={handleJoin}
            disabled={submitting}
          >
            {submitting ? "Sending..." : "Join"}
          </button>
        </footer>
      </section>
    </div>
  );
}
