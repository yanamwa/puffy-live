import TutorialBackButton from "../TutorialBackButton.jsx";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./matching-tutorial.module.css";

const matchFrames = [
  "/images/match1.png",
  "/images/match2.png",
  "/images/match3.png",
];

export const matchingIntro = {
  frames: matchFrames,
  screen: styles.introScreen,
  artwork: styles.matchIntroImage,
};

export default function MatchingType({
  onStart,
  onBack,
  startDisabled,
  skipIntro = false,
} = {}) {
  const navigate = useNavigate();
  const { lessonId, deckId } = useParams();

  const [slideIndex, setSlideIndex] = useState(0);

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
      setSlideIndex((prev) => (prev + 1) % 3);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    setStartLoading(true);

    setTimeout(() => {
      if (deckId) {
        navigate(`/matching-type/deck/${deckId}`);
        return;
      }

      if (lessonId) {
        navigate(`/matching-type/lesson/${lessonId}`);
      }
    }, 700);
  };

  const getCardClass = (match, side) => {
    if (slideIndex === 1 && match === "A") {
      return styles.matched;
    }

    if (slideIndex === 2) {
      if (side === "left" && match === "B") return styles.wrongPrevious;
      if (side === "right" && match === "C") return styles.wrongPrevious;
    }

    return "";
  };

  return (
    <div className={styles.pageWrapper}>
      <TutorialBackButton onBack={onBack} />

      {(showIntro || startLoading) && (
        <div className={styles.introScreen}>
          {!showCircle && !startLoading && (
            <img
              src={matchFrames[frameIndex]}
              alt="Matching loading"
              className={styles.matchIntroImage}
            />
          )}

          {(showCircle || startLoading) && (
            <div className={styles.circleLoader}></div>
          )}
        </div>
      )}

      {!showIntro && !startLoading && (
        <div className={styles.paperBackground}>
          <div className={styles.container}>
            <div className={styles.quizAppContainer}>
              <div className={styles.quizHeader}>
                <h1>Matching Type</h1>
              </div>

              <div className={styles.subtitles}>
                <p>
                  Find the perfect match! Pair the terms, ideas, or clues
                  correctly, it's a fun way to test your memory and logic!
                </p>

                <button
                  className={styles.startButton}
                  onClick={onStart || handleStart}
                  disabled={startDisabled}
                >
                  Start
                </button>
              </div>
            </div>

            <div className={styles.slideshowBox}>
              <div className={styles.demoHeader}>Quiz Tutorial</div>
              {[0, 1, 2].map((slide) => (
                <div
                  key={slide}
                  className={`${styles.slide} ${
                    slideIndex === slide ? styles.active : ""
                  }`}
                >
                  <div className={styles.quizContent}>
                    <div className={styles.leftColumn}>
                      <div
                        className={`${styles.card} ${getCardClass(
                          "A",
                          "left",
                        )}`}
                      >
                        What are the 5 main components of an information system?
                      </div>

                      <div
                        className={`${styles.card} ${getCardClass(
                          "B",
                          "left",
                        )}`}
                      >
                        What does CPU stand for and what is its main function?
                      </div>

                      <div
                        className={`${styles.card} ${getCardClass(
                          "C",
                          "left",
                        )}`}
                      >
                        It is the component on the Arduino Uno that acts as its
                        brain.
                      </div>
                    </div>

                    <div className={styles.rightColumn}>
                      <div
                        className={`${styles.card} ${getCardClass(
                          "B",
                          "right",
                        )}`}
                      >
                        It processes instructions and performs calculations,
                        acting as the brain of the computer.
                      </div>

                      <div
                        className={`${styles.card} ${getCardClass(
                          "C",
                          "right",
                        )}`}
                      >
                        The ATmega328P microcontroller.
                      </div>

                      <div
                        className={`${styles.card} ${getCardClass(
                          "A",
                          "right",
                        )}`}
                      >
                        Hardware, Software, Data, People, and Processes.
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className={styles.pagination}>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className={`${styles.dot} ${
                      slideIndex === dot ? styles.active : ""
                    }`}
                  ></span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
