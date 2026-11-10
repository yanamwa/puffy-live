import TutorialBackButton from "../TutorialBackButton.jsx";
import { useState, useEffect } from "react";
import styles from "./QandA-tutorial.module.css";
import { useNavigate, useParams } from "react-router-dom";

const slidesData = [
  {
    question: 'What does the acronym "LAN" commonly stand for?',
    type: "input",
    placeholder: "Type your answer here",
  },
  {
    question: 'What does the acronym "LAN" commonly stand for?',
    type: "correct",
    answer: "Local Area Network",
  },
  {
    question: 'What does the acronym "LAN" commonly stand for?',
    type: "wrong",
    answer: "Large Access Node",
  },
];

const qnaFrames = ["/images/qna.png", "/images/qna2.png", "/images/qna3.png"];

export const qnaIntro = {
  frames: qnaFrames,
  screen: styles.introScreen,
  artwork: styles.qnaIntroImage,
};

export default function QandATutorial({
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
      if (lessonId) {
        navigate(`/qna/lesson/${lessonId}`);
        return;
      }

      if (deckId) {
        navigate(`/qna/deck/${deckId}`);
      }
    }, 700);
  };

  return (
    <div className={styles.container}>
      <TutorialBackButton onBack={onBack} />

      {(showIntro || startLoading) && (
        <div className={styles.introScreen}>
          {!showCircle && !startLoading && (
            <img
              src={qnaFrames[frameIndex]}
              alt="Q&A loading"
              className={styles.qnaIntroImage}
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
              <h1 className={styles.title}>Q&A</h1>
            </div>

            <div className={styles.subtitles}>
              <p className={styles.subtitle}>Ask, Answer, and explore!</p>

              <p className={styles.subtitle}>
                Challenge your brain with interesting questions and discover
                something new every time you play!
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

                {slide.type === "input" && (
                  <div className={styles.inputPreview}>{slide.placeholder}</div>
                )}

                {slide.type === "correct" && (
                  <div className={`${styles.answerBox} ${styles.correct}`}>
                    {slide.answer}
                  </div>
                )}

                {slide.type === "wrong" && (
                  <div className={`${styles.answerBox} ${styles.wrong}`}>
                    {slide.answer}
                  </div>
                )}
              </div>
            ))}

            <div className={styles.dots}>
              {slidesData.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${
                    currentSlide === i ? styles.active : ""
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
