import { getStoredPracticeSession } from "../practiceSession.js";
import TutorialBackButton from "../TutorialBackButton.jsx";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMainQuizStatus } from "../../../../services/mainQuizAccess.js";
import styles from "./randommodes.module.css";

export default function RandomModesTutorial(props) {
  const { lessonId, deckId } = useParams();
  const scope = getStoredPracticeSession({ lessonId, deckId })?.scope;
  if (scope?.scopeType === "main_quiz") {
    return (
      <MainQuizTutorialGate key={`${scope.courseId}:${scope.scopeId}`} scope={scope}>
        <TutorialSlides {...props} isMainQuiz />
      </MainQuizTutorialGate>
    );
  }
  return <TutorialSlides {...props} />;
}

function MainQuizTutorialGate({ scope, children }) {
  const { courseId, scopeId } = scope;
  const navigate = useNavigate();
  const [access, setAccess] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getMainQuizStatus(courseId, scopeId, controller.signal)
      .then((status) => {
        if (controller.signal.aborted) return;
        if (status.taken) {
          setAccess("You have already taken this Main Quiz.");
        } else {
          setAccess(status.verificationRequired === false
            ? true
            : "Verify your email from the course page to open the Main Quiz tutorial.");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setAccess(error.message);
      });
    return () => controller.abort();
  }, [courseId, scopeId]);

  if (access === true) return children;
  return (
    <div className={styles.wrapper}>
      <div className={styles.headerBox}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Main Quiz</h1>
        </div>
        <p className={styles.subtitle} role="status">
          {access || "Checking Main Quiz access…"}
        </p>
        <button
          type="button"
          className={styles.startBtn}
          onClick={() => navigate(`/student/enrolled-courses/${courseId}`)}
        >
          Back to course
        </button>
      </div>
    </div>
  );
}

function TutorialSlides({ onStart, onBack, startDisabled, isMainQuiz = false }) {
  const navigate = useNavigate();
  const { lessonId, deckId } = useParams();
  const [index, setIndex] = useState(0);

  const slides = [
    {
      type: "Multiple Choice",
      question:
        "Which keyword is used to prevent a class from being subclassed?",
      options: ["static", "final", "const", "sealed"],
      correct: "final",
    },
    {
      type: "Q&A",
      question:
        "Type the keyword used to prevent a class from being subclassed.",
      answer: "final",
    },
    {
      type: "Matching Type",
      pairs: [
        ["final", "Prevents subclassing"],
        ["static", "Belongs to the class"],
        ["const", "Declares a constant"],
      ],
    },
  ].map((slide) => isMainQuiz && slide.type === "Matching Type" ? {
    type: "True or False",
    question: "A class declared with the final keyword cannot be subclassed.",
    options: ["True", "False"],
    correct: "True",
  } : slide);

  useEffect(() => {
    setIndex(0);
    const interval = setInterval(() => {
      setIndex((prev) => {
        let next = prev + 1;

        if (next >= slides.length) {
          next = 0;
        }

        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isMainQuiz]);

  const handleStart = () => {
    if (deckId) {
      navigate(`/random-modes/deck/${deckId}`);
      return;
    }

    if (lessonId) {
      navigate(`/random-modes/lesson/${lessonId}`);
    }
  };

  return (
    <div className={styles.wrapper}>
      <TutorialBackButton onBack={onBack} />

      {/* HEADER */}

      <div className={styles.headerBox}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{isMainQuiz ? "Main Quiz" : "Mixed Mode"}</h1>
        </div>

        <div className={styles.subtitles}>
          <p className={styles.subtitle}>
            {isMainQuiz ? "Read each question carefully and choose or enter the best answer. Your answers and score will be recorded." : "Practice with matching type, multiple choice, and Q&A all at once."}
          </p>

          <p className={styles.subtitle}>
            {isMainQuiz ? "Answer honestly and independently. Check each response before submitting, and complete all questions." : "Mixed Mode changes the question style as you play, so review feels closer to the real quiz types."}
          </p>
        </div>

        <button
          className={styles.startBtn}
          onClick={onStart || handleStart}
          disabled={startDisabled}
        >
          Start
        </button>
      </div>

      {/* QUIZ */}

      <div className={styles.slideshowBox}>
        <div className={styles.demoHeader}>Quiz Tutorial</div>
        {/* SLIDES */}

        {slides.map((slide, i) => (
          <div
            key={i}
            className={`${styles.slide} ${i === index ? styles.active : ""}`}
          >
            <p className={styles.question}>{slide.type}</p>

            {slide.options && (
              <>
                <p className={styles.prompt}>{slide.question}</p>

                <div className={styles.options}>
                  {slide.options.map((option, j) => (
                    <button
                      key={j}
                      className={option === slide.correct ? styles.correct : ""}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {slide.answer && (
              <div className={styles.qnaPreview}>
                <p className={styles.prompt}>{slide.question}</p>
                <input value={slide.answer} readOnly />
              </div>
            )}

            {slide.pairs && (
              <div className={styles.matchPreview}>
                <div>
                  {slide.pairs.map(([term]) => (
                    <span key={term}>{term}</span>
                  ))}
                </div>

                <div>
                  {slide.pairs.map(([term, definition]) => (
                    <span key={`${term}-${definition}`}>{definition}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* DOTS */}

        <div className={styles.dots}>
          {slides.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === index ? styles.activeDot : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
