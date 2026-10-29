import { useNavigate, useParams } from "react-router-dom";
import {
  getPracticeBackPath,
  getStoredPracticeSession,
} from "./practiceSession.js";
import styles from "./TutorialBackButton.module.css";

export default function TutorialBackButton({ onBack } = {}) {
  const navigate = useNavigate();
  const { lessonId, deckId } = useParams();
  const session = getStoredPracticeSession({ lessonId, deckId });
  const destination =
    lessonId || deckId
      ? getPracticeBackPath(session, { lessonId, deckId })
      : "/student/enrolled-courses";
  return (
    <div className={styles.bar}>
      <button type="button" onClick={onBack || (() => navigate(destination))}>
        ← Back to Course
      </button>
    </div>
  );
}
