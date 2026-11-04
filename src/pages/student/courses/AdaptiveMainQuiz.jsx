import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { API_BASE } from "../../../config.js";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import "./AdaptiveMainQuiz.css";
export default function AdaptiveMainQuiz({ courseId, moduleId }) {
  const [quiz, setQuiz] = useState(null),
    [answers, setAnswers] = useState([]),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void start();
  }, []);
  async function request(action, body) {
    const response = await fetch(`${API_BASE}/lessons/main-quiz/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...lessonAuthHeaders() },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.message || "Main Quiz request failed.");
    return data;
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      const data = await request("start", {
        course_id: Number(courseId),
        module_id: String(moduleId),
      });
      setQuiz(data.quiz);
      setAnswers(data.quiz.questions.map(() => ""));
      setResult(null);
    } catch (error) {
      setError(error.message);
      if (/already.*(taken|submitted)/i.test(error.message)) {
        await Swal.fire({
          imageUrl: "/images/reminder.png?v=2", imageWidth: 300, imageAlt: "Quiz reminder", customClass: { popup: "student-reminder-popup", title: "student-reminder-title" },
          title: "Main Quiz already taken",
          text: "You have already taken this Main Quiz. You can only access it once.",
          confirmButtonText: "OK",
        });
      }
    } finally {
      setBusy(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request("submit", { quiz_id: quiz.quizId, answers });
      setResult(data.result);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="adaptiveMainQuiz">
      <h2>Main Quiz · Mixed Mode</h2>
      <p>
        Multiple Choice, True/False, and Identification. One-time access only.
      </p>
      {error && <p role="alert">{error}</p>}
      {!quiz && error ? null : !quiz ? (
        <>
          <p>
            Opening this page starts your one-time Main Quiz. Complete and
            submit your answers before leaving.
          </p>
          <button disabled={busy} onClick={start}>
            {busy ? "Preparing your personalized quiz…" : "Start Main Quiz"}
          </button>
        </>
      ) : result ? (
        <>
          <h3>
            {result.passed ? "Passed" : "Not passed"} — {result.score}/
            {result.total} ({Math.round(result.percent)}%)
          </h3>
          <p>
            Required correct answers: {result.requiredCorrect}. Your Main Quiz
            result has been recorded.
          </p>
          {result.answers.map((answer, index) => (
            <article key={index}>
              <h4>
                {index + 1}. {answer.question}
              </h4>
              <p>
                {answer.isCorrect ? "Correct" : "Incorrect"} · Your answer:{" "}
                {answer.selected_answer || "No answer"}
              </p>
              <p>Correct answer: {answer.correct_answer}</p>
              <p>{answer.explanation}</p>
            </article>
          ))}
        </>
      ) : (
        <form onSubmit={submit}>
          <p>
            Passing score: {quiz.passingPercentage}% · Your submission will be
            recorded.
          </p>
          {quiz.questions.map((question, index) => (
            <fieldset key={index}>
              <legend>
                {index + 1}. {question.question}
              </legend>
              {question.type === "identification" ? (
                <input
                  aria-label={`Answer to question ${index + 1}`}
                  maxLength={500}
                  required
                  value={answers[index]}
                  onChange={(event) =>
                    setAnswers((current) =>
                      current.map((answer, i) =>
                        i === index ? event.target.value : answer,
                      ),
                    )
                  }
                />
              ) : (
                question.options.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={`question-${index}`}
                      required
                      checked={answers[index] === option}
                      onChange={() =>
                        setAnswers((current) =>
                          current.map((answer, i) =>
                            i === index ? option : answer,
                          ),
                        )
                      }
                    />
                    {option}
                  </label>
                ))
              )}
            </fieldset>
          ))}
          <button disabled={busy}>
            {busy ? "Submitting…" : "Submit Main Quiz"}
          </button>
        </form>
      )}
    </section>
  );
}
