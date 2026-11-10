import TutorialBackButton from "../TutorialBackButton.jsx";
import React, { useEffect, useState } from "react";
import styles from "./timedquiz.module.css";
import { useNavigate, useParams } from "react-router-dom";

const timedImage = "/images/timed.png";

export const timedIntro = {
  frames: [timedImage],
  screen: styles.introScreen,
  artwork: styles.timedIntroImage,
};

export default function TimedQuiz({
  onStart,
  onBack,
  startDisabled,
  skipIntro = false,
} = {}) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [showCircle, setShowCircle] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const { lessonId, deckId } = useParams();
  const navigate = useNavigate();
  const isLessonMode = Boolean(lessonId);
  const isDeckMode = Boolean(deckId);
  const hasSource = isLessonMode || isDeckMode || Boolean(onStart);
  const [timeLeft, setTimeLeft] = useState(120);

  const previewSlides = [
    {
      question: "Which of these is not an access modifier?",
      options: [
        { text: "Protected", className: "" },
        { text: "Private", className: "wrong" },
        { text: "Public", className: "" },
        { text: "Package", className: "" },
      ],
    },
    {
      question: "Which of these is not an access modifier?",
      options: [
        { text: "Protected", className: "correct" },
        { text: "Private", className: "" },
        { text: "Public", className: "" },
        { text: "Package", className: "" },
      ],
    },
    {
      question: "Which of these is not an access modifier?",
      options: [
        { text: "Protected", className: "" },
        { text: "Private", className: "" },
        { text: "Public", className: "" },
        { text: "Package", className: "" },
      ],
    },
  ];

  useEffect(() => {
    if (skipIntro) return;
    const timer = setTimeout(() => {
      setShowCircle(true);

      setTimeout(() => {
        setShowIntro(false);
        setShowCircle(false);
      }, 700);
    }, 1800);

    return () => clearTimeout(timer);
  }, [skipIntro]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          return 120;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  useEffect(() => {
    const slide = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % previewSlides.length);
    }, 2500);

    return () => clearInterval(slide);
  }, [previewSlides.length]);

  const handleStart = () => {
    setStartLoading(true);

    setTimeout(() => {
      if (isLessonMode) {
        navigate(`/timedquiz/lesson/${lessonId}`);
        return;
      }

      if (isDeckMode) {
        navigate(`/timedquiz/deck/${deckId}`);
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
              src={timedImage}
              alt="Timed quiz loading"
              className={styles.timedIntroImage}
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
              <h1 className={styles.title}>Timed Quiz</h1>
            </div>

            <div className={styles.subtitles}>
              <p className={styles.subtitle}>Beat the clock!</p>
              <p className={styles.subtitle}>
                Answer as many questions as you can before time runs out. Think
                fast and stay sharp, every second counts!
              </p>
            </div>

            {hasSource && (
              <button
                className={styles.startBtn}
                onClick={onStart || handleStart}
                disabled={startDisabled}
              >
                Start
              </button>
            )}
          </div>

          <div className={styles.slideshowBox}>
            <div className={styles.demoHeader}>
              <span>Quiz Tutorial</span>
              <div className={styles.timerBox}>
                <div className={styles.timer}>
                  {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
                  {String(timeLeft % 60).padStart(2, "0")}
                </div>
              </div>
            </div>

            <p className={styles.question}>
              {previewSlides[previewIndex].question}
            </p>

            <div className={styles.previewOptions}>
              {previewSlides[previewIndex].options.map((option, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.option} ${
                    option.className === "correct"
                      ? styles.correct
                      : option.className === "wrong"
                        ? styles.wrong
                        : ""
                  }`}
                  disabled
                >
                  {option.text}
                </button>
              ))}
            </div>

            <div className={styles.dots}>
              {previewSlides.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${
                    previewIndex === i ? styles.activeDot : ""
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
