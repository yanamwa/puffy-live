import TutorialBackButton from "../TutorialBackButton.jsx";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./multipleChoice-tutorial.module.css";

const multipleFrames = [
  "/images/multiple1.png",
  "/images/multiple2.png",
  "/images/multiple3.png",
];

const slidesData = [
  {
    question: "Which keyword is used to prevent a class from being subclassed?",
    options: ["static", "final", "const", "sealed"],
    colorIndex: null,
    colorType: null,
  },
  {
    question: "Which keyword is used to prevent a class from being subclassed?",
    options: ["final", "static", "const", "sealed"],
    colorIndex: 1,
    colorType: "wrong",
  },
  {
    question: "Which keyword is used to prevent a class from being subclassed?",
    options: ["final", "static", "const", "sealed"],
    colorIndex: 0,
    colorType: "correct",
  },
];

export const multipleChoiceIntro = {
  frames: multipleFrames,
  screen: styles.introScreen,
  artwork: styles.multipleIntroImage,
};

export default function MultipleChoiceTutorial({
  onStart,
  onBack,
  startDisabled,
  skipIntro = false,
} = {}) {
  const navigate = useNavigate();
  const { lessonId, deckId } = useParams();

  const [currentSlide, setCurrentSlide] = useState(0);

  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [frameIndex, setFrameIndex] = useState(0);
  const [showCircle, setShowCircle] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  useEffect(() => {
    if (skipIntro) return;
    const animationSequence = [0, 1, 2, 0, 1, 2, 0, 1, 2];
    let current = 0;

    const interval = setInterval(() => {
      setFrameIndex(animationSequence[current]);
      current++;

      if (current >= animationSequence.length) {
        clearInterval(interval);
        setShowCircle(true);

        setTimeout(() => {
          setShowIntro(false);
          setShowCircle(false);
        }, 700);
      }
    }, 220);

    return () => clearInterval(interval);
  }, [skipIntro]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slidesData.length);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    setStartLoading(true);

    setTimeout(() => {
      if (deckId) {
        navigate(`/multiple-choice/deck/${deckId}`);
        return;
      }

      if (lessonId) {
        navigate(`/multiple-choice/lesson/${lessonId}`);
      }
    }, 700);
  };

  return (
    <div className={styles.page}>
      <TutorialBackButton onBack={onBack} />

      {(showIntro || startLoading) && (
        <div className={styles.introScreen}>
          {!showCircle && !startLoading && (
            <img
              src={multipleFrames[frameIndex]}
              alt="Multiple Choice loading"
              className={styles.multipleIntroImage}
            />
          )}

          {(showCircle || startLoading) && (
            <div className={styles.circleLoader}></div>
          )}
        </div>
      )}

      {!showIntro && !startLoading && (
        <>
          <div className={styles.headerBox}>
            <div className={styles.headerTop}>
              <h1 className={styles.title}>Multiple Choice Quiz</h1>
            </div>

            <div className={styles.subtitles}>
              <p className={styles.subtitle}>Pick the right one!</p>
              <p className={styles.subtitle}>
                Select the correct answer. Don’t worry if you miss, every
                mistake helps you learn!
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

          <div className={styles.slideshowBox}>
            <div className={styles.demoHeader}>Quiz Tutorial</div>
            {slidesData.map((slide, i) => (
              <div
                key={i}
                className={`${styles.slide} ${
                  currentSlide === i ? styles.active : ""
                }`}
              >
                <p className={styles.question}>{slide.question}</p>

                <div className={styles.options}>
                  {slide.options.map((option, j) => {
                    let btnClass = "";

                    if (j === slide.colorIndex) {
                      btnClass =
                        slide.colorType === "correct"
                          ? styles.correct
                          : styles.wrong;
                    }

                    return (
                      <button
                        key={j}
                        type="button"
                        className={btnClass}
                        disabled
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className={styles.dots}>
              {slidesData.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${
                    currentSlide === i ? styles.activeDot : ""
                  }`}
                ></span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
