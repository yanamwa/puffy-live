import PracticeSpeakerIcon from "../../../../components/quizmodes/PracticeSpeakerIcon.jsx";
import TutorialBackButton from "../TutorialBackButton.jsx";
import { usePracticeState, usePracticeItems, clearPracticeProgress } from "../../../../utils/practiceResume.js";
import PracticeSoundControl from "../../../../components/quizmodes/PracticeSoundControl.jsx";
import PracticeAnswerFeedback from "../../../../components/quizmodes/PracticeAnswerFeedback.jsx";
import { playPracticeFeedbackSound } from "../../../../utils/practiceFeedbackSound.js";
import Swal from "sweetalert2";
import { lessonAuthHeaders } from "../../../../services/lessonAuth.js";
import { saveAccountQuizResult } from "../../../../utils/quizStorage.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../../../../config.js";
import LoadingState from "../../../../components/LoadingState.jsx";
import {
  getPracticeBackPath,
  getPracticeResultMetadata,
  getPracticeReviewPath,
  getQuizItemAnswer,
  getQuizItemQuestion,
  getStoredPracticeSession,
  toNumericId,
} from "../practiceSession.js";
import styles from "./randommodes.module.css";

const MIXED_MODE_TITLE = "Mixed Mode";
const MIXED_MODE_DESCRIPTION =
  "Practice with matching type, multiple choice, and Q&A all at once.";

function normalizeLessonData(data) {
  return data?.lesson || data?.data || data || {};
}

function getLessonQuizData(lessonData) {
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
}

