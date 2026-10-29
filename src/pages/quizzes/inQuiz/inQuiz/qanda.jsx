import PracticeSpeakerIcon from "../../../../components/quizmodes/PracticeSpeakerIcon.jsx";
import TutorialBackButton from "../TutorialBackButton.jsx";
import { usePracticeState, usePracticeItems, clearPracticeProgress } from "../../../../utils/practiceResume.js";
import PracticeSoundControl from "../../../../components/quizmodes/PracticeSoundControl.jsx";
import PracticeAnswerFeedback from "../../../../components/quizmodes/PracticeAnswerFeedback.jsx";
import { playPracticeFeedbackSound } from "../../../../utils/practiceFeedbackSound.js";
import { lessonAuthHeaders } from "../../../../services/lessonAuth.js";
import { saveAccountQuizResult } from "../../../../utils/quizStorage.js";
import { useEffect, useMemo, useRef, useState } from "react";
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
import styles from "./qanda.module.css";

export default function QandA() {
  const routeNavigate = useNavigate();
  const navigate = (...args) => { clearPracticeProgress(); routeNavigate(...args); };
  const { lessonId, deckId } = useParams();

  const isLessonMode = Boolean(lessonId);
  const isDeckMode = Boolean(deckId);
  const practiceSession = useMemo(
    () => getStoredPracticeSession({ lessonId, deckId }),
    [lessonId, deckId],
  );

  const [lesson, setLesson] = usePracticeState("lesson", null, true);
  const [deckTitle, setDeckTitle] = useState("Deck Q&A");
  const [deckCards, setDeckCards] = usePracticeState("deckCards", [], true);
  const [loading, setLoading] = useState(true);

  const [current, setCurrent] = usePracticeState("current", 0);
  const [score, setScore] = usePracticeState("score", 0);
  const [inputValue, setInputValue] = usePracticeState("inputValue", "");
  const [status, setStatus] = useState("");
  const [userResults, setUserResults] = usePracticeState("userResults", []);
  const [checkpointOpen, setCheckpointOpen] = usePracticeState("checkpointOpen", false);
  const [checkpointStartIndex, setCheckpointStartIndex] = usePracticeState("checkpointStartIndex", 0);
  const [checkpointReviewEndIndex, setCheckpointReviewEndIndex] = usePracticeState("checkpointReviewEndIndex", 0);

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(0.9);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifImage, setNotifImage] = useState("/images/correct.png");

  const inputRef = useRef(null);

  const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

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

  const cleanQuestionText = (text = "") => {
    return String(text)
      .replace(/\s*A\..*/is, "")
      .trim();
  };

  const cleanAnswerText = (text = "") => {
    return String(text)
      .replace(/^Correct Answer:\s*/i, "")
      .replace(/^[A-D]\.\s*/i, "")
      .trim();
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        if (practiceSession) {
          if (isDeckMode) {
            setDeckTitle(getPracticeTitle(practiceSession, "Deck Q&A"));
            setDeckCards(practiceSession.items);
          } else {
            setLesson({
              title: getPracticeTitle(practiceSession, "Practice Q&A"),
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
          const deckRes = await fetch(
            `${API_BASE}/getDeckById.php?deckId=${deckId}`,
            { credentials: "include" },
          );
          const deckData = await deckRes.json();

          setDeckTitle(
            deckData?.deck?.title ||
              deckData?.deck?.deck_title ||
              deckData?.title ||
              "Deck Q&A",
          );

          const cardsRes = await fetch(
            `${API_BASE}/getCardsByDeck.php?deckId=${deckId}`,
            { credentials: "include" },
          );
          const cardsData = await cardsRes.json();

          setDeckCards(cardsData.success ? cardsData.cards || [] : []);
        }
      } catch (err) {
        console.error("Error loading Q&A:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [lessonId, deckId, isLessonMode, isDeckMode, practiceSession]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  const questions = usePracticeItems("questions", () => {
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
            q: cleanQuestionText(getQuizItemQuestion(item)),
            correctAnswer: cleanAnswerText(getQuizItemAnswer(item)),
            explanation: item.explanation || getQuizItemAnswer(item) || "",
          })),
        );
      } catch {
        return [];
      }
    }

    if (isDeckMode) {
      return shuffleArray(
        deckCards.map((card) => ({
          cardId: card.cardId || card.card_id || card.id || null,
          q: cleanQuestionText(getQuizItemQuestion(card)),
          correctAnswer: cleanAnswerText(getQuizItemAnswer(card)),
          explanation: getQuizItemAnswer(card) || "",
        })),
      );
    }

    return [];
  }, [lesson, deckCards, isLessonMode, isDeckMode]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [current]);

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

  const cleanAnswer = (text = "") =>
    String(text)
      .toLowerCase()
      .replace(/`/g, "")
      .replace(/\bcant\b/g, "cannot")
      .replace(/\bcan't\b/g, "cannot")
      .replace(/\ba\b/g, "")
      .replace(/\ban\b/g, "")
      .replace(/\bthe\b/g, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const levenshtein = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, () =>
      Array(b.length + 1).fill(0),
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }

    return dp[a.length][b.length];
  };

  const isCloseEnough = (userAnswer, correctAnswer) => {
    const userClean = cleanAnswer(userAnswer);
    const correctClean = cleanAnswer(correctAnswer);

    if (!userClean || !correctClean) return false;

    if (userClean === correctClean) return true;

    // exact phrase contained
    if (correctClean.includes(userClean) && userClean.length >= 8) {
      return true;
    }

    const userWords = userClean.split(" ").filter(Boolean);
    const correctWords = correctClean.split(" ").filter(Boolean);

    const matchingWords = userWords.filter((word) =>
      correctWords.includes(word),
    );

    const wordRatio =
      matchingWords.length / Math.max(userWords.length, correctWords.length);

    // enough important words matched
    if (matchingWords.length >= 3 && wordRatio >= 0.35) {
      return true;
    }

    const distance = levenshtein(userClean, correctClean);

    const maxLength = Math.max(userClean.length, correctClean.length);

    const similarity = 1 - distance / maxLength;

    return similarity >= 0.75;
  };

  async function saveQuizAttempt(finalScore) {
    const metadata = getPracticeResultMetadata(
      practiceSession,
      isDeckMode ? "deck" : "lesson",
    );

    try {
      await fetch(`${API_BASE}/saveQuizAttempt.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...lessonAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          source: metadata.source,
          lessonId: toNumericId(lessonId),
          deckId: toNumericId(deckId),
          courseId: metadata.courseId,
          quizMode: "qna",
          score: finalScore,
          total: questions.length,
          isTimedOut: false,
        }),
      });
    } catch (error) {
      console.error("Save attempt error:", error);
    }
  }

  async function finishQuiz(finalScore, finalResults, returnToDeck = false) {
    const resultPayload = {
      ...getPracticeResultMetadata(
        practiceSession,
        isDeckMode ? "deck" : "lesson",
      ),
      quizMode: "qna",
      deckId: toNumericId(deckId),
      lessonId: lessonId || null,
      score: finalScore,
      total: questions.length,
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
  }

  function repeatCheckpointQuestions() {
    const repeatedResults = userResults.slice(0, checkpointStartIndex);
    const repeatedScore = repeatedResults.filter(
      (result) => result.isCorrect,
    ).length;

    setUserResults(repeatedResults);
    setScore(repeatedScore);
    setCurrent(checkpointStartIndex);
    setInputValue("");
    setStatus("");
    setCheckpointOpen(false);
  }

  function continueAfterCheckpoint() {
    setCheckpointStartIndex(checkpointReviewEndIndex);
    setCurrent(checkpointReviewEndIndex);
    setInputValue("");
    setStatus("");
    setCheckpointOpen(false);
  }

  async function checkAnswer() {
    if (!questions[current] || notifOpen || !inputValue.trim()) return;

    window.speechSynthesis?.cancel();

    const isCorrect = isCloseEnough(
      inputValue,
      questions[current].correctAnswer,
    );

    playPracticeFeedbackSound(isCorrect);
    setNotifImage(
      isCorrect ? "/images/correct.png" : "/images/wrong.png",
    );
    setNotifOpen(true);

    const newResult = {
      cardId: questions[current].cardId || null,
      question: questions[current].q,
      userAnswer: inputValue,
      correctAnswer: questions[current].correctAnswer,
      explanation: questions[current].explanation,
      isCorrect,
    };

    const updatedResults = [...userResults, newResult];
    const updatedScore = score + (isCorrect ? 1 : 0);

    setUserResults(updatedResults);
    setScore(updatedScore);
    setStatus(isCorrect ? styles.correct : styles.wrong);

    await updateDeckCardMemorized(
      isDeckMode,
      questions[current].cardId,
      isCorrect,
      {
        question: questions[current].q,
        answer: questions[current].correctAnswer,
      },
    );

    setTimeout(() => {
      setNotifOpen(false);
      nextQuestion(updatedScore, updatedResults);
    }, 1100);
  }

  async function nextQuestion(updatedScore, updatedResults) {
    const completedCount = current + 1;
    const shouldShowCheckpoint =
      completedCount % 10 === 0 && completedCount < questions.length;

    if (shouldShowCheckpoint) {
      setCheckpointReviewEndIndex(completedCount);
      setInputValue("");
      setStatus("");
      setCheckpointOpen(true);
      return;
    }

    if (completedCount < questions.length) {
      setCurrent((prev) => prev + 1);
      setInputValue("");
      setStatus("");
      return;
    }

    await finishQuiz(updatedScore, updatedResults);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && inputValue.trim() !== "") {
      checkAnswer();
    }
  }

  if (loading) return <LoadingState />;

  if (questions.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <div className={styles.emptyCard}>
          <img
            src="/images/404.png"
            alt="No Q&A"
            className={styles.emptyImage}
          />

          <h2 className={styles.emptyTitle}>No Q&A Quiz Yet</h2>

          <p className={styles.emptyText}>
            No Q&A questions are available for this lesson.
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
  const progressWidth = ((current + 1) / questions.length) * 100;
  const checkpointEndIndex = checkpointOpen
    ? checkpointReviewEndIndex
    : Math.min(current + 1, questions.length);
  const checkpointQuestions = questions.slice(
    checkpointStartIndex,
    checkpointEndIndex,
  );
  const checkpointProgress = questions.length
    ? (checkpointEndIndex / questions.length) * 100
    : 0;

  return (
    <div className={styles.wrapper}>
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
                    <span>Read questions aloud</span>
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

      {checkpointOpen ? (
        <div className={styles.checkpointWrapper}>
          <div className={styles.checkpointHeader}>
            <span className={styles.checkpointEyebrow}>The previous cards</span>
            <h2>Review Complete</h2>

            <div className={styles.checkpointProgressBar}>
              <div
                className={styles.checkpointProgressFill}
                style={{ width: `${checkpointProgress}%` }}
              />
            </div>

            <p className={styles.checkpointQuestionCount}>
              {checkpointEndIndex} of {questions.length} cards reviewed
            </p>
          </div>

          <div className={styles.checkpointCards}>
            {checkpointQuestions.map((item, index) => (
              <div
                className={styles.checkpointCard}
                key={`${item.cardId || checkpointStartIndex + index}-${
                  checkpointStartIndex + index
                }`}
              >
                <span>Card {checkpointStartIndex + index + 1}</span>
                <p>{item.q}</p>
              </div>
            ))}
          </div>

          <div className={styles.checkpointActions}>
            <button
              type="button"
              className={styles.repeatCardsBtn}
              onClick={repeatCheckpointQuestions}
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
              onClick={() => finishQuiz(score, userResults, true)}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h1 className={styles.title}>
              {isLessonMode ? lesson?.title || "Lesson Q&A" : deckTitle}
            </h1>

            <div className={styles.counter}>
              Question {current + 1} of {questions.length}
            </div>

            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>

          <div className={styles.questionBox}>
            <div className={styles.questionRow}>
              {ttsEnabled && (
                <button
                  type="button"
                  className={styles.audioIconBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                  onClick={() => speakText(questions[current].q)}
                >
                  <PracticeSpeakerIcon />
                </button>
              )}

              <p className={styles.question}>{questions[current].q}</p>
            </div>

            <div className={styles.typingContainer}>
              <input
                ref={inputRef}
                type="text"
                className={`${styles.input} ${status}`}
                placeholder="Type your answer"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={notifOpen}
              />
              <button
                type="button"
                className={styles.submitAnswer}
                onClick={checkAnswer}
                disabled={notifOpen || !inputValue.trim()}
              >
                Submit Answer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
