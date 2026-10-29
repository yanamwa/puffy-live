import PracticeSpeakerIcon from "../../../../components/quizmodes/PracticeSpeakerIcon.jsx";
import TutorialBackButton from "../TutorialBackButton.jsx";
import { usePracticeState, usePracticeItems, clearPracticeProgress } from "../../../../utils/practiceResume.js";
import PracticeSoundControl from "../../../../components/quizmodes/PracticeSoundControl.jsx";
import PracticeAnswerFeedback from "../../../../components/quizmodes/PracticeAnswerFeedback.jsx";
import { playPracticeFeedbackSound } from "../../../../utils/practiceFeedbackSound.js";
import {
  fetchCourseContent,
  getCourseQuizItems,
} from "../../../course/courseContent.js";
import { lessonAuthHeaders } from "../../../../services/lessonAuth.js";
import { saveAccountQuizResult } from "../../../../utils/quizStorage.js";
import React, { useEffect, useMemo, useState } from "react";
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
import styles from "./multiplechoice.module.css";

export default function Quiz() {
  const routeNavigate = useNavigate();
  const navigate = (...args) => { clearPracticeProgress(); routeNavigate(...args); };
  const { lessonId, deckId } = useParams();

  const isLessonMode = Boolean(lessonId);
  const isDeckMode = Boolean(deckId);
  const practiceSession = useMemo(
    () => getStoredPracticeSession({ lessonId, deckId }),
    [lessonId, deckId],
  );

  const [title, setTitle] = useState("Multiple Choice");
  const [questions, setQuestions] = usePracticeState("questions", [], true);
  const [loading, setLoading] = useState(true);

  const [current, setCurrent] = usePracticeState("current", 0);
  const [score, setScore] = usePracticeState("score", 0);
  const [selected, setSelected] = useState(null);
  const [typedAnswer, setTypedAnswer] = usePracticeState("typedAnswer", "");
  useEffect(() => setTypedAnswer(""), [current]);
  const [locked, setLocked] = useState(false);
  const [answers, setAnswers] = usePracticeState("answers", []);
  const [checkpointOpen, setCheckpointOpen] = usePracticeState("checkpointOpen", false);
  const [checkpointStartIndex, setCheckpointStartIndex] = usePracticeState("checkpointStartIndex", 0);
  const [checkpointReviewEndIndex, setCheckpointReviewEndIndex] = usePracticeState("checkpointReviewEndIndex", 0);

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(0.9);

  const shuffleArray = (array) => {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  };

  const cleanOptionText = (text = "") => {
    return String(text)
      .replace(/^[A-D]\.\s*/i, "")
      .trim();
  };

  const addLetterPrefix = (option, index) => {
    const letters = ["A", "B", "C", "D"];
    const text = String(option || "").trim();

    if (/^[A-D]\.\s*/i.test(text)) return text;

    return `${letters[index]}. ${text}`;
  };

  const splitQuestionAndOptions = (questionText = "") => {
    const text = String(questionText).trim();
    const match = text.match(/^(.*?)(?=\s+A\.\s+)/i);
    const questionOnly = match ? match[1].trim() : text;

    const optionMatches = [
      ...text.matchAll(/([A-D])\.\s*(.*?)(?=\s+[A-D]\.\s+|$)/gi),
    ];

    return {
      questionOnly,
      extractedOptions: optionMatches.map((m) => m[2].trim()),
    };
  };

  const isSameText = (a, b) => {
    return (
      cleanOptionText(a).toLowerCase() === cleanOptionText(b).toLowerCase()
    );
  };

  const getUniqueOptions = (options) => {
    const seen = new Set();

    return options.filter((opt) => {
      const clean = cleanOptionText(opt).toLowerCase();

      if (!clean || seen.has(clean)) return false;

      seen.add(clean);
      return true;
    });
  };

  const parseJsonOptions = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getSavedOptions = (item) => {
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
  };

  const generateWrongOptions = async (
    question,
    correctAnswer,
    cardId = null,
  ) => {
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
        .filter(
          (opt) =>
            !["true", "false"].includes(cleanOptionText(opt).toLowerCase()),
        )
        .slice(0, 3);

      return {
        wrongOptions,
        explanation: data.explanation || "",
      };
    } catch (err) {
      console.error("Generate wrong options error:", err);

      return {
        wrongOptions: [],
        explanation: "",
      };
    }
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

  useEffect(() => {
    const loadQuiz = async () => {
      setLoading(true);

      try {
        if (practiceSession) {
          setTitle(getPracticeTitle(practiceSession, "Practice Quiz"));

          let answerItems = practiceSession.items;
          if (practiceSession.scope?.courseId) {
            try {
              const course = await fetchCourseContent(
                practiceSession.scope.courseId,
              );
              answerItems = [...answerItems, ...getCourseQuizItems(course)];
            } catch (error) {
              console.warn("Could not load other saved quiz answers.", error);
            }
          }
          const answerPool = answerItems.map(getQuizItemAnswer);
          const practiceQuestions = practiceSession.items
            .map((item) => {
              const rawQuestionText = getQuizItemQuestion(item);
              const { questionOnly, extractedOptions } =
                splitQuestionAndOptions(rawQuestionText);
              const correctAnswer = getQuizItemAnswer(item);
              if (
                item.type === "identification" &&
                String(correctAnswer).trim()
              ) {
                const pool =
                  typeof answerPool !== "undefined"
                    ? answerPool
                    : parsed.map(getQuizItemAnswer);
                const wrongOptions = shuffleArray(getUniqueOptions(pool))
                  .filter(
                    (answer) =>
                      !isSameText(answer, correctAnswer) &&
                      !["true", "false"].includes(
                        cleanOptionText(answer).toLowerCase(),
                      ),
                  )
                  .slice(0, 3);
                if (wrongOptions.length < 1) return null;
                return {
                  type: "multiple_choice",
                  cardId: item.cardId || item.id || null,
                  q: questionOnly,
                  options: shuffleArray([correctAnswer, ...wrongOptions]),
                  correctAnswer,
                  explanation: item.explanation || correctAnswer,
                };
              }
              const answerLower = String(correctAnswer).trim().toLowerCase();
              const questionLower = String(rawQuestionText)
                .trim()
                .toLowerCase();

              if (
                item.type === "true_false" ||
                answerLower === "true" ||
                answerLower === "false" ||
                questionLower.includes("true or false")
              ) {
                return null;
              }

              const rawOptions =
                Array.isArray(item.options) && item.options.length > 0
                  ? item.options.filter(
                      (opt) => opt && String(opt).trim() !== "",
                    )
                  : extractedOptions.length > 0
                    ? extractedOptions
                    : getSavedOptions(item);

              const options = getUniqueOptions([
                correctAnswer,
                ...rawOptions,
                ...(rawOptions.length < 2 ? answerPool : []),
              ]).slice(0, 4);

              if (options.length < 2) return null;

              return {
                cardId: item.cardId || item.card_id || item.id || null,
                q: questionOnly,
                options: shuffleArray(options),
                correctAnswer,
                explanation: item.explanation || correctAnswer,
              };
            })
            .filter(Boolean);

          setQuestions(shuffleArray(practiceQuestions));
          return;
        }

        if (isLessonMode) {
          const res = await fetch(
            `${API_BASE}/getLessonsById.php?id=${lessonId}`,
            { credentials: "include" },
          );

          const lessonData = normalizeLessonData(await res.json());
          setTitle(lessonData?.title || "Lesson Quiz");

          const rawQuiz = getLessonQuizData(lessonData);

          let parsed = [];

          try {
            parsed = Array.isArray(rawQuiz)
              ? rawQuiz
              : JSON.parse(String(rawQuiz || "[]"));
          } catch {
            parsed = [];
          }

          const lessonQuestionsRaw = parsed.map((item) => {
            const rawQuestionText = item.question || "No question available.";
            const { questionOnly, extractedOptions } =
              splitQuestionAndOptions(rawQuestionText);

            const correctAnswer =
              item.correct_answer || item.correctAnswer || item.answer || "";

            if (
              item.type === "identification" &&
              String(correctAnswer).trim()
            ) {
              const pool =
                typeof answerPool !== "undefined"
                  ? answerPool
                  : parsed.map(getQuizItemAnswer);
              const wrongOptions = shuffleArray(getUniqueOptions(pool))
                .filter(
                  (answer) =>
                    !isSameText(answer, correctAnswer) &&
                    !["true", "false"].includes(
                      cleanOptionText(answer).toLowerCase(),
                    ),
                )
                .slice(0, 3);
              if (wrongOptions.length < 1) return null;
              return {
                type: "multiple_choice",
                cardId: item.cardId || item.id || null,
                q: questionOnly,
                options: shuffleArray([correctAnswer, ...wrongOptions]),
                correctAnswer,
                explanation: item.explanation || correctAnswer,
              };
            }
            const answerLower = String(correctAnswer).trim().toLowerCase();
            const questionLower = String(rawQuestionText).trim().toLowerCase();

            if (
              item.type === "true_false" ||
              answerLower === "true" ||
              answerLower === "false" ||
              questionLower.includes("true or false")
            ) {
              return null;
            }

            const rawOptions =
              Array.isArray(item.options) && item.options.length > 0
                ? item.options.filter((opt) => opt && String(opt).trim() !== "")
                : extractedOptions;

            const options = getUniqueOptions(rawOptions).slice(0, 4);

            if (options.length < 2) return null;

            return {
              q: questionOnly,
              options,
              correctAnswer,
              explanation: item.explanation || correctAnswer,
            };
          });

          const lessonQuestions = lessonQuestionsRaw.filter(Boolean);
          setQuestions(shuffleArray(lessonQuestions));
        }

        if (isDeckMode) {
          const deckRes = await fetch(
            `${API_BASE}/getDeckById.php?deckId=${deckId}`,
            { credentials: "include" },
          );

          const deckData = await deckRes.json();

          const deckTitle =
            deckData?.deck?.title ||
            deckData?.deck?.deck_title ||
            deckData?.deck?.name ||
            deckData?.title ||
            deckData?.deck_title ||
            "Deck Quiz";

          setTitle(deckTitle);

          const cardsRes = await fetch(
            `${API_BASE}/getCardsByDeck.php?deckId=${deckId}`,
            { credentials: "include" },
          );

          const cardsData = await cardsRes.json();
          const cards = cardsData.success ? cardsData.cards || [] : [];

          if (cards.length === 0) {
            setQuestions([]);
            return;
          }

          const deckQuestionsRaw = await Promise.all(
            cards.map(async (card) => {
              const correctAnswer = card.answer || "";
              const rawQuestionText = card.question || "";
              const cardId = card.cardId || card.card_id || card.id || null;

              const answerLower = String(correctAnswer).trim().toLowerCase();
              const questionLower = String(rawQuestionText)
                .trim()
                .toLowerCase();

              if (
                answerLower === "true" ||
                answerLower === "false" ||
                questionLower.includes("true or false")
              ) {
                return null;
              }

              const { questionOnly, extractedOptions } =
                splitQuestionAndOptions(rawQuestionText);

              const savedOptions = getSavedOptions(card);

              let options = [];
              let explanation = card.mc_explanation || correctAnswer;

              if (extractedOptions.length >= 4) {
                options = getUniqueOptions(extractedOptions).slice(0, 4);
              } else if (savedOptions.length >= 3) {
                options = shuffleArray(
                  getUniqueOptions([correctAnswer, ...savedOptions]),
                ).slice(0, 4);
              } else {
                const generated = await generateWrongOptions(
                  questionOnly,
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

              if (options.length < 2) return null;

              return {
                cardId,
                q: questionOnly,
                options,
                correctAnswer,
                explanation,
              };
            }),
          );

          const deckQuestions = deckQuestionsRaw.filter(Boolean);
          setQuestions(shuffleArray(deckQuestions));
        }
      } catch (error) {
        console.error("Error loading multiple choice:", error);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [lessonId, deckId, isLessonMode, isDeckMode, practiceSession]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const question = questions[current];

  const cleanOptions = (question?.options || []).filter(
    (opt) => opt && String(opt).trim() !== "",
  );

  const visibleOptions = cleanOptions
    .slice(0, 4)
    .map((opt, index) => addLetterPrefix(opt, index));

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
          quizMode: "multiple",
          score: finalScore,
          total: questions.length,
          isTimedOut: false,
        }),
      });
    } catch (error) {
      console.error("Save attempt error:", error);
    }
  }

  async function finishQuiz(finalScore, finalAnswers, returnToDeck = false) {
    const resultPayload = {
      ...getPracticeResultMetadata(
        practiceSession,
        isDeckMode ? "deck" : "lesson",
      ),
      quizMode: "multiple",
      deckId: toNumericId(deckId),
      lessonId: lessonId || null,
      score: finalScore,
      total: questions.length,
      answers: finalAnswers,
    };

    saveAccountQuizResult("lessonQuizResults", JSON.stringify(resultPayload));

    if (isDeckMode) {
      saveAccountQuizResult(
        `deckQuizResults_${deckId}`,
        JSON.stringify(resultPayload),
      );
    }

    window.speechSynthesis?.cancel();
    navigate(
      returnToDeck && isDeckMode
        ? `/deck/${deckId}`
        : isDeckMode
          ? `/review/deck/${deckId}`
          : getPracticeReviewPath(practiceSession, { lessonId, deckId }),
    );
  }

  function repeatCheckpointQuestions() {
    const repeatedAnswers = answers.slice(0, checkpointStartIndex);
    const repeatedScore = repeatedAnswers.filter(
      (answer) => answer.isCorrect,
    ).length;

    setAnswers(repeatedAnswers);
    setScore(repeatedScore);
    setCurrent(checkpointStartIndex);
    setSelected(null);
    setLocked(false);
    setCheckpointOpen(false);
  }

  function continueAfterCheckpoint() {
    setCheckpointStartIndex(checkpointReviewEndIndex);
    setCurrent(checkpointReviewEndIndex);
    setSelected(null);
    setLocked(false);
    setCheckpointOpen(false);
  }

  async function handleAnswer(index, identificationValue) {
    if (locked || !question) return;

    setSelected(index);
    setLocked(true);

    const chosenAnswer =
      question.type === "identification"
        ? String(identificationValue || "").trim()
        : visibleOptions[index] || question.options[index] || "";
    const isCorrect =
      question.type === "identification"
        ? chosenAnswer.replace(/\s+/g, " ").toLowerCase() ===
          String(question.correctAnswer)
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase()
        : isSameText(chosenAnswer, question.correctAnswer);
    playPracticeFeedbackSound(isCorrect);
    const newScore = score + (isCorrect ? 1 : 0);

    const newAnswer = {
      cardId: question.cardId || null,
      question: question.q,
      userAnswer: chosenAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      isCorrect,
    };

    const updatedAnswers = [...answers, newAnswer];

    setAnswers(updatedAnswers);

    if (isCorrect) {
      setScore(newScore);
    }

    await updateDeckCardMemorized(isDeckMode, question.cardId, isCorrect, {
      question: question.q,
      answer: question.correctAnswer,
    });

    setTimeout(async () => {
      const completedCount = current + 1;
      const shouldShowCheckpoint =
        completedCount % 10 === 0 && completedCount < questions.length;

      if (shouldShowCheckpoint) {
        setCheckpointReviewEndIndex(completedCount);
        setSelected(null);
        setLocked(false);
        setCheckpointOpen(true);
        return;
      }

      if (completedCount < questions.length) {
        setCurrent((prev) => prev + 1);
        setSelected(null);
        setLocked(false);
        window.speechSynthesis?.cancel();
        return;
      }

      await finishQuiz(newScore, updatedAnswers);
    }, 700);
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

          <h2 className={styles.emptyTitle}>No Multiple Choice Quiz Yet</h2>

          <p className={styles.emptyText}>
            No valid multiple-choice questions are available. True/False cards
            are skipped in this mode.
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

  const progressPercent = ((current + 1) / questions.length) * 100;

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
              onClick={() => finishQuiz(score, answers, true)}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h1 className={styles.title}>{title}</h1>

            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

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

            <p className={styles.subtitle}>
              Question {current + 1} of {questions.length}
            </p>
          </div>

          <div className={styles.questionBox}>
            <div className={styles.questionTextBox}>
              {ttsEnabled && (
                <button
                  type="button"
                  className={styles.audioIconBtn}
                              aria-label="Read aloud"
                              title="Read aloud"
                  onClick={() => speakText(question.q)}
                >
                  <PracticeSpeakerIcon />
                </button>
              )}

              <p className={styles.question}>{question.q}</p>
            </div>

            {question.type === "identification" ? (
              <form
                className={styles.options}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (typedAnswer.trim()) handleAnswer(-1, typedAnswer);
                }}
              >
                <input
                  className={styles.identificationInput}
                  aria-label="Your identification answer"
                  placeholder="Type your answer"
                  maxLength={150}
                  value={typedAnswer}
                  onChange={(event) => setTypedAnswer(event.target.value)}
                  disabled={locked}
                />
                <button
                  className={styles.option}
                  type="submit"
                  disabled={locked || !typedAnswer.trim()}
                >
                  Submit answer
                </button>
              </form>
            ) : (
              <div className={styles.options}>
                {visibleOptions.map((opt, i) => {
                  const isSelected = selected === i;

                  const optionClass = isSelected
                    ? `${styles.option} ${styles.selected}`
                    : styles.option;

                  return (
                    <button
                      key={i}
                      className={optionClass}
                      onClick={() => handleAnswer(i)}
                      disabled={locked}
                    >
                      {ttsEnabled && (
                        <span
                          className={styles.optionAudioIcon}
                          onClick={(e) => {
                            e.stopPropagation();
                            speakText(opt);
                          }}
                        >
                          <PracticeSpeakerIcon />
                        </span>
                      )}

                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
