import { useEffect, useRef, useState } from "react";
import "./PracticeAnswerFeedback.css";
export default function PracticeAnswerFeedback() {
  const [result, setResult] = useState(null);
  const timer = useRef();
  useEffect(() => {
    const show = (event) => {
      clearTimeout(timer.current);
      setResult(Boolean(event.detail.isCorrect));
      timer.current = setTimeout(() => setResult(null), 1200);
    };
    window.addEventListener("practice-answer-feedback", show);
    return () => { window.removeEventListener("practice-answer-feedback", show); clearTimeout(timer.current); };
  }, []);
  return result === null ? null : <div className="practice-answer-feedback" role="status" aria-live="polite">
    <img src={result ? "/images/correct.png" : "/images/wrong.png"} alt={result ? "Correct answer" : "Wrong answer"} />
  </div>;
}
