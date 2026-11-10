import TutorialBackButton from "../TutorialBackButton.jsx";
import React, { useEffect, useState } from "react";
import styles from "./flashcards-tutorial.module.css";
import { useNavigate, useParams } from "react-router-dom";

const flashFrames = [
  "/images/flash1.png",
  "/images/flash2.png",
  "/images/flash3.png",
];

export const flashcardIntro = {
  frames: flashFrames,
  screen: styles.introScreen,
  artwork: styles.flashIntroImage,
};

export default function FlashcardsTutorial({
  onStart,
  onBack,
  startDisabled,
  skipIntro = false,
} = {}) {
  const [flipped, setFlipped] = useState(false);
  const [tabLabel, setTabLabel] = useState("Question");
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [frameIndex, setFrameIndex] = useState(0);
  const [showCircle, setShowCircle] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  const navigate = useNavigate();
  const { lessonId, deckId } = useParams();

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

  const handleFlip = () => {
    setFlipped(!flipped);
    setTabLabel(!flipped ? "Answer" : "Question");
  };

  const handleStart = () => {
    setStartLoading(true);

    setTimeout(() => {
      if (lessonId) {
        navigate(`/flashcard/lesson/${lessonId}`);
      } else if (deckId) {
        navigate(`/flashcard/deck/${deckId}`);
      }
    }, 700);
  };

  return (
    <div className={styles.flashcardsApp}>
      <TutorialBackButton onBack={onBack} />

      {(showIntro || startLoading) && (
        <div className={styles.introScreen}>
          {showIntro && !showCircle && !startLoading && (
            <img
              src={flashFrames[frameIndex]}
              alt="Flashcard loading"
              className={styles.flashIntroImage}
            />
          )}

          {(showCircle || startLoading) && (
            <div className={styles.circleLoader}></div>
          )}
        </div>
      )}

      {!showIntro && !startLoading && (
        <div className={styles.mainContent}>
          <div className={styles.headerWrapper}>
            <div className={styles.headerTop}>
              <h1>Flashcards</h1>
            </div>

            <div className={styles.headerBody}>
              <p>
                Flip, learn, and master! <br />
                Review facts and test your memory in a fun, quick, and easy way
                — perfect for learning on the go!
              </p>

              <button
                className={styles.startBtn}
                onClick={onStart || handleStart}
                disabled={startDisabled}
              >
                Start
              </button>
            </div>
          </div>

          <div className={styles.flashcardWrapper}>
            <div className={styles.demoHeader}>Quiz Tutorial</div>
            <div className={styles.tab}>
              <span className={styles.active}>{tabLabel}</span>
              <span onClick={handleFlip}>Flip</span>
            </div>

            <div
              className={`${styles.flashcard} ${flipped ? styles.flipped : ""}`}
              onClick={handleFlip}
            >
              <div className={styles.flashcardInner}>
                <div className={`${styles.flashcardFace} ${styles.front}`}>
                  <p>
                    Which keyword is used to prevent a class from being
                    subclassed?
                  </p>
                </div>

                <div className={`${styles.flashcardFace} ${styles.back}`}>
                  <p>final</p>
                </div>
              </div>

              <div className={styles.difficulty}>
                <button className={styles.easy}>Easy</button>
                <button className={styles.good}>Good</button>
                <button className={styles.hard}>Hard</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
