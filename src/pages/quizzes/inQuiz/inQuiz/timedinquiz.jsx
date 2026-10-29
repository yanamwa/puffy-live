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
import styles from "./timedinquiz.module.css";

function normalizeLessonData(data) {
  return data?.lesson || data?.data || data || {};
}

function getLessonQuizData(lessonData) {
  return (
    lessonData?.quiz_contents ||
    lessonData?.quiz_content ||
    lessonData?.quizContents ||
    lessonData?.questions ||
    []
  );
}

export default function TimedQuiz() {
  const routeNavigate = useNavigate();
  const navigate = (...args) => { clearPracticeProgress(); routeNavigate(...args); };
  const { lessonId, deckId } = useParams();

  const isLessonMode = Boolean(lessonId);
  const isDeckMode = Boolean(deckId);
  const practiceSession = useMemo(
    () => getStoredPracticeSession({ lessonId, deckId }),
    [lessonId, deckId],
  );

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Timed Quiz");
  const [questions, setQuestions] = usePracticeState("questions", [], true);

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(0.9);

  const [time, setTime] = usePracticeState("time", 0, true);

  const [questionIndex, setQuestionIndex] = usePracticeState("questionIndex", 0);
  const [score, setScore] = usePracticeState("score", 0);
  const [userResults, setUserResults] = usePracticeState("userResults", []);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [checkpointOpen, setCheckpointOpen] = usePracticeState("checkpointOpen", false);
  const [checkpointStartIndex, setCheckpointStartIndex] = usePracticeState("checkpointStartIndex", 0);
  const [checkpointReviewEndIndex, setCheckpointReviewEndIndex] = usePracticeState("checkpointReviewEndIndex", 0);

  const finishedRef = useRef(false);

  function shuffleArray(array) {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  function cleanQuestionText(text = "") {
    return String(text)
      .replace(/\s*A\..*/is, "")
      .trim();
  }

  function cleanAnswer(text = "") {
    return String(text)
      .toLowerCase()
      .replace(/^[a-d]\.\s*/i, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSameText(a, b) {
    return cleanAnswer(a) === cleanAnswer(b);
  }

  function getUniqueOptions(options) {
    const seen = new Set();

    return options.filter((opt) => {
      const clean = cleanAnswer(opt);

      if (!clean || seen.has(clean)) return false;

      seen.add(clean);
      return true;
    });
  }

  function extractOptionsFromQuestion(questionText = "") {
    const optionMatches = [
      ...String(questionText).matchAll(
        /([A-D])\.\s*(.*?)(?=\s+[A-D]\.\s+|$)/gi,
      ),
    ];

    return optionMatches.map((match) => match[2].trim()).filter(Boolean);
  }

  function parseJsonOptions(value) {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getSavedOptions(item) {
    return [
      ...parseJsonOptions(item.mc_wrong_options),
      ...(Array.isArray(item.options) ? item.options : []),
      ...(Array.isArray(item.choices) ? item.choices : []),
      item.option_a,
      item.option_b,
      item.option_c,
      item.option_d,
      item.choice_a,
      item.choice_b,
      item.choice_c,
      item.choice_d,
      item.wrong_option_1,
      item.wrong_option_2,
      item.wrong_option_3,
    ].filter(Boolean);
  }

  async function generateWrongOptions(question, correctAnswer, cardId = null) {
    try {
      const res = await fetch(`${API_BASE}/generate-options.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          question,
          correct_answer: correctAnswer,
          card_id: cardId,
        }),
      });

      const data = await res.json();

      if (!data.success || !Array.isArray(data.wrong_options)) {
        return {
          wrongOptions: [],
          explanation: "",
        };
      }

      const wrongOptions = getUniqueOptions(data.wrong_options)
        .filter((opt) => !isSameText(opt, correctAnswer))
        .filter((opt) => !["true", "false"].includes(cleanAnswer(opt)))
        .slice(0, 3);

      return {
        wrongOptions,
        explanation: data.explanation || "",
      };
    } catch (err) {
      console.error("Generate timed wrong options error:", err);

      return {
        wrongOptions: [],
        explanation: "",
      };
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        if (practiceSession) {
          setTitle(getPracticeTitle(practiceSession, "Timed Quiz"));

          const practiceQuestions = practiceSession.items
            .map((item) => {
              const rawQuestion = getQuizItemQuestion(item);
              const correctAnswer = getQuizItemAnswer(item);
              const extractedOptions = extractOptionsFromQuestion(rawQuestion);
              const rawOptions =
                extractedOptions.length > 0
                  ? extractedOptions
                  : [...getSavedOptions(item), correctAnswer].filter(Boolean);

              const questionText = cleanQuestionText(rawQuestion);
              const answerText = String(correctAnswer).trim().toLowerCase();
              const isTrueFalse =
                answerText === "true" ||
                answerText === "false" ||
                questionText.toLowerCase().includes("true or false");
              const options = isTrueFalse
                ? ["True", "False"]
                : getUniqueOptions([correctAnswer, ...rawOptions, ...(rawOptions.length < 2 ? practiceSession.items.map(getQuizItemAnswer) : [])]).slice(0, 4);

              if (!isTrueFalse && options.length < 2) return null;

              return {
                cardId: item.cardId || item.card_id || item.id || null,
                question: questionText,
                options: shuffleArray(options.filter(Boolean).map(String)),
                answer: String(correctAnswer),
                explanation: item.explanation || correctAnswer,
              };
            })
            .filter(Boolean);

          const shuffledQuestions = shuffleArray(practiceQuestions);
          const savedSeconds = Number(
            window.localStorage.getItem("timedQuizSeconds"),
          );

          setQuestions(shuffledQuestions);
          setTime(
            Number.isFinite(savedSeconds) && savedSeconds > 0
              ? savedSeconds
              : shuffledQuestions.length * 60,
          );
          return;
        }

        if (isLessonMode) {
          const res = await fetch(
            `${API_BASE}/getLessonsById.php?id=${lessonId}`,
            { credentials: "include" },
          );

          const lessonData = normalizeLessonData(await res.json());
          setTitle(lessonData?.title || "Lesson Timed Quiz");

          const rawQuiz = getLessonQuizData(lessonData);
          let parsed = [];

          try {
            parsed = Array.isArray(rawQuiz)
              ? rawQuiz
              : JSON.parse(String(rawQuiz || "[]"));
          } catch {
            parsed = [];
          }

          const lessonQuestions = parsed
            .map((item) => {
              const rawQuestion = item.question || "No question available.";

              const correctAnswer =
                item.correct_answer ||
                item.correctAnswer ||
                item.answer ||
                item.correct ||
                "";

              const extractedOptions = extractOptionsFromQuestion(rawQuestion);

              const rawOptions =
                extractedOptions.length > 0
                  ? extractedOptions
                  : [...getSavedOptions(item), correctAnswer].filter(Boolean);

              const questionText = cleanQuestionText(rawQuestion);
              const answerText = String(correctAnswer).trim().toLowerCase();

              const isTrueFalse =
                answerText === "true" ||
                answerText === "false" ||
                questionText.toLowerCase().includes("true or false");

              const options = isTrueFalse
                ? ["True", "False"]
                : getUniqueOptions([...rawOptions, correctAnswer]).slice(0, 4);

              if (!isTrueFalse && options.length < 2) return null;

              return {
                question: questionText,
                options: shuffleArray(options.filter(Boolean).map(String)),
                answer: String(correctAnswer),
                explanation: item.explanation || correctAnswer,
              };
            })
            .filter(Boolean);

          const shuffledQuestions = shuffleArray(lessonQuestions);

          setQuestions(shuffledQuestions);
          setTime(shuffledQuestions.length * 60);
        }

        if (isDeckMode) {
          const deckRes = await fetch(
            `${API_BASE}/getDeckById.php?deckId=${deckId}`,
            { credentials: "include" },
          );

          const deckData = await deckRes.json();

          const cardsRes = await fetch(
            `${API_BASE}/getCardsByDeck.php?deckId=${deckId}`,
            { credentials: "include" },
          );

          const cardsData = await cardsRes.json();
          const cards = cardsData.success ? cardsData.cards || [] : [];

          setTitle(
            deckData?.deck?.title ||
              deckData?.deck?.deck_title ||
              cardsData?.deck?.title ||
              cardsData?.deck_title ||
              "Deck Timed Quiz",
          );

          const deckQuestionsRaw = await Promise.all(
            cards.map(async (card) => {
              const rawQuestion = card.question || "";
              const correctAnswer = card.answer || "";
              const cardId = card.cardId || card.card_id || card.id || null;

              const extractedOptions = extractOptionsFromQuestion(rawQuestion);
              const savedOptions = getSavedOptions(card);

              const questionText = cleanQuestionText(rawQuestion);
              const answerText = String(correctAnswer).trim().toLowerCase();

              const isTrueFalse =
                answerText === "true" ||
                answerText === "false" ||
                questionText.toLowerCase().includes("true or false");

              let options = [];
              let explanation = card.mc_explanation || correctAnswer;

              if (isTrueFalse) {
                options = ["True", "False"];
              } else if (extractedOptions.length >= 4) {
                options = getUniqueOptions(extractedOptions).slice(0, 4);
              } else if (savedOptions.length >= 3) {
                options = shuffleArray(
                  getUniqueOptions([correctAnswer, ...savedOptions]),
                ).slice(0, 4);
              } else {
                const generated = await generateWrongOptions(
                  questionText,
                  correctAnswer,
                  cardId,
                );

                if (generated.wrongOptions.length < 1) {
                  return null;
                }

                explanation = generated.explanation || correctAnswer;

                options = shuffleArray(
                  getUniqueOptions([correctAnswer, ...generated.wrongOptions]),
                ).slice(0, 4);
              }

              if (!isTrueFalse && options.length < 2) return null;

              return {
                cardId,
                question: questionText,
                options: options.filter(Boolean).map(String),
                answer: String(correctAnswer),
                explanation,
              };
            }),
          );

          const deckQuestions = deckQuestionsRaw.filter(Boolean);
          const shuffledQuestions = shuffleArray(deckQuestions);

          setQuestions(shuffledQuestions);
          setTime(shuffledQuestions.length * 60);
        }
      } catch (error) {
        console.error("Error loading timed quiz:", error);
        setQuestions([]);
        setTime(0);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [lessonId, deckId, isLessonMode, isDeckMode, practiceSession]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (
      loading ||
      questions.length === 0 ||
      finishedRef.current ||
      checkpointOpen
    ) {
      return;
    }

    const timer = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishQuiz(score, userResults, "timeout");
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, questions.length, score, userResults, checkpointOpen]);

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

  async function handleAnswer(selectedAnswerValue) {
    const currentQuestion = questions[questionIndex];

    if (!currentQuestion || selectedAnswer !== null) return;

    window.speechSynthesis?.cancel();

    setSelectedAnswer(selectedAnswerValue);

    const isCorrect =
      cleanAnswer(selectedAnswerValue) === cleanAnswer(currentQuestion.answer);

    playPracticeFeedbackSound(isCorrect);
    const newResult = {
      cardId: currentQuestion.cardId || null,
      question: currentQuestion.question,
      userAnswer: selectedAnswerValue,
      correctAnswer: currentQuestion.answer,
      explanation: currentQuestion.explanation,
      isCorrect,
    };

    const updatedResults = [...userResults, newResult];
    const updatedScore = score + (isCorrect ? 1 : 0);

    setUserResults(updatedResults);
    setScore(updatedScore);

    await updateDeckCardMemorized(
      isDeckMode,
      currentQuestion.cardId,
      isCorrect,
      {
        question: currentQuestion.question,
        answer: currentQuestion.answer,
      },
    );

    setTimeout(() => {
      setSelectedAnswer(null);

      const completedCount = questionIndex + 1;
      const shouldShowCheckpoint =
        completedCount % 10 === 0 && completedCount < questions.length;

      if (shouldShowCheckpoint) {
        setCheckpointReviewEndIndex(completedCount);
        setCheckpointOpen(true);
        return;
      }

      if (completedCount < questions.length) {
        setQuestionIndex((prev) => prev + 1);
      } else {
        finishQuiz(updatedScore, updatedResults, "completed");
      }
    }, 500);
  }

  async function saveQuizAttempt(finalScore, finishReason) {
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
          quizMode: "timed",
          score: finalScore,
          total: questions.length,
          isTimedOut: finishReason === "timeout",
        }),
      });
    } catch (error) {
      console.error("Save attempt error:", error);
    }
  }

  async function finishQuiz(
    finalScore,
    finalResults,
    finishReason = "completed",
    returnToDeck = false,
  ) {
    if (finishedRef.current) return;

    finishedRef.current = true;
    window.speechSynthesis?.cancel();

    const resultPayload = {
      ...getPracticeResultMetadata(
        practiceSession,
        isDeckMode ? "deck" : "lesson",
      ),
      quizMode: "timed",
      finishReason,
      isTimedOut: finishReason === "timeout",
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

    localStorage.removeItem("timedQuizSeconds");

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
    setQuestionIndex(checkpointStartIndex);
    setSelectedAnswer(null);
    setCheckpointOpen(false);
  }

  function continueAfterCheckpoint() {
    setCheckpointStartIndex(checkpointReviewEndIndex);
    setQuestionIndex(checkpointReviewEndIndex);
    setSelectedAnswer(null);
    setCheckpointOpen(false);
  }

  if (loading) {
    return <LoadingState />;
  }

  if (questions.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <div className={styles.emptyCard}>
          <img
            src="/images/404.png"
            alt="No questions"
            className={styles.emptyImage}
          />

          <h2 className={styles.emptyTitle}>No Timed Quiz Yet</h2>

          <p className={styles.emptyText}>
            No valid timed quiz questions are available for this quiz yet.
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

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const progress = ((questionIndex + 1) / questions.length) * 100;
  const checkpointEndIndex = checkpointOpen
    ? checkpointReviewEndIndex
    : Math.min(questionIndex + 1, questions.length);
  const checkpointQuestions = questions.slice(
    checkpointStartIndex,
    checkpointEndIndex,
  );
  const checkpointProgress = questions.length
    ? (checkpointEndIndex / questions.length) * 100
    : 0;

  const isWarningTime = time <= 30;
  const isDangerTime = time <= 10;

  const timerClass = `${styles.timer} ${
    isDangerTime ? styles.dangerTimer : isWarningTime ? styles.warningTimer : ""
  }`;

  return (
    <div className={styles.page}>
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
                    <span>Read questions and choices aloud</span>
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
                <p>{item.question}</p>
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
              onClick={() => finishQuiz(score, userResults, "completed", true)}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.quizHeader}>
            <h1 className={styles.title}>{title}</h1>

            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className={styles.subtitle}>
              Question {questionIndex + 1} of {questions.length}
            </p>
          </div>

          <div className={styles.questionBox}>
            <div className={styles.timerBox}>
              <div className={timerClass}>
                {minutes}:{seconds.toString().padStart(2, "0")}
              </div>
            </div>

            <div className={styles.questionTextBox}>
              {ttsEnabled && (
                <button
                  type="button"
                  className={styles.audioIconBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                  onClick={() => speakText(questions[questionIndex].question)}
                >
                  <PracticeSpeakerIcon />
                </button>
              )}

              <p className={styles.question}>
                {questions[questionIndex].question}
              </p>
            </div>

            <div className={styles.options}>
              {questions[questionIndex].options.map((option, i) => {
                const letters = ["A", "B", "C", "D"];

                return (
                  <button
                    key={i}
                    className={`${styles.option} ${
                      selectedAnswer === option ? styles.selectedOption : ""
                    }`}
                    onClick={() => handleAnswer(option)}
                    disabled={selectedAnswer !== null}
                  >
                    {ttsEnabled && (
                      <span
                        className={styles.optionAudioIcon}
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(option);
                        }}
                      >
                        <PracticeSpeakerIcon />
                      </span>
                    )}

                    <span>
                      {letters[i]}. {String(option).replace(/^[A-D]\.\s*/i, "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