function shuffleArray(array) {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function cleanChoiceText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/^[a-d]\.\s*/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuestionText(text = "") {
  return String(text)
    .replace(/\s*A\..*/is, "")
    .trim();
}

function cleanAnswerText(text = "") {
  return String(text)
    .replace(/^Correct Answer:\s*/i, "")
    .replace(/^[A-D]\.\s*/i, "")
    .trim();
}

function cleanTypingAnswer(text = "") {
  return String(text)
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
}

function levenshtein(a, b) {
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
}

function isCloseEnough(userAnswer, correctAnswer) {
  const userClean = cleanTypingAnswer(userAnswer);
  const correctClean = cleanTypingAnswer(correctAnswer);

  if (!userClean || !correctClean) return false;
  if (userClean === correctClean) return true;

  if (correctClean.includes(userClean) && userClean.length >= 8) {
    return true;
  }

  const userWords = userClean.split(" ").filter(Boolean);
  const correctWords = correctClean.split(" ").filter(Boolean);
  const matchingWords = userWords.filter((word) => correctWords.includes(word));
  const wordRatio =
    matchingWords.length / Math.max(userWords.length, correctWords.length);

  if (matchingWords.length >= 3 && wordRatio >= 0.35) {
    return true;
  }

  const distance = levenshtein(userClean, correctClean);
  const maxLength = Math.max(userClean.length, correctClean.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= 0.75;
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

function extractOptionsFromQuestion(questionText = "") {
  const optionMatches = [
    ...String(questionText).matchAll(/([A-D])\.\s*(.*?)(?=\s+[A-D]\.\s+|$)/gi),
  ];

  return optionMatches.map((match) => match[2].trim()).filter(Boolean);
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

function getUniqueOptions(options) {
  const seen = new Set();

  return options.filter((option) => {
    const key = cleanChoiceText(option);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function normalizeBaseMixedItem(item, index) {
  const rawQuestion = getQuizItemQuestion(item);
  const question = cleanQuestionText(rawQuestion);
  const answer = cleanAnswerText(getQuizItemAnswer(item));
  const extractedOptions = extractOptionsFromQuestion(rawQuestion);
  const answerKey = cleanChoiceText(answer);
  const rawOptions =
    extractedOptions.length > 0
      ? extractedOptions
      : [...getSavedOptions(item), answer].filter(Boolean);
  const isTrueFalse =
    answerKey === "true" ||
    answerKey === "false" ||
    question.toLowerCase().includes("true or false");
  const options = isTrueFalse
    ? ["True", "False"]
    : getUniqueOptions([answer, ...rawOptions]).slice(0, 4);

  if (!question || !answer) return null;

  return {
    id: item.cardId || item.card_id || item.id || index + 1,
    question,
    answer,
    answerKey,
    options,
    explanation: item.explanation || answer,
  };
}

function getOtherAnswerOptions(item, allItems) {
  return shuffleArray(
    allItems
      .filter((optionItem) => optionItem.id !== item.id)
      .map((optionItem) => optionItem.answer)
      .filter((answer) => cleanChoiceText(answer) !== item.answerKey),
  );
}

function buildMultipleChoiceRound(item, allItems) {
  const options =
    item.options.length >= 2
      ? item.options
      : getUniqueOptions([
          item.answer,
          ...getOtherAnswerOptions(item, allItems),
        ]).slice(0, 4);

  if (options.length < 2) return null;

  const shuffledOptions = shuffleArray(options.map(String));

  return {
    id: `multiple-${item.id}`,
    cardId: item.id,
    type: "multiple",
    question: item.question,
    options: shuffledOptions,
    answer: item.answer,
    correct: shuffledOptions.findIndex(
      (option) => cleanChoiceText(option) === item.answerKey,
    ),
    explanation: item.explanation,
  };
}

function buildQandARound(item) {
  return {
    id: `qna-${item.id}`,
    cardId: item.id,
    type: "qna",
    question: item.question,
    answer: item.answer,
    explanation: item.explanation,
  };
}

function buildMatchingRounds(items) {
  const shuffledItems = shuffleArray(items);
  const rounds = [];
  const roundSize = 4;

  for (let index = 0; index < shuffledItems.length; index += roundSize) {
    const pairs = shuffledItems.slice(index, index + roundSize);

    if (pairs.length >= 2) {
      rounds.push({
        id: `matching-${index}`,
        type: "matching",
        question: "Match each card with its correct answer.",
        pairs,
      });
    }
  }

  return rounds;
}

function buildMixedQuestions(items) {
  const sourceItems = Array.isArray(items) ? items : [];
  const baseItems = sourceItems.map(normalizeBaseMixedItem).filter(Boolean);
  const recallRounds = baseItems.flatMap((item) =>
    [buildMultipleChoiceRound(item, baseItems), buildQandARound(item)].filter(
      Boolean,
    ),
  );
  const matchingRounds = buildMatchingRounds(baseItems);

  return shuffleArray([...recallRounds, ...matchingRounds]);
}

function getQuestionTypeLabel(type) {
  const labels = {
    multiple: "Multiple Choice",
    matching: "Matching Type",
    qna: "Q&A",
  };

  return labels[type] || "Mixed";
}

function getRoundPoints(question) {
  return question?.type === "matching" ? question.pairs.length : 1;
}

function getTotalPoints(questions) {
  return questions.reduce(
    (total, question) => total + getRoundPoints(question),
    0,
  );
}

function getReviewAnswer(question, userAnswer, isCorrect) {
  return {
    cardId: question.cardId || null,
    question: question.question,
    userAnswer,
    correctAnswer: question.answer,
    explanation: question.explanation || question.answer,
    quizType: question.type,
    isCorrect,
  };
}

export default function MixedMode() {
  const routeNavigate = useNavigate();
  const navigate = (...args) => { clearPracticeProgress(); routeNavigate(...args); };
  const { lessonId, deckId } = useParams();
  const isLessonMode = Boolean(lessonId);
  const isDeckMode = Boolean(deckId);
  const practiceSession = useMemo(
    () => getStoredPracticeSession({ lessonId, deckId }),
    [lessonId, deckId],
  );

  const isMainQuiz = practiceSession?.scope?.scopeType === "main_quiz";
  const mainQuizId = useRef(null);
  const [mainSubmitting, setMainSubmitting] = useState(false);
  const submitPending = useRef(false);

  const [questions, setQuestions] = usePracticeState("questions", [], true);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = usePracticeState("current", 0);
  const [score, setScore] = usePracticeState("score", 0);
  const [typingAnswer, setTypingAnswer] = usePracticeState("typingAnswer", "");
  const [answers, setAnswers] = usePracticeState("answers", []);
  const [locked, setLocked] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [status, setStatus] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifImage, setNotifImage] = useState("/images/correct.png");
  const [firstCard, setFirstCard] = useState(null);
  const [matchedIds, setMatchedIds] = usePracticeState("matchedIds", []);
  const [wrongPair, setWrongPair] = useState([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(0.9);

  const inputRef = useRef(null);

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);

      try {
        if (practiceSession) {
          if (isMainQuiz) {
            const response = await fetch(
              `${API_BASE}/lessons/main-quiz/start`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  ...lessonAuthHeaders(),
                },
                body: JSON.stringify({
                  course_id: Number(practiceSession.scope.courseId),
                  module_id: practiceSession.scope.scopeId,
                }),
              },
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
              await Swal.fire({
                icon: "info",
                title: "Main Quiz",
                text: data.message,
                confirmButtonText: "OK",
              });
              navigate(
                `/student/enrolled-courses/${practiceSession.scope.courseId}`,
                { replace: true },
              );
              return;
            }
            mainQuizId.current = data.quiz.quizId;
            setQuestions(
              data.quiz.questions.map((item, index) => ({
                id: index,
                type: item.type === "identification" ? "qna" : "multiple",
                question: item.question,
                options: item.options,
                answer: "",
                correct: -1,
              })),
            );
          } else {
            setQuestions(buildMixedQuestions(practiceSession.items));
          }
          return;
        }

        if (isLessonMode) {
          const response = await fetch(
            `${API_BASE}/getLessonsById.php?id=${lessonId}`,
            { credentials: "include" },
          );
          const lessonData = normalizeLessonData(await response.json());
          const rawQuiz = getLessonQuizData(lessonData);
          const parsed = Array.isArray(rawQuiz)
            ? rawQuiz
            : JSON.parse(String(rawQuiz || "[]"));

          setQuestions(buildMixedQuestions(parsed));
        }

        if (isDeckMode) {
          const cardsResponse = await fetch(
            `${API_BASE}/getCardsByDeck.php?deckId=${deckId}`,
            { credentials: "include" },
          );
          const cardsData = await cardsResponse.json();
          const cards = cardsData.success ? cardsData.cards || [] : [];

          setQuestions(buildMixedQuestions(cards));
        }
      } catch (error) {
        console.error("Error loading mixed mode:", error);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [lessonId, deckId, isLessonMode, isDeckMode, practiceSession]);

  const previousRound = useRef(current);
  useEffect(() => {
    if (previousRound.current === current) return;
    previousRound.current = current;
    setTypingAnswer(isMainQuiz ? answers[current]?.userAnswer || "" : "");
    setLocked(false);
    setSelectedAnswer(null);
    setStatus("");
    setNotifOpen(false);
    setFirstCard(null);
    setMatchedIds([]);
    setWrongPair([]);
    inputRef.current?.focus();
  }, [current]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  const question = questions[current];
  const totalPoints = getTotalPoints(questions);
  const progress = questions.length
    ? ((current + 1) / questions.length) * 100
    : 0;

  const leftCards = useMemo(() => {
    if (question?.type !== "matching") return [];

    return shuffleArray(
      question.pairs.map((item) => ({
        id: item.id,
        text: item.question,
        side: "left",
      })),
    );
  }, [question]);

  const rightCards = useMemo(() => {
    if (question?.type !== "matching") return [];

    return shuffleArray(
      question.pairs.map((item) => ({
        id: item.id,
        text: item.answer,
        side: "right",
      })),
    );
  }, [question]);

  function speakText(text) {
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
  }

  async function saveQuizAttempt(finalScore) {
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
          quizMode: "mixed",
          score: finalScore,
          total: totalPoints,
          isTimedOut: false,
        }),
      });
    } catch (error) {
      console.error("Save mixed mode attempt error:", error);
    }
  }

  async function finishQuiz(finalScore, finalAnswers, leaveCourse = false) {
    if (isMainQuiz && submitPending.current) return;
    if (isMainQuiz) { submitPending.current = true; setMainSubmitting(true); }
    let mainResult = null;
    if (isMainQuiz) {
      try {
        const response = await fetch(`${API_BASE}/lessons/main-quiz/submit`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...lessonAuthHeaders(),
          },
          body: JSON.stringify({
            quiz_id: mainQuizId.current,
            answers: questions.map((_, index) => String(finalAnswers[index]?.userAnswer || "")),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.message || "Main Quiz could not be recorded.");
        mainResult = data.result;
      } catch (error) {
        await Swal.fire({
          icon: "error",
          title: "Result not saved",
          text: error.message,
        });
        submitPending.current = false;
        setMainSubmitting(false);
        return;
      }
    }
    const resultPayload = {
      ...getPracticeResultMetadata(
        practiceSession,
        isDeckMode ? "deck" : "lesson",
      ),
      quizMode: "mixed",
      deckId: toNumericId(deckId),
      lessonId: lessonId || null,
      score: mainResult?.score ?? finalScore,
      total: mainResult?.total ?? totalPoints,
      answers: mainResult
        ? mainResult.answers.map((answer) => ({
            ...answer,
            userAnswer: answer.selected_answer,
            correctAnswer: answer.correct_answer,
          }))
        : finalAnswers,
      savedAttemptId: mainResult ? mainQuizId.current : undefined,
    };

    saveAccountQuizResult("lessonQuizResults", JSON.stringify(resultPayload));

    if (isDeckMode) {
      saveAccountQuizResult(
        `deckQuizResults_${deckId}`,
        JSON.stringify(resultPayload),
      );
    }

    navigate(
      leaveCourse
        ? getPracticeBackPath(practiceSession, { lessonId, deckId })
        : isDeckMode
          ? `/review/deck/${deckId}`
          : getPracticeReviewPath(practiceSession, { lessonId, deckId }),
    );
  }

  function goToNext(finalScore, finalAnswers) {
    if (current + 1 < questions.length) {
      setCurrent((value) => value + 1);
      return;
    }

    finishQuiz(finalScore, finalAnswers);
  }

  async function leaveMainQuiz() {
    if (mainSubmitting) return;
    const answered = answers.filter(answer => answer?.userAnswer?.trim()).length;
    const result = await Swal.fire({
      title: "Go back to course?",
      customClass: { container: styles.mainQuizDialogOverlay, popup: `${styles.mainQuizDialog} ${styles.leaveQuizDialog}` },
      text: `You have answered ${answered} of ${questions.length} questions. Leaving will submit this attempt. All unanswered questions will be marked wrong.`,
      imageUrl: "/images/warning.png", imageWidth: 240,
      showCancelButton: true, confirmButtonText: "Submit and leave", cancelButtonText: "Keep answering",
      confirmButtonColor: "#7fa8d6", reverseButtons: true,
    });
    if (result.isConfirmed) await finishQuiz(0, answers, true);
  }

  function recordSingleAnswer(userAnswer, isCorrect) {
    if (isMainQuiz) {
      if (!question || mainSubmitting) return;
      setAnswers(previous => {
        const next = [...previous];
        next[current] = getReviewAnswer(question, userAnswer, false);
        return next;
      });
      return;
    }
    if (locked || !question) return;

    setLocked(true);
    if (!isMainQuiz) playPracticeFeedbackSound(isCorrect);
    setNotifImage(
      isCorrect ? "/images/correct.png" : "/images/wrong.png",
    );
    setNotifOpen(!isMainQuiz);
    setStatus(isMainQuiz ? "" : isCorrect ? styles.correct : styles.wrong);

    const nextScore = score + (isCorrect ? 1 : 0);
    const nextAnswers = [
      ...answers,
      getReviewAnswer(question, userAnswer, isCorrect),
    ];

    setScore(nextScore);
    setAnswers(nextAnswers);

    setTimeout(() => {
      goToNext(nextScore, nextAnswers);
    }, 900);
  }

  function handleMultipleChoice(index) {
    if (!question) return;

    const selected = question.options[index];
    setSelectedAnswer(selected);
    recordSingleAnswer(selected, index === question.correct);
    if (isMainQuiz && !mainSubmitting && current < questions.length - 1) {
      setCurrent(value => value + 1);
    }
  }

  function handleTyping() {
    if (!typingAnswer.trim() || !question) return;

    recordSingleAnswer(
      typingAnswer,
      isCloseEnough(typingAnswer, question.answer),
    );
  }

  function completeMatchingRound(finalMatchedIds) {
    if (!question || question.type !== "matching") return;

    const completedAnswers = question.pairs
      .filter((pair) => finalMatchedIds.includes(pair.id))
      .map((pair) => ({
        cardId: pair.id,
        question: pair.question,
        userAnswer: pair.answer,
        correctAnswer: pair.answer,
        explanation: pair.explanation || pair.answer,
        quizType: "matching",
        isCorrect: true,
      }));
    const nextScore = score + completedAnswers.length;
    const nextAnswers = [...answers, ...completedAnswers];

    setLocked(true);
    setScore(nextScore);
    setAnswers(nextAnswers);

    setTimeout(() => {
      goToNext(nextScore, nextAnswers);
    }, 500);
  }

  function isWrongCard(card, side) {
    return wrongPair.some((item) => item.id === card.id && item.side === side);
  }

  function handleCardClick(card, side) {
    if (locked || matchedIds.includes(card.id)) return;

    if (!firstCard) {
      setFirstCard({ ...card, side });
      return;
    }

    if (firstCard.side === side) {
      setFirstCard({ ...card, side });
      return;
    }

    if (!isMainQuiz) playPracticeFeedbackSound(firstCard.id === card.id);
    if (firstCard.id === card.id) {
      const updatedMatchedIds = [...matchedIds, card.id];

      setMatchedIds(updatedMatchedIds);
      setFirstCard(null);

      if (updatedMatchedIds.length === question.pairs.length) {
        completeMatchingRound(updatedMatchedIds);
      }

      return;
    }

    setWrongPair([firstCard, { ...card, side }]);

    setTimeout(() => {
      setWrongPair([]);
      setFirstCard(null);
    }, 500);
  }

  function renderSettingsModal() {
    if (!settingsOpen) return null;

    return (
      <div className={styles.settingsOverlay}>
        <div className={styles.settingsModal}>
          <div className={styles.settingsHeader}>
            <h2>Accessibility Settings</h2>

            <button
              type="button"
              className={styles.closeSettings}
              onClick={() => setSettingsOpen(false)}
            >
              x
            </button>
          </div>

          <div className={styles.settingsBody}>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingIcon}>A</div>

                <div className={styles.settingText}>
                  <strong>Text to Speech</strong>
                  <span>Read questions and cards aloud</span>
                </div>
              </div>

              <button
                type="button"
                className={`${styles.switchBtn} ${ttsEnabled ? styles.switchOn : ""}`}
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
                onChange={(event) => {
                  setVoiceSpeed(Number(event.target.value));
                  window.speechSynthesis?.cancel();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
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
            alt="No mixed mode questions"
            className={styles.emptyImage}
          />

          <h2 className={styles.emptyTitle}>No Mixed Mode Yet</h2>

          <p className={styles.emptyText}>
            No matching, multiple choice, or Q&A questions are available.
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

  if (question.type === "matching") {
    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          className={styles.settingsBtn}
          onClick={() => setSettingsOpen(true)}
        >
          <i className="bx bx-cog"></i>
          <span>settings</span>
        </button>

        {renderSettingsModal()}

        <div className={styles.paperBackground}>
          <header className={styles.siteHeader}>
            <h1 className={styles.courseTitle}>{isMainQuiz ? "Main Quiz" : MIXED_MODE_TITLE}</h1>
            {!isMainQuiz && <p className={styles.modeDescription}>{MIXED_MODE_DESCRIPTION}</p>}
            <div className={styles.counter}>
              Round {current + 1} of {questions.length}
            </div>
            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={styles.typeBadge}>
              {getQuestionTypeLabel(question.type)}
            </div>
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
                            matchedIds.includes(card.id) ? styles.matched : ""
                          } ${
                            firstCard?.id === card.id &&
                            firstCard?.side === "left"
                              ? styles.selected
                              : ""
                          } ${isWrongCard(card, "left") ? styles.wrongShake : ""}`}
                          onClick={() => handleCardClick(card, "left")}
                        >
                          {ttsEnabled && (
                            <button
                              type="button"
                              className={styles.cardAudioBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                              onClick={(event) => {
                                event.stopPropagation();
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
                            matchedIds.includes(card.id) ? styles.matched : ""
                          } ${
                            firstCard?.id === card.id &&
                            firstCard?.side === "right"
                              ? styles.selected
                              : ""
                          } ${isWrongCard(card, "right") ? styles.wrongShake : ""}`}
                          onClick={() => handleCardClick(card, "right")}
                        >
                          {ttsEnabled && (
                            <button
                              type="button"
                              className={styles.cardAudioBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                              onClick={(event) => {
                                event.stopPropagation();
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

  return (
    <div className={styles.wrapper}>
      <div className="practice-course-back"><TutorialBackButton onBack={isMainQuiz ? leaveMainQuiz : undefined} /></div>
      {!isMainQuiz && <PracticeSoundControl />}
      <PracticeAnswerFeedback />
      

      <button
        type="button"
        className={styles.settingsBtn}
        onClick={() => setSettingsOpen(true)}
      >
        <i className="bx bx-cog"></i>
        <span>settings</span>
      </button>

      {renderSettingsModal()}

      <div className={styles.header}>
        <h1 className={styles.title}>
          {isMainQuiz ? "Main Quiz" : MIXED_MODE_TITLE}
        </h1>
        {!isMainQuiz && <p className={styles.modeDescription}>{MIXED_MODE_DESCRIPTION}</p>}

        <div className={styles.counter}>
          Question {current + 1} of {questions.length}
        </div>

        <div className={styles.progressContainer}>
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className={styles.typeBadge}>
          {getQuestionTypeLabel(question.type)}
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
              onClick={() => speakText(question.question)}
            >
              <PracticeSpeakerIcon />
            </button>
          )}

          <p className={styles.question}>{question.question}</p>
        </div>

        {question.type === "multiple" && (
          <div className={styles.options}>
            {question.options.map((option, index) => (
              <button
                key={`${option}-${index}`}
                className={`${styles.option} ${
                  (isMainQuiz ? answers[current]?.userAnswer : selectedAnswer) === option ? styles.selectedOption : ""
                }`}
                onClick={() => handleMultipleChoice(index)}
                disabled={locked}
              >
                {ttsEnabled && (
                  <span
                    className={styles.optionAudioIcon}
                    onClick={(event) => {
                      event.stopPropagation();
                      speakText(option);
                    }}
                  >
                    <PracticeSpeakerIcon />
                  </span>
                )}

                <span>{option}</span>
              </button>
            ))}
          </div>
        )}

        {question.type === "qna" && (
          <div className={styles.typingContainer}>
            <input
              ref={inputRef}
              type="text"
              className={`${styles.input} ${status}`}
              placeholder="Type your answer"
              value={isMainQuiz ? answers[current]?.userAnswer || "" : typingAnswer}
              onChange={(event) => {
                setTypingAnswer(event.target.value);
                if (isMainQuiz) recordSingleAnswer(event.target.value, false);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (isMainQuiz) {
                  if (!mainSubmitting && String(answers[current]?.userAnswer || "").trim() && current < questions.length - 1) {
                    setCurrent(value => value + 1);
                  }
                } else if (typingAnswer.trim()) {
                  handleTyping();
                }
              }}
              maxLength={500}
              disabled={isMainQuiz ? mainSubmitting : locked}
            />
            {!isMainQuiz && <button
              type="button"
              className={styles.submitAnswer}
              onClick={handleTyping}
              disabled={locked || !typingAnswer.trim()}
            >
              Submit Answer
            </button>}
          </div>
        )}
        {isMainQuiz && <div className={styles.mainQuizNavigation}>
          <button type="button" disabled={current === 0 || mainSubmitting} onClick={() => setCurrent(value => value - 1)}>Previous</button>
          <span>{answers.filter(answer => answer?.userAnswer?.trim()).length} of {questions.length} answered</span>
          {current < questions.length - 1
            ? <button type="button" disabled={mainSubmitting} onClick={() => setCurrent(value => value + 1)}>Next</button>
            : <button type="button" disabled={mainSubmitting} onClick={async () => {
                const unanswered = questions.map((question, index) => ({ question, index }))
                  .filter(({ index }) => !String(answers[index]?.userAnswer || "").trim());
                const escapeText = (value) => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
                const summary = `<p>Your answers will be recorded. Any unanswered questions will be marked wrong.</p>${unanswered.length
                  ? `<p><strong>${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"}:</strong></p><ul class="main-quiz-unanswered">${unanswered.map(({ question, index }) => `<li><button type="button" class="main-quiz-question-link" data-question-index="${index}"><strong>Question ${index + 1}</strong> — ${escapeText(question.question)}</button></li>`).join("")}</ul>`
                  : "<p>All questions have been answered.</p>"}`;
                const result = await Swal.fire({ title: "Submit Main Quiz?", customClass: { container: styles.mainQuizDialogOverlay, popup: styles.mainQuizDialog }, html: summary, showCancelButton: true, confirmButtonText: "Submit quiz", cancelButtonText: "Review answers", confirmButtonColor: "#7fa8d6",
                  didOpen: (popup) => {
                    popup.querySelectorAll("[data-question-index]").forEach(button => {
                      button.addEventListener("click", () => {
                        setCurrent(Number(button.dataset.questionIndex));
                        Swal.close();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      });
                    });
                  },
                });
                if (result.isConfirmed) finishQuiz(0, answers);
                else if (result.dismiss === Swal.DismissReason.cancel) {
                  setCurrent(unanswered[0]?.index ?? 0);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}>{mainSubmitting ? "Submitting…" : "Submit Quiz"}</button>}
        </div>}
      </div>
    </div>
  );
}
