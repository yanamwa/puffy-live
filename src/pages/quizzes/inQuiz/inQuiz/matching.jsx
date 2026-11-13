import PracticeSpeakerIcon from "../../../../components/quizmodes/PracticeSpeakerIcon.jsx";
import TutorialBackButton from "../TutorialBackButton.jsx";
import { practiceAnswersMatch } from "../../../../services/adaptivePractice.js";
import { usePracticeState, usePracticeItems, clearPracticeProgress } from "../../../../utils/practiceResume.js";
import PracticeSoundControl from "../../../../components/quizmodes/PracticeSoundControl.jsx";
import PracticeAnswerFeedback from "../../../../components/quizmodes/PracticeAnswerFeedback.jsx";
import { playPracticeFeedbackSound } from "../../../../utils/practiceFeedbackSound.js";
import { saveAccountQuizResult } from "../../../../utils/quizStorage.js";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../../../../config.js";
import { updateDeckCardMemorized } from "../../../../utils/cardMemorization.js";
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
import styles from "./matching.module.css";

const PAIRS_PER_SET = 5;

export default function MatchingType({ adaptivePractice } = {}) {
  const routeNavigate = useNavigate();
  const navigate = (...args) => { clearPracticeProgress(); routeNavigate(...args); };
  const { lessonId: routeLessonId, deckId } = useParams();
  const lessonId = adaptivePractice?.session.lessonId || routeLessonId;

  const isLessonMode = Boolean(lessonId);
  const isDeckMode = Boolean(deckId);
  const practiceSession = useMemo(
    () => adaptivePractice?.session || getStoredPracticeSession({ lessonId, deckId }),
    [adaptivePractice?.session, lessonId, deckId],
  );

  const [lesson, setLesson] = usePracticeState("lesson", null, true);
  const [firstCard, setFirstCard] = useState(null);
  const [matchedIds, setMatchedIds] = usePracticeState("matchedIds", []);
  const [wrongPair, setWrongPair] = useState([]);
  const [checkpointStartIndex, setCheckpointStartIndex] = usePracticeState("checkpointStartIndex", 0);
  const [firstAttempts, setFirstAttempts] = usePracticeState("firstAttempts", {});
  const clickPending = useRef(false);

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(0.9);

  const cleanQuestionText = (text = "") => {
    return String(text)
      .replace(/\s*A\..*/is, "")
      .trim();
  };

  const cleanAnswerText = (text = "") => {
    const raw = String(text).trim();

    const match = raw.match(/Correct Answer:\s*(.+)$/i);
    if (match) return match[1].trim();

    return raw.replace(/^[A-D]\.\s*/i, "").trim();
  };

  const shuffleArray = (array) => {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  };

  const normalizeLessonData = (data) => {
    if (!data) return null;
    return data.lesson || data.data || data;
  };

  useEffect(() => {
    const loadMatchingData = async () => {
      try {
        if (practiceSession) {
          setLesson({
            title: getPracticeTitle(practiceSession, "Matching Quiz"),
            quiz_contents: practiceSession.items,
            cards: practiceSession.items,
          });
          return;
        }

        if (isLessonMode) {
          const res = await fetch(
            `${API_BASE}/getLessonsById.php?id=${lessonId}`,
            { credentials: "include" },
          );

          const data = normalizeLessonData(await res.json());

          setLesson({
            ...data,
            title: data?.title || "Matching Quiz",
          });

          return;
        }

        if (isDeckMode) {
          const deckRes = await fetch(
            `${API_BASE}/getDeckById.php?deckId=${deckId}`,
            { credentials: "include" },
          );

          const deckData = await deckRes.json();
          console.log("LOADED DECK DATA:", deckData);

          const cardsRes = await fetch(
            `${API_BASE}/getCardsByDeck.php?deckId=${deckId}`,
            { credentials: "include" },
          );

          const cardsData = await cardsRes.json();
          console.log("LOADED DECK CARDS:", cardsData);

          const deckInfo = deckData.success ? deckData.deck || {} : {};
          const cards = cardsData.success ? cardsData.cards || [] : [];

          setLesson({
            ...deckInfo,
            title:
              deckInfo.title ||
              deckInfo.deck_title ||
              deckData.title ||
              deckData.deck_title ||
              "Deck Matching Quiz",
            cards,
          });
        }
      } catch (err) {
        console.error("Error loading matching quiz:", err);
      }
    };

    loadMatchingData();
  }, [lessonId, deckId, isLessonMode, isDeckMode, practiceSession]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

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

  const matchingPairs = usePracticeItems("matchingPairs", () => {
    if (!lesson) return [];

    let rawQuiz =
      lesson.quiz_contents ||
      lesson.quiz_content ||
      lesson.quiz ||
      lesson.questions ||
      lesson.cards ||
      lesson.flashcards ||
      lesson.deck_cards ||
      lesson.items;

    if (!rawQuiz) return [];

    try {
      const parsed =
        typeof rawQuiz === "string" ? JSON.parse(rawQuiz) : rawQuiz;

      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((item, index) => {
          const question =
            getQuizItemQuestion(item, "") ||
            item.question ||
            item.front ||
            item.term ||
            item.prompt ||
            item.title ||
            "";

          const answer =
            getQuizItemAnswer(item, "") ||
            item.answer ||
            item.back ||
            item.definition ||
            item.correct_answer ||
            item.correctAnswer ||
            item.description ||
            "";

          return {
            id: `pair-${index}`,
            cardId: item.cardId || item.card_id || item.id || index + 1,
            question: adaptivePractice ? question : cleanQuestionText(question),
            answer: adaptivePractice ? answer : cleanAnswerText(answer),
          };
        })
        .filter((item) => item.question && item.answer);
    } catch (error) {
      console.error("Invalid matching data:", error);
      return [];
    }
  }, [lesson]);

  const roundPairs = useMemo(
    () => matchingPairs.slice(checkpointStartIndex, checkpointStartIndex + PAIRS_PER_SET),
    [matchingPairs, checkpointStartIndex],
  );
  const roundEndIndex = checkpointStartIndex + roundPairs.length;
  const roundAnswered = roundPairs.filter((item) => matchedIds.includes(item.id)).length;
  const checkpointOpen = roundPairs.length > 0 && roundAnswered === roundPairs.length;
  const roundScore = roundPairs.filter(
    (item) => firstAttempts[item.id]?.isCorrect,
  ).length;
  const isLastRound = roundEndIndex >= matchingPairs.length;

  const leftCards = useMemo(() => {
    return shuffleArray(
      roundPairs.map((item) => ({
        id: item.id,
        text: item.question,
      })),
    );
  }, [roundPairs]);

  const rightCards = useMemo(() => {
    return shuffleArray(
      roundPairs.map((item) => ({
        id: item.id,
        text: item.answer,
      })),
    );
  }, [roundPairs]);

  const progressCurrent =
    matchingPairs.length > 0
      ? Math.round((matchedIds.length / matchingPairs.length) * 100)
      : 0;

  const getAttempt = (card, side) =>
    side === "left"
      ? firstAttempts[card.id]
      : roundPairs
          .map((pair) => firstAttempts[pair.id])
          .find((attempt) => attempt?.rightId === card.id);
  const isWrongCard = (card, side) => getAttempt(card, side)?.isCorrect === false;

  const getMatchingAnswers = (completedIds) => {
    const completedSet = completedIds ? new Set(completedIds) : null;
    return matchingPairs
      .filter((item) => !completedSet || completedSet.has(item.id))
      .map((item) => ({
        cardId: item.cardId,
        question: item.question,
        userAnswer: firstAttempts[item.id]?.answer || item.answer,
        correctAnswer: item.answer,
        explanation: item.answer,
        isCorrect: Boolean(firstAttempts[item.id]?.isCorrect),
      }));
  };

  const saveMatchingResult = (finalScore, completedIds = null) => {
    const resultPayload = {
      ...getPracticeResultMetadata(practiceSession, isDeckMode ? "deck" : "lesson"),
      quizMode: "matching",
      lessonId: lessonId || null,
      deckId: toNumericId(deckId),
      score: finalScore,
      total: matchingPairs.length,
      answers: getMatchingAnswers(completedIds),
    };

    saveAccountQuizResult("lessonQuizResults", JSON.stringify(resultPayload));

    if (isDeckMode) {
      saveAccountQuizResult(
        `deckQuizResults_${deckId}`,
        JSON.stringify(resultPayload),
      );
    }
  };

  const finishMatching = (
    finalMatchedIds = matchedIds,
    returnToDeck = false,
  ) => {
    if (adaptivePractice) return adaptivePractice.onFinish(getMatchingAnswers(finalMatchedIds));
    const finalScore = matchingPairs.filter(
      (item) =>
        finalMatchedIds.includes(item.id) && firstAttempts[item.id]?.isCorrect,
    ).length;
    saveMatchingResult(finalScore, finalMatchedIds);

    setTimeout(() => {
      navigate(
        returnToDeck && isDeckMode
          ? `/deck/${deckId}`
          : isDeckMode
            ? `/review/deck/${deckId}`
            : getPracticeReviewPath(practiceSession, { lessonId, deckId }),
      );
    }, 300);
  };

  const repeatCheckpointPairs = () => {
    const roundIds = new Set(roundPairs.map((item) => item.id));
    setMatchedIds((prev) => prev.filter((id) => !roundIds.has(id)));
    setFirstAttempts((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => !roundIds.has(id)),
      ),
    );
    setFirstCard(null);
    setWrongPair([]);
  };

  const continueAfterCheckpoint = () => {
    setCheckpointStartIndex(roundEndIndex);
    setFirstCard(null);
    setWrongPair([]);
  };

  const handleCardClick = async (card, side) => {
    if (
      checkpointOpen ||
      clickPending.current ||
      wrongPair.length ||
      getAttempt(card, side)
    )
      return;
    if (!firstCard || firstCard.side === side) {
      setFirstCard({ ...card, side });
      return;
    }
    const questionCard = side === "left" ? card : firstCard;
    const answerCard = side === "right" ? card : firstCard;
    const expected = roundPairs.find((item) => item.id === questionCard.id);
    const isCorrect = adaptivePractice
      ? practiceAnswersMatch(expected.answer, answerCard.text)
      : questionCard.id === answerCard.id;
    playPracticeFeedbackSound(isCorrect);
    setFirstAttempts((prev) =>
      prev[questionCard.id]
        ? prev
        : {
            ...prev,
            [questionCard.id]: { isCorrect, answer: answerCard.text, rightId: answerCard.id },
          },
    );
    if (isCorrect) {
      clickPending.current = true;
      try {
        await updateDeckCardMemorized(isDeckMode, expected.cardId, true, {
          question: expected.question,
          answer: expected.answer,
        });
        const updated = [...matchedIds, questionCard.id];
        setMatchedIds(updated);
        setFirstCard(null);
      } finally {
        clickPending.current = false;
      }
    } else {
      const updated = [...matchedIds, questionCard.id];
      setMatchedIds(updated);
      setFirstCard(null);
    }
  };

  if (!lesson) {
    return <LoadingState />;
  }

  if (matchingPairs.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <div className={styles.emptyCard}>
          <img
            src="/images/404.png"
            alt="No matching"
            className={styles.emptyImage}
          />

          <h2 className={styles.emptyTitle}>No Matching Quiz Yet</h2>

          <p className={styles.emptyText}>
            No matching quiz questions are available for this lesson.
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
    <div className={styles.wrapper}>
      <div className="practice-course-back"><TutorialBackButton onBack={adaptivePractice?.onBack} /></div>
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
                    <span>Read cards aloud</span>
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
                    window.speechSynthesis?.cancel();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {checkpointOpen && (
        <div className={styles.roundOverlay}>
          <section
            className={styles.roundModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="matching-round-title"
          >
            <h2 id="matching-round-title">
              {isLastRound ? "Matching Quiz Complete" : "Set Complete"}
            </h2>
            <div className={styles.roundStats}>
              <div className={styles.correctStat}>
                <span className={styles.statIcon} aria-hidden="true">
                  ✓
                </span>
                <strong>{roundScore}</strong>
                <span>Correct answers</span>
              </div>
              <div className={styles.incorrectStat}>
                <span className={styles.statIcon} aria-hidden="true">
                  ×
                </span>
                <strong>{roundPairs.length - roundScore}</strong>
                <span>Incorrect answers</span>
              </div>
            </div>
            <p className={styles.remainingCards}>
              Remaining cards:{" "}
              <strong>{matchingPairs.length - roundEndIndex}</strong>
            </p>
            <p className={styles.scoringNote}>
              Based on your first attempt for each question.
            </p>
            <div className={styles.checkpointActions}>
              <button
                type="button"
                className={styles.repeatCardsBtn}
                onClick={repeatCheckpointPairs}
              >
                Repeat Cards
              </button>
              <button
                autoFocus
                type="button"
                className={styles.nextCardsBtn}
                onClick={
                  isLastRound ? () => finishMatching(matchedIds) : continueAfterCheckpoint
                }
              >
                {isLastRound ? "Done" : "Continue"}
              </button>
            </div>
          </section>
        </div>
      )}
      <div className={styles.paperBackground}>
        <header className={styles.siteHeader}>
          <h1 className={styles.courseTitle}>
            {lesson.title || "Matching Quiz"}
          </h1>
          <p>
            Set {Math.floor(checkpointStartIndex / PAIRS_PER_SET) + 1} ·{" "}
            {roundPairs.length} questions ·{" "}
            {roundAnswered}/{roundPairs.length} answered
          </p>
        </header>

        <main className={styles.quizAppContainer}>
          <div className={styles.matchingWrapper}>
            <table>
              <tbody>
                {leftCards.map((card) => (
                  <tr key={`left-${card.id}`}>
                    <td>
                      <div
                        className={`${styles.card} ${
                          firstAttempts[card.id]?.isCorrect ? styles.matched : ""
                        } ${
                          firstCard?.id === card.id &&
                          firstCard?.side === "left"
                            ? styles.selected
                            : ""
                        } ${
                          isWrongCard(card, "left") ? styles.wrongShake : ""
                        }`}
                        onClick={() => handleCardClick(card, "left")}
                      >
                        {ttsEnabled && (
                          <button
                            type="button"
                            className={styles.cardAudioBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(card.text);
                            }}
                          >
                            <PracticeSpeakerIcon />
                          </button>
                        )}

                        <span>{card.text}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table>
              <tbody>
                {rightCards.map((card) => (
                  <tr key={`right-${card.id}`}>
                    <td>
                      <div
                        className={`${styles.card} ${
                          firstAttempts[card.id]?.isCorrect ? styles.matched : ""
                        } ${
                          firstCard?.id === card.id &&
                          firstCard?.side === "right"
                            ? styles.selected
                            : ""
                        } ${
                          isWrongCard(card, "right") ? styles.wrongShake : ""
                        }`}
                        onClick={() => handleCardClick(card, "right")}
                      >
                        {ttsEnabled && (
                          <button
                            type="button"
                            className={styles.cardAudioBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(card.text);
                            }}
                          >
                            <PracticeSpeakerIcon />
                          </button>
                        )}

                        <span>{card.text}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
