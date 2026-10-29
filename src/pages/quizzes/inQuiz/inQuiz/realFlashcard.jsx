import PracticeSpeakerIcon from "../../../../components/quizmodes/PracticeSpeakerIcon.jsx";
import TutorialBackButton from "../TutorialBackButton.jsx";
import { usePracticeState, usePracticeItems, clearPracticeProgress } from "../../../../utils/practiceResume.js";
import PracticeSoundControl from "../../../../components/quizmodes/PracticeSoundControl.jsx";
import PracticeAnswerFeedback from "../../../../components/quizmodes/PracticeAnswerFeedback.jsx";
import { playPracticeFeedbackSound } from "../../../../utils/practiceFeedbackSound.js";
import { lessonAuthHeaders } from "../../../../services/lessonAuth.js";
import { saveAccountQuizResult } from "../../../../utils/quizStorage.js";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../../../../config.js";
import LoadingState from "../../../../components/LoadingState.jsx";
import {
  getPracticeBackPath,
  getPracticeResultMetadata,
  getPracticeReviewPath,
  getPracticeTitle,
  getQuizItemAnswer,
  getQuizItemQuestion,
  getStoredPracticeSession,
  toNumericId,
} from "../practiceSession.js";
import styles from "./realFlashcards.module.css";

export default function Flashcards() {
  const routeNavigate = useNavigate();
  const navigate = (...args) => { clearPracticeProgress(); routeNavigate(...args); };
  const { lessonId, deckId } = useParams();

  const isLessonMode = Boolean(lessonId);
  const isDeckMode = Boolean(deckId);
  const practiceSession = useMemo(
    () => getStoredPracticeSession({ lessonId, deckId }),
    [lessonId, deckId],
  );

  const [deck, setDeck] = usePracticeState("deck", null, true);
  const [lesson, setLesson] = usePracticeState("lesson", null, true);
  const [deckCards, setDeckCards] = usePracticeState("deckCards", [], true);
  const [loading, setLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = usePracticeState("currentIndex", 0);
  const [score, setScore] = usePracticeState("score", 0);
  const [userResults, setUserResults] = usePracticeState("userResults", []);
  const [flipped, setFlipped] = usePracticeState("flipped", false);
  const [checkpointOpen, setCheckpointOpen] = usePracticeState("checkpointOpen", false);
  const [checkpointStartIndex, setCheckpointStartIndex] = usePracticeState("checkpointStartIndex", 0);
  const [checkpointReviewEndIndex, setCheckpointReviewEndIndex] = usePracticeState("checkpointReviewEndIndex", 0);

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(0.9);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifImage, setNotifImage] = useState("/images/correct.png");

  const shuffleArray = (array) => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const getCleanQuestion = (rawQuestion = "") => {
    return String(rawQuestion)
      .replace(/\s*A\..*/is, "")
      .trim();
  };

  const getCardImageSrc = (image) => {
    if (!image) return "";

    if (image.startsWith("http://") || image.startsWith("https://")) {
      return image;
    }

    return `${API_BASE}/card_images/${image}`;
  };

  const normalizeLessonData = (data) => {
    if (!data) return null;
    return data.lesson || data.data || data;
  };

  const getLessonQuizData = (lessonData) => {
    return (
      lessonData?.quiz_contents ||
      lessonData?.quiz_content ||
      lessonData?.quiz ||
      lessonData?.questions ||
      lessonData?.cards ||
      lessonData?.flashcards ||
      lessonData?.items ||
      []
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        if (practiceSession) {
          if (isDeckMode) {
            setDeck({
              title: getPracticeTitle(practiceSession, "Deck Flashcards"),
            });
            setDeckCards(practiceSession.items);
          } else {
            setLesson({
              title: getPracticeTitle(practiceSession, "Practice Flashcards"),
              quiz_contents: practiceSession.items,
            });
          }

          return;
        }

        if (isLessonMode) {
          const res = await fetch(
            `${API_BASE}/getLessonsById.php?id=${lessonId}`,
            { credentials: "include" },
          );

          const data = normalizeLessonData(await res.json());
          setLesson(data);
        }

        if (isDeckMode) {
          const [cardsRes, deckRes] = await Promise.all([
            fetch(`${API_BASE}/getCardsByDeck.php?deckId=${deckId}`, {
              credentials: "include",
            }),
            fetch(`${API_BASE}/getDeckById.php?deckId=${deckId}`, {
              credentials: "include",
            }),
          ]);

          const cardsData = await cardsRes.json();
          const deckData = await deckRes.json();

          setDeck(deckData.success ? deckData.deck : null);
          setDeckCards(cardsData.success ? cardsData.cards || [] : []);
        }
      } catch (err) {
        console.error("Error loading flashcards:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [lessonId, deckId, isLessonMode, isDeckMode, practiceSession]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const flashcards = usePracticeItems("flashcards", () => {
    if (isLessonMode) {
      const rawQuiz = getLessonQuizData(lesson);
      if (!rawQuiz) return [];

      try {
        const parsed = Array.isArray(rawQuiz)
          ? rawQuiz
          : JSON.parse(String(rawQuiz));

        if (!Array.isArray(parsed)) return [];

        return shuffleArray(
          parsed.map((item) => ({
            cardId: null,
            question: getQuizItemQuestion(item),
            answer: getQuizItemAnswer(item, "No answer available."),
            explanation: item.explanation || "",
            image: item.image || null,
          })),
        );
      } catch {
        return [];
      }
    }

    if (isDeckMode) {
      return shuffleArray(
        deckCards.map((card) => ({
          cardId: card.cardId || card.card_id || card.id,
          question: getQuizItemQuestion(card),
          answer: getQuizItemAnswer(card, "No answer available."),
          explanation: "",
          image: card.image || null,
        })),
      );
    }

    return [];
  }, [lesson, deckCards, isLessonMode, isDeckMode]);

  const currentCard = flashcards[currentIndex];
  const checkpointEndIndex = checkpointOpen
    ? checkpointReviewEndIndex
    : Math.min(currentIndex + 1, flashcards.length);
  const checkpointCards = flashcards.slice(
    checkpointStartIndex,
    checkpointEndIndex,
  );
  const progressPercent = flashcards.length
    ? (checkpointEndIndex / flashcards.length) * 100
    : 0;

  useEffect(() => {
    const nextCheckpointEnd = checkpointStartIndex + 10;

    if (
      !checkpointOpen &&
      flashcards.length > nextCheckpointEnd &&
      currentIndex >= nextCheckpointEnd
    ) {
      setCheckpointReviewEndIndex(nextCheckpointEnd);
      setFlipped(false);
      setCheckpointOpen(true);
    }
  }, [checkpointOpen, checkpointStartIndex, currentIndex, flashcards.length]);

  const speakText = (text) => {
    if (!ttsEnabled) return;

    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = voiceSpeed;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  };

  const saveQuizAttempt = async (
    finalScore,
    finalTotal = flashcards.length,
  ) => {
    const metadata = getPracticeResultMetadata(
      practiceSession,
      isDeckMode ? "deck" : "lesson",
    );

    try {
      await fetch(`${API_BASE}/saveQuizAttempt.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...lessonAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          source: metadata.source,
          lessonId: toNumericId(lessonId),
          deckId: toNumericId(deckId),
          courseId: metadata.courseId,
          quizMode: "flashcard",
          score: finalScore,
          total: finalTotal,
          isTimedOut: false,
        }),
      });
    } catch (error) {
      console.error("Save flashcard attempt error:", error);
    }
  };

  const finishFlashcards = async (
    finalScore,
    finalResults,
    returnToDeck = false,
  ) => {
    const resultPayload = {
      ...getPracticeResultMetadata(
        practiceSession,
        isDeckMode ? "deck" : "lesson",
      ),
      quizMode: "flashcard",
      deckId: toNumericId(deckId),
      lessonId: lessonId || null,
      score: finalScore,
      total: finalResults.length,
      answers: finalResults,
    };

    saveAccountQuizResult("lessonQuizResults", JSON.stringify(resultPayload));

    if (isDeckMode) {
      saveAccountQuizResult(
        `deckQuizResults_${deckId}`,
        JSON.stringify(resultPayload),
      );
    }

    navigate(
      returnToDeck && isDeckMode
        ? `/deck/${deckId}`
        : isDeckMode
          ? `/review/deck/${deckId}`
          : getPracticeReviewPath(practiceSession, { lessonId, deckId }),
    );
  };

  const repeatCheckpointCards = () => {
    const repeatResults = userResults.slice(0, checkpointStartIndex);
    const repeatScore = repeatResults.filter(
      (result) => result.isCorrect,
    ).length;

    setUserResults(repeatResults);
    setScore(repeatScore);
    setCurrentIndex(checkpointStartIndex);
    setFlipped(false);
    setCheckpointOpen(false);
  };

  const continueAfterCheckpoint = () => {
    setCheckpointStartIndex(checkpointReviewEndIndex);
    setCurrentIndex(checkpointReviewEndIndex);
    setFlipped(false);
    setCheckpointOpen(false);
  };

  const updateCardMemorized = async (cardId, isCorrect) => {
    if (!isDeckMode || !cardId) return;

    try {
      await fetch(`${API_BASE}/updateCardMemorized.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cardId,
          is_memorized: isCorrect ? 1 : 0,
        }),
      });
    } catch (error) {
      console.error("Update memorized error:", error);
    }
  };

  const loadNextCard = async (difficulty) => {
    if (!currentCard || notifOpen) return;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const isCorrect = difficulty === "easy" || difficulty === "good";
    playPracticeFeedbackSound(isCorrect);

    if (difficulty === "easy") {
      setNotifImage("/images/correct.png");
    } else if (difficulty === "good") {
      setNotifImage("/images/correct.png");
    } else {
      setNotifImage("/images/wrong.png");
    }

    setNotifOpen(true);

    const newResult = {
      cardId: currentCard.cardId || null,
      question: getCleanQuestion(currentCard.question),
      userAnswer: difficulty,
      correctAnswer: currentCard.answer,
      explanation: currentCard.explanation || currentCard.answer,
      isCorrect,
    };

    const updatedResults = [...userResults, newResult];
    const updatedScore = score + (isCorrect ? 1 : 0);

    setUserResults(updatedResults);
    setScore(updatedScore);

    await updateCardMemorized(currentCard.cardId, isCorrect);

    setTimeout(async () => {
      setNotifOpen(false);

      const completedCount = currentIndex + 1;
      const shouldShowCheckpoint =
        completedCount % 10 === 0 && completedCount < flashcards.length;

      if (shouldShowCheckpoint) {
        setCheckpointReviewEndIndex(completedCount);
        setFlipped(false);
        setCheckpointOpen(true);
        return;
      }

      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setFlipped(false);
        return;
      }

      await finishFlashcards(updatedScore, updatedResults);
    }, 1100);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (flashcards.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <div className={styles.emptyCard}>
          <img
            src="/images/404.png"
            alt="No flashcards"
            className={styles.emptyImage}
          />

          <h2 className={styles.emptyTitle}>No Flashcards Yet</h2>

          <p className={styles.emptyText}>
            No flashcards are available for this lesson.
          </p>

          <button
            type="button"
            className={styles.emptyBtn}
            onClick={() =>
              navigate(
                isDeckMode
                  ? `/review/deck/${deckId}`
                  : getPracticeBackPath(practiceSession, { lessonId, deckId }),
              )
            }
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className="practice-course-back"><TutorialBackButton /></div>
      <PracticeSoundControl />
      <PracticeAnswerFeedback />
      

      <button
        type="button"
        className={styles.settingsBtn}
        onClick={() => setSettingsOpen(true)}
      >
        <i className="bx bx-cog"></i>
        <span>settings</span>
      </button>

      {settingsOpen && (
        <div className={styles.settingsOverlay}>
          <div className={styles.settingsModal}>
            <div className={styles.settingsHeader}>
              <h2>Accessibility Settings</h2>

              <button
                type="button"
                className={styles.closeSettings}
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.settingsBody}>
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <div className={styles.settingIcon}>🔊</div>

                  <div className={styles.settingText}>
                    <strong>Text to Speech</strong>
                    <span>Read flashcards aloud</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`${styles.switchBtn} ${
                    ttsEnabled ? styles.switchOn : ""
                  }`}
                  onClick={() => {
                    setTtsEnabled((prev) => !prev);
                    window.speechSynthesis?.cancel();
                  }}
                >
                  {ttsEnabled ? "ON" : "OFF"}
                </button>
              </div>

              <div className={styles.speedBox}>
                <div className={styles.speedHeader}>
                  <label>Voice Speed</label>
                  <span className={styles.speedValue}>
                    {voiceSpeed.toFixed(1)}x
                  </span>
                </div>

                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={voiceSpeed}
                  onChange={(e) => {
                    setVoiceSpeed(Number(e.target.value));

                    if ("speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {checkpointOpen ? (
        <div className={styles.checkpointWrapper}>
          <div className={styles.checkpointHeader}>
            <span className={styles.checkpointEyebrow}>The previous cards</span>
            <h2>Review Complete</h2>

            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <p className={styles.questionCount}>
              {checkpointEndIndex} of {flashcards.length} cards reviewed
            </p>
          </div>

          <div className={styles.checkpointCards}>
            {checkpointCards.map((card, index) => (
              <div
                className={styles.checkpointCard}
                key={`${card.cardId || checkpointStartIndex + index}-${
                  checkpointStartIndex + index
                }`}
              >
                <span>Card {checkpointStartIndex + index + 1}</span>
                <p>{getCleanQuestion(card.question)}</p>
              </div>
            ))}
          </div>

          <div className={styles.checkpointActions}>
            <button
              type="button"
              className={styles.repeatCardsBtn}
              onClick={repeatCheckpointCards}
            >
              Repeat Cards
            </button>

            <button
              type="button"
              className={styles.nextCardsBtn}
              onClick={continueAfterCheckpoint}
            >
              Next Cards
            </button>

            <button
              type="button"
              className={styles.doneCardsBtn}
              onClick={() => finishFlashcards(score, userResults, true)}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.flashcardInfo}>
            <h2 className={styles.deckTitle}>
              {isLessonMode
                ? lesson?.title || "Lesson Flashcards"
                : deck?.title || "Deck Flashcards"}
            </h2>

            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${((currentIndex + 1) / flashcards.length) * 100}%`,
                }}
              ></div>
            </div>

            <p className={styles.questionCount}>
              Question {currentIndex + 1} of {flashcards.length}
            </p>
          </div>

          <div className={styles.flashcardWrapper}>
            <div className={styles.tab}>
              <span className={styles.active}>
                {flipped ? "Answer" : "Question"}
              </span>

              <span onClick={() => setFlipped((prev) => !prev)}>Flip</span>
            </div>

            <div
              className={`${styles.flashcard} ${flipped ? styles.flipped : ""}`}
              onClick={() => setFlipped((prev) => !prev)}
            >
              <div className={styles.flashcardInner}>
                <div className={`${styles.flashcardFace} ${styles.front}`}>
                  {ttsEnabled && (
                    <button
                      type="button"
                      className={styles.audioIconBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakText(getCleanQuestion(currentCard.question));
                      }}
                    >
                      <PracticeSpeakerIcon />
                    </button>
                  )}

                  <div className={styles.flashcardContent}>
                    <p>{getCleanQuestion(currentCard.question)}</p>

                    {currentCard.image && (
                      <img
                        src={getCardImageSrc(currentCard.image)}
                        alt="Flashcard"
                        className={styles.flashcardImage}
                      />
                    )}
                  </div>
                </div>

                <div className={`${styles.flashcardFace} ${styles.back}`}>
                  {ttsEnabled && (
                    <button
                      type="button"
                      className={styles.audioIconBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakText(currentCard.answer);
                      }}
                    >
                      <PracticeSpeakerIcon />
                    </button>
                  )}

                  <p>{currentCard.answer}</p>
                </div>
              </div>

              <div className={styles.difficulty}>
                <button
                  className={styles.easy}
                  disabled={notifOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    loadNextCard("easy");
                  }}
                >
                  Easy
                </button>

                <button
                  className={styles.good}
                  disabled={notifOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    loadNextCard("good");
                  }}
                >
                  Good
                </button>

                <button
                  className={styles.hard}
                  disabled={notifOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    loadNextCard("hard");
                  }}
                >
                  Hard
                </button>
              </div>

              <p className={styles.difficultyHint}>
                Easy = mastered • Good = understood • Hard = needs review
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
