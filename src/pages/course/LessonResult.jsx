import { studentModuleNavigation } from "../../utils/studentModuleVisibility.js";
const attemptSaves = new Map();
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import {
  readAccountQuizResult,
  saveAccountQuizResult,
} from "../../utils/quizStorage.js";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../../config.js";
import { syncDeckCardMemorizationFromAnswers } from "../../utils/cardMemorization.js";
import styles from "./lessonresult.module.css";
import QuizModesModal from "../../components/quizmodes/QuizModesModal";
import {
  fetchCourseContent,
  getCourseContentModules,
} from "./courseContent.js";
import PracticeFeedbackCard from "./PracticeFeedbackCard.jsx";
import MainQuizResult from "./MainQuizResult.jsx";
import { isMainQuizResult } from "../../utils/quizResultType.js";
import {
  buildCurrentPracticeFeedback,
  upgradePracticeFeedback,
} from "./feedbackReview.js";
import { modulePracticePath } from "../../services/adaptivePractice.js";
import {
  coursePracticeModule,
  getResultPracticeModule,
} from "../quizzes/inQuiz/practiceSession.js";

const isAnswerCorrect = (item) => {
  if (typeof item.isCorrect === "boolean") return item.isCorrect;

  const userAnswer = item.userAnswer || item.selectedAnswer || "";
  const correctAnswer =
    item.correctAnswer || item.correct_answer || item.answer || "";

  return (
    Boolean(String(userAnswer).trim()) &&
    String(userAnswer).trim().toLowerCase() ===
      String(correctAnswer).trim().toLowerCase()
  );
};

const getUnderstanding = (confidence) => {
  if (confidence >= 80) return "Good Understanding";
  if (confidence >= 60) return "Developing Understanding";
  return "Needs More Practice";
};

const getQuizTypeLabel = (quizMode) => {
  const labels = {
    flashcard: "Flashcards",
    multiple: "Multiple Choice",
    qna: "Question and Answer",
    matching: "Matching",
    timed: "Timed Quiz",
    mixed: "Mixed Mode",
    survival: "Mixed Mode",
    lesson: "Lesson Quick Check",
  };

  return labels[quizMode] || "Quiz";
};

const getContinueModuleTitle = (title) => {
  const normalizedTitle = String(title || "").trim();

  if (!normalizedTitle) return "";

  if (/^Introduction\s+to\s+React\.js\s+with\s+Vite$/i.test(normalizedTitle)) {
    return "Introduction.";
  }

  return normalizedTitle;
};

const getContinueModuleLabel = (moduleNavigation) => {
  const moduleNumber =
    moduleNavigation.nextModuleNumber || moduleNavigation.nextModuleIndex + 1;
  const title = getContinueModuleTitle(moduleNavigation.nextModuleTitle);

  return `Continue to Module ${moduleNumber}${title ? `: ${title}` : ""}`;
};


const getStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("puffy-user") || "null");
    return user?.userId || user?.id || user?.user_id || null;
  } catch {
    return null;
  }
};

const toNumericId = (value) =>
  /^\d+$/.test(String(value || "")) ? Number(value) : null;

const toOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

export default function LessonResult({ practiceResult, onPracticeAgain } = {}) {
  const navigate = useNavigate();
  const { lessonId, deckId } = useParams();
  const scoreHeading = useRef(null);

  const [results, setResults] = useState({
    score: 0,
    total: 0,
    answers: [],
  });

  const [attempts, setAttempts] = useState(null);
  const [isMainQuiz, setIsMainQuiz] = useState(false);
  const [source, setSource] = useState(deckId ? "deck" : "lesson");
  const [resultDeckId, setResultDeckId] = useState(deckId || null);
  const [resultCourseId, setResultCourseId] = useState(null);
  const [moduleNavigation, setModuleNavigation] = useState({
    moduleIndex: null,
    moduleNumber: null,
    moduleCount: null,
    nextModuleIndex: null,
    nextModuleTitle: "",
  });

  useEffect(() => {
    if (
      practiceResult ||
      !resultCourseId ||
      moduleNavigation.moduleIndex === null
    )
      return;
    let active = true;
    fetchCourseContent(resultCourseId)
      .then((content) => {
        if (!active) return;
        const modules = getCourseContentModules(content);
        const nav = studentModuleNavigation(
          modules,
          moduleNavigation.moduleIndex,
        );
        setModuleNavigation((current) => ({
          ...current,
          nextModuleIndex: nav.nextModuleIndex,
          nextModuleNumber:
            nav.nextModuleIndex === null ? null : nav.moduleNumber + 1,
          nextModuleTitle: modules[nav.nextModuleIndex]?.title || "",
          moduleCount: nav.moduleCount,
        }));
      })
      .catch(() => {
        if (active)
          setModuleNavigation((current) => ({
            ...current,
            nextModuleIndex: null,
            nextModuleTitle: "",
          }));
      });
    return () => {
      active = false;
    };
  }, [practiceResult, resultCourseId, moduleNavigation.moduleIndex]);

  const [quizMode, setQuizMode] = useState("");
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [contentTitle, setContentTitle] = useState("");
  const [feedbackIndex, setFeedbackIndex] = useState(0);
  const [showScrollUp, setShowScrollUp] = useState(false);

  useEffect(() => {
    if (practiceResult && results.total > 0) scoreHeading.current?.focus();
  }, [practiceResult, results.total]);

  useEffect(() => {
    const updateScrollButton = () => {
      const pageIsLong =
        document.documentElement.scrollHeight > window.innerHeight + 120;

      setShowScrollUp(pageIsLong && window.scrollY > 360);
    };

    updateScrollButton();
    window.addEventListener("scroll", updateScrollButton, { passive: true });
    window.addEventListener("resize", updateScrollButton);

    return () => {
      window.removeEventListener("scroll", updateScrollButton);
      window.removeEventListener("resize", updateScrollButton);
    };
  }, []);

  const fetchAttempts = async (savedResults) => {
    try {
      const courseId = savedResults.courseId || savedResults.course_id;
      let moduleId =
        savedResults.moduleId ||
        savedResults.scopeId ||
        savedResults.scope?.scopeId;
      if (
        !practiceResult &&
        savedResults.quizMode === "adaptive_practice" &&
        courseId
      ) {
        const course = await fetchCourseContent(courseId);
        moduleId = getResultPracticeModule(
          savedResults,
          getCourseContentModules(course),
        )?.id;
      }
      const query = new URLSearchParams(
        courseId &&
          moduleId &&
          (practiceResult || savedResults.quizMode === "adaptive_practice")
          ? {
              source: "module",
              quizMode: "adaptive_practice",
              courseId,
              moduleId,
            }
          : {
              source: savedResults.source || (deckId ? "deck" : "lesson"),
              lessonId:
                savedResults.lessonId ||
                savedResults.lesson_id ||
                lessonId ||
                "",
              deckId:
                savedResults.deckId || savedResults.deck_id || deckId || "",
              quizMode: savedResults.quizMode || savedResults.mode || "",
              ...(courseId ? { courseId } : {}),
            },
      );

      const res = await fetch(`${API_BASE}/quiz-attempts?${query.toString()}`, {
        credentials: "include",
        headers: lessonAuthHeaders(),
      });

      const data = await res.json();

      if (
        !res.ok ||
        !data.success ||
        !Number.isSafeInteger(Number(data.attempts))
      ) {
        throw new Error(data.message || "Unable to load practice attempts.");
      }
      setAttempts(Number(data.attempts));
    } catch (error) {
      console.error("Fetch attempts error:", error);
      // Keep the submission's confirmed count if the follow-up request fails.
    }
  };

  useEffect(() => {
    let ignore = false;

    const parseStorage = (key) => {
      try {
        return JSON.parse(readAccountQuizResult(key));
      } catch {
        return null;
      }
    };

    const resultKeys = [
      `lessonQuizResults_${lessonId}`,
      "lessonQuizResults",
      `lessonQuizResult_${lessonId}`,
      `quizResults_${lessonId}`,
      `deckQuizResults_${deckId}`,
      "quizResults",
    ];
    const storedResult = practiceResult
      ? { data: practiceResult }
      : resultKeys
          .map((key) => ({ key, data: parseStorage(key) }))
          .sort(
            (first, second) =>
              Number(second.data?.completedAt || 0) -
              Number(first.data?.completedAt || 0),
          )
          .find(({ data }) => data);
    const savedResults = storedResult?.data;

    if (savedResults) {
      const savedAnswers = Array.isArray(savedResults.answers)
        ? savedResults.answers
        : [];
      const detectedSource =
        savedResults.source || (deckId ? "deck" : "lesson");
      const detectedQuizMode =
        savedResults.quizMode || savedResults.mode || "quiz";
      const detectedLessonId =
        savedResults.lessonId || savedResults.lesson_id || lessonId || null;
      const detectedDeckId =
        savedResults.deckId || savedResults.deck_id || deckId || null;
      let practiceCourseId = null;
      try {
        if (
          String(localStorage.getItem("practiceLessonId")) ===
          String(detectedLessonId)
        ) {
          practiceCourseId = JSON.parse(
            localStorage.getItem("practiceScope") || "{}",
          ).courseId;
        }
      } catch {
        /* Ignore invalid practice metadata. */
      }
      const detectedCourseId =
        savedResults.courseId ||
        savedResults.course_id ||
        savedResults.scope?.courseId ||
        practiceCourseId ||
        null;
      const detectedModuleIndex = toOptionalNumber(
        savedResults.moduleIndex ??
          savedResults.module_index ??
          savedResults.scope?.moduleIndex,
      );
      const detectedModuleNumber = toOptionalNumber(
        savedResults.moduleNumber ??
          savedResults.module_number ??
          savedResults.scope?.moduleNumber,
      );
      const detectedModuleCount = toOptionalNumber(
        savedResults.moduleCount ??
          savedResults.module_count ??
          savedResults.scope?.moduleCount,
      );
      const detectedNextModuleIndex = toOptionalNumber(
        savedResults.nextModuleIndex ??
          savedResults.next_module_index ??
          savedResults.scope?.nextModuleIndex,
      );

      const mainQuizResult = isMainQuizResult(savedResults);
      setIsMainQuiz(mainQuizResult);
      setResults({
        ...savedResults,
        score: savedResults.score || 0,
        total: savedResults.total || 0,
        answers: savedAnswers,
      });

      setSource(detectedSource);
      setResultDeckId(
        savedResults.deckId || savedResults.deck_id || deckId || null,
      );
      setResultCourseId(detectedCourseId);
      setModuleNavigation({
        moduleIndex: Number.isInteger(detectedModuleIndex)
          ? detectedModuleIndex
          : null,
        moduleNumber: Number.isInteger(detectedModuleNumber)
          ? detectedModuleNumber
          : Number.isInteger(detectedModuleIndex)
            ? detectedModuleIndex + 1
            : null,
        moduleCount: Number.isInteger(detectedModuleCount)
          ? detectedModuleCount
          : null,
        // Module Practice has already loaded the current publication status.
        nextModuleIndex: practiceResult ? detectedNextModuleIndex : null,
        nextModuleNumber:
          practiceResult &&
          detectedNextModuleIndex !== null &&
          detectedModuleNumber !== null
            ? detectedModuleNumber + 1
            : null,
        nextModuleTitle:
          savedResults.nextModuleTitle ||
          savedResults.next_module_title ||
          savedResults.scope?.nextModuleTitle ||
          "",
      });
      setQuizMode(detectedQuizMode);
      setIsTimedOut(Boolean(savedResults.isTimedOut || savedResults.timedOut));
      setAttempts(
        Number.isSafeInteger(savedResults.attempts)
          ? savedResults.attempts
          : null,
      );

      if (practiceResult) {
        setContentTitle(savedResults.contentTitle);
        setAiFeedback(
          Array.isArray(savedResults.feedback) ? savedResults.feedback : null,
        );
        void fetchAttempts(savedResults);
        return;
      }

      const persistQuizAttempt = async () => {
        if (savedResults.savedAttemptId || savedResults.attemptId)
          return savedResults.savedAttemptId || savedResults.attemptId;

        try {
          const attemptTotal = Number(
            savedResults.total || savedAnswers.length || 0,
          );

          if (attemptTotal <= 0) return;

          const response = await fetch(`${API_BASE}/quiz-attempts`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...lessonAuthHeaders(),
            },
            body: JSON.stringify({
              user_id: getStoredUserId(),
              source: detectedSource,
              lesson_id: toNumericId(detectedLessonId),
              deck_id: detectedDeckId,
              course_id: detectedCourseId,
              quiz_mode: detectedQuizMode,
              assessment_type:
                detectedQuizMode === "lesson"
                  ? "recap"
                  : /main/i.test(
                        String(
                          savedResults.scopeType ||
                            savedResults.scope?.scopeType ||
                            detectedSource,
                        ),
                      )
                    ? "main"
                    : "practice",
              module_index: detectedModuleIndex,
              answers: savedAnswers.map((answer) => {
                let sourceItems = [];
                try {
                  sourceItems = JSON.parse(
                    localStorage.getItem("practiceQuizzes") || "[]",
                  );
                } catch {}
                const original = Array.isArray(sourceItems)
                  ? sourceItems.find(
                      (item) => (item.question || item.q) === answer.question,
                    )
                  : null;
                return {
                  ...answer,
                  topic: answer.topic || original?.topic,
                  cognitive_level:
                    answer.cognitive_level || original?.cognitive_level,
                  thinking_skill:
                    answer.thinking_skill || original?.thinking_skill,
                };
              }),
              score: Number(savedResults.score || 0),
              total: attemptTotal,
              time_spent: Number(
                savedResults.timeSpent || savedResults.time_spent || 0,
              ),
            }),
          });
          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to save quiz attempt.");
          }

          if (data.attemptId && storedResult?.key) {
            saveAccountQuizResult(
              storedResult.key,
              JSON.stringify({
                ...savedResults,
                savedAttemptId: data.attemptId,
              }),
            );
          }
          return data.attemptId;
        } catch (error) {
          console.error("Save quiz attempt error:", error);
          throw error;
        }
      };

      const saveKey = `${getStoredUserId()}:${savedResults.sessionId || JSON.stringify(savedResults)}`;
      if (!attemptSaves.has(saveKey))
        attemptSaves.set(saveKey, persistQuizAttempt());
      attemptSaves
        .get(saveKey)
        .then(() =>
          fetchAttempts({ ...savedResults, courseId: detectedCourseId }),
        )
        .catch(() => {
          attemptSaves.delete(saveKey);
          Swal.fire({
            icon: "error",
            title: "Result not saved",
            text: "Your quiz result could not be recorded. Refresh this result page to retry.",
            confirmButtonText: "OK",
          });
        });
      syncDeckCardMemorizationFromAnswers(
        detectedSource === "deck",
        savedAnswers,
      );

      if (!mainQuizResult && savedAnswers.length > 0) {
        setIsFeedbackLoading(true);
        setAiFeedback(null);

        const generateFeedback = async (savedAttemptId) => {
          try {
            let resolvedTitle = String(
              savedResults.contentTitle ||
                savedResults.scopeTitle ||
                savedResults.scope_title ||
                savedResults.lessonTitle ||
                savedResults.deckTitle ||
                savedResults.title ||
                "",
            ).trim();

            if (!resolvedTitle && detectedSource === "deck" && detectedDeckId) {
              const titleResponse = await fetch(
                `${API_BASE}/getDeckById.php?deckId=${detectedDeckId}`,
                { credentials: "include" },
              );
              const titleData = await titleResponse.json();
              resolvedTitle = String(
                titleData?.deck?.title ||
                  titleData?.deck?.deck_title ||
                  titleData?.deck?.name ||
                  titleData?.title ||
                  "",
              ).trim();
            }

            if (
              !resolvedTitle &&
              detectedSource === "lesson" &&
              detectedLessonId
            ) {
              const titleData = await fetchCourseContent(detectedLessonId);
              resolvedTitle = String(
                titleData?.title ||
                  titleData?.courseName ||
                  titleData?.course_name ||
                  "",
              ).trim();
            }

            if (!resolvedTitle) {
              resolvedTitle =
                detectedSource === "deck"
                  ? "This deck"
                  : detectedSource === "course"
                    ? "This course"
                    : detectedSource === "module"
                      ? "This module"
                      : "This lesson";
            }

            const titledAnswers = savedAnswers.map((answer) => {
              const savedTopic = String(answer.topic || "").trim();
              const isGenericTopic =
                !savedTopic ||
                savedTopic.toLowerCase() === resolvedTitle.toLowerCase() ||
                ["this lesson", "this deck", "general", "quiz"].includes(
                  savedTopic.toLowerCase(),
                );

              return {
                ...answer,
                topic: isGenericTopic ? "" : savedTopic,
                lessonTitle: ["lesson", "module", "course"].includes(
                  detectedSource,
                )
                  ? resolvedTitle
                  : undefined,
                deckTitle:
                  detectedSource === "deck" ? resolvedTitle : undefined,
              };
            });

            if (!ignore) {
              setContentTitle(resolvedTitle);
              setResults({
                ...savedResults,
                score: savedResults.score || 0,
                total: savedResults.total || 0,
                answers: titledAnswers,
              });
            }

            const response = await fetch(`${API_BASE}/quiz-feedback`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                ...lessonAuthHeaders(),
              },
              body: JSON.stringify({
                user_id: getStoredUserId(),
                source: detectedSource,
                contentTitle: resolvedTitle,
                  attemptId: savedAttemptId,
                lessonId: detectedLessonId,
                courseId: detectedCourseId,
                deckId: detectedDeckId,
                quizMode: detectedQuizMode,
                answers: titledAnswers,
              }),
            });

            const responseText = await response.text();
            let data;

            try {
              data = JSON.parse(responseText);
            } catch {
              throw new Error(
                `Adaptive feedback returned invalid JSON (${response.status}): ${responseText.slice(
                  0,
                  200,
                )}`,
              );
            }

            if (!response.ok || !data.success) {
              throw new Error(
                data.message || "Unable to generate adaptive feedback.",
              );
            }

            if (!ignore && Array.isArray(data.feedback)) {
              setAiFeedback(
                data.feedback
                  .map((feedback) => ({
                    ...feedback,
                    topic: String(feedback.topic || "").trim(),
                    quizType: feedback.quizType || detectedQuizMode,
                    understanding:
                      feedback.understanding ||
                      getUnderstanding(Number(feedback.confidence) || 0),
                    confidence: Number(feedback.confidence) || 0,
                    questionIndexes: Array.isArray(feedback.questionIndexes)
                      ? feedback.questionIndexes
                      : Array.isArray(feedback.question_indexes)
                        ? feedback.question_indexes
                        : [],
                    recommendation: String(
                      feedback.recommendation || "",
                    ).trim(),
                    strengths: Array.isArray(feedback.strengths)
                      ? feedback.strengths
                      : [],
                    areasForImprovement: Array.isArray(
                      feedback.areasForImprovement,
                    )
                      ? feedback.areasForImprovement
                      : [],
                    suggestedReviewTopics: Array.isArray(
                      feedback.suggestedReviewTopics,
                    )
                      ? feedback.suggestedReviewTopics
                      : [],
                    adaptiveRecommendation: String(
                      feedback.adaptiveRecommendation || "",
                    ).trim(),
                    nextGoal: String(feedback.nextGoal || "").trim(),
                  }))
                  .filter(
                    (feedback) => feedback.topic && feedback.recommendation,
                  ),
              );
            }
          } catch (error) {
            if (!ignore) {
              console.error("AI adaptive feedback error:", error);
              setAiFeedback(null);
            }
          } finally {
            if (!ignore) {
              setIsFeedbackLoading(false);
            }
          }
        };

        // Feedback must attach to the saved attempt, rather than racing its insert.
        attemptSaves
          .get(saveKey)
          .then((attemptId) => {
            if (!ignore) return generateFeedback(attemptId);
          })
          .catch(() => {
            if (!ignore) setIsFeedbackLoading(false);
          });
      }
    }

    return () => {
      ignore = true;
    };
  }, [lessonId, deckId, practiceResult]);

  const isPracticeResult = Boolean(practiceResult);

  useEffect(() => {
    const blockedControlKeys = isPracticeResult
      ? ["u", "s", "p"]
      : ["c", "v", "x", "u", "s", "p"];

    const blockKeys = (e) => {
      const key = e.key.toLowerCase();

      if (
        (e.ctrlKey && blockedControlKeys.includes(key)) ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        alert("Copying or capturing this content is disabled.");
      }
    };

    const blockCopy = (e) => e.preventDefault();

    document.addEventListener("keydown", blockKeys);
    if (!isPracticeResult) {
      document.addEventListener("copy", blockCopy);
      document.addEventListener("cut", blockCopy);
      document.addEventListener("paste", blockCopy);
    }

    return () => {
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("cut", blockCopy);
      document.removeEventListener("paste", blockCopy);
    };
  }, [isPracticeResult]);

  const percentage =
    results.total > 0 ? Math.round((results.score / results.total) * 100) : 0;

  const displayedFeedback =
    Array.isArray(aiFeedback) && aiFeedback.length > 0
      ? aiFeedback.map((feedback) =>
          upgradePracticeFeedback(
            feedback,
            results.answers,
            contentTitle,
            quizMode,
            results,
          ),
        )
      : buildCurrentPracticeFeedback(results.answers, contentTitle, quizMode, results);
  const activeFeedbackIndex = Math.min(
    feedbackIndex,
    Math.max(displayedFeedback.length - 1, 0),
  );
  const activeFeedback = displayedFeedback[activeFeedbackIndex];
  const activeQuizMode = activeFeedback?.quizType || quizMode;
  let feedbackTitle = "";
  let feedbackMessage = "";
  let masteryLevel = "";
  let recommendation = "";

  if (percentage >= 90) {
    feedbackTitle = "Excellent Performance!";
    feedbackMessage =
      "You mastered this activity and showed strong understanding of the topic.";
    masteryLevel = "Outstanding (A)";
    recommendation = practiceResult?.mastered
      ? "You can continue to the next activity."
      : "Review any recurring mistakes and practice with fresh examples.";
  } else if (percentage >= 80) {
    feedbackTitle = "Very Good!";
    feedbackMessage =
      "You understood the topic very well with only minor mistakes.";
    masteryLevel = "Very Satisfactory (B+)";
    recommendation = "Review small mistakes and try another quiz mode.";
  } else if (percentage >= 70) {
    feedbackTitle = "Good Job!";
    feedbackMessage =
      "You understood most of the topic, but there are still areas to improve.";
    masteryLevel = "Satisfactory (B)";
    recommendation = "Review the missed questions before moving on.";
  } else if (percentage >= 60) {
    feedbackTitle = "Fair";
    feedbackMessage = "You have a basic understanding, but need more practice.";
    masteryLevel = "Developing (C)";
    recommendation = "Study again and retake the quiz.";
  } else if (percentage >= 50) {
    feedbackTitle = "Needs Improvement";
    feedbackMessage =
      "You are starting to understand, but more effort is needed.";
    masteryLevel = "Beginning (D)";
    recommendation = "Review carefully before retrying.";
  } else {
    feedbackTitle = "Needs Review";
    feedbackMessage =
      "You need to revisit the topic and build your understanding.";
    masteryLevel = "Below Basic (F)";
    recommendation = "Go back and focus on the key concepts.";
  }

  if (
    results.assessmentBasis === "self_assessment" ||
    quizMode === "flashcard"
  ) {
    feedbackTitle = "Recall Review Completed";
    feedbackMessage =
      "This result reflects how you rated the cards. Check your understanding with a graded practice quiz.";
    masteryLevel = "Self-assessed recall";
    recommendation =
      "Try a graded practice question to verify what you can recall.";
  }

  if (quizMode === "timed" && isTimedOut) {
    feedbackTitle = "Time Ran Out";
    feedbackMessage = practiceResult
      ? "The timer ended before you finished. Your score includes all questions in the attempt."
      : "The timer ended before you finished the quiz. Your score is based only on the questions you answered before time ran out.";
    masteryLevel = "Incomplete";
    recommendation =
      "Try again and manage your time better, or review before retrying.";
  }

  const retryQuiz = () => {
    if (onPracticeAgain) {
      onPracticeAgain();
      return;
    }
    setShowQuizModal(true);
  };

  const startCoursePractice = async (mode) => {
    try {
      const course = await fetchCourseContent(resultCourseId);
      const module =
        results.moduleId === "all-modules" || results.source === "course"
          ? coursePracticeModule(course, getCourseContentModules(course))
          : getResultPracticeModule(results, getCourseContentModules(course));
      const path = modulePracticePath(resultCourseId, module, mode);
      setShowQuizModal(false);
      // Old course-wide results need a module selection before adaptive practice.
      navigate(path || `/student/enrolled-courses/${resultCourseId}`);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Practice unavailable",
        text: error.message,
      });
    }
  };

  const goHome = () => {
    navigate("/student");
  };

  const goBack = () => {
    if (source === "deck") {
      navigate(`/deck/${resultDeckId || deckId}`);
    } else if (resultCourseId || source === "module" || source === "course") {
      navigate(
        resultCourseId
          ? `/student/enrolled-courses/${resultCourseId}`
          : "/student/enrolled-courses",
      );
    } else {
      navigate(`/introduction/${lessonId}`);
    }
  };

  const continueToNextModule = () => {
    if (resultCourseId && moduleNavigation.nextModuleIndex !== null) {
      navigate(
        `/introduction/${resultCourseId}?module=${moduleNavigation.nextModuleIndex}`,
      );
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isMainQuiz) {
    return (
      <MainQuizResult
        score={results.score}
        total={results.total}
        percentage={percentage}
        onBack={goBack}
        onHome={goHome}
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.scoreSection}>
        <div className={styles.feedbackBox}>
          <div className={styles.scoreHeader}>
            <h1 ref={scoreHeading} tabIndex={practiceResult ? -1 : undefined}>
              You Scored <span>{results.score}</span>/
              <span>{results.total}</span>
            </h1>
          </div>

          {(quizMode !== "timed" || practiceResult) && (
            <p className={styles.percentage}>Score Percentage: {percentage}%</p>
          )}

          <h2>{feedbackTitle}</h2>
          <p>{feedbackMessage}</p>
        </div>

        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <h3>Your Status:</h3>
            <p>{masteryLevel}</p>
          </div>

          <div className={styles.summaryCard}>
            <h3>Recommended Action</h3>
            <p>{recommendation}</p>
          </div>

          <div className={styles.summaryCard}>
            <h3>Attempts</h3>
            <p>{attempts ?? "Unavailable"}</p>
          </div>
        </div>

        <div className={styles.resultButtons}>
          {(!practiceResult?.mastered ||
            practiceResult?.assessmentBasis === "self_assessment" ||
            practiceResult?.feedback?.some(
              (feedback) => feedback.recurring,
            )) && (
            <button className={styles.retry} onClick={retryQuiz}>
              Practice Again
            </button>
          )}

          {source === "module" &&
            resultCourseId &&
            moduleNavigation.nextModuleIndex !== null && (
              <button className={styles.lesson} onClick={continueToNextModule}>
                {getContinueModuleLabel(moduleNavigation)}
              </button>
            )}

          <button className={styles.lesson} onClick={goBack}>
            {source === "deck"
              ? "Back to Deck"
              : resultCourseId || source === "module" || source === "course"
                ? "Back to Course"
                : "Review Lesson"}
          </button>

          <button className={styles.home} onClick={goHome}>
            Go Home
          </button>
        </div>
      </div>

      <div className={`${styles.reviewWrapper} ${styles.feedbackWrapper}`}>
        <h2 className={styles.reviewHeader}>Practice Quiz Feedback</h2>

        <div className={styles.adaptiveFeedbackPanel}>
          {isFeedbackLoading ? (
            <p className={styles.feedbackLoading}>
              Analyzing your answers and generating personalized feedback...
            </p>
          ) : displayedFeedback.length === 0 ? (
            <p className={styles.noAnswers}>
              Complete some questions to generate adaptive feedback.
            </p>
          ) : (
            <PracticeFeedbackCard
              key={JSON.stringify([results.attemptId ?? results.completedAt, activeFeedbackIndex, activeFeedback.topic])}
              feedback={activeFeedback}
              modeLabel={getQuizTypeLabel(activeQuizMode)}
              index={activeFeedbackIndex}
              count={displayedFeedback.length}
              onPage={setFeedbackIndex}
            />
          )}
        </div>
      </div>

      <div className={styles.reviewWrapper}>
        <div className={styles.reviewHeader}>Review the Answers</div>

        <div className={styles.reviewList}>
          {results.answers.length === 0 ? (
            <p className={styles.noAnswers}>No answers recorded.</p>
          ) : (
            results.answers.map((item, index) => {
              const question = item.question || "Question not available";
              const userAnswer =
                item.userAnswer || item.selectedAnswer || "No answer";
              const correctAnswer =
                item.correctAnswer ||
                item.answer ||
                "Correct answer not available";

              const isCorrect = isAnswerCorrect(item);

              return (
                <div key={index} className={styles.reviewItem}>
                  <div className={styles.reviewQuestion}>
                    {index + 1}. {question}
                  </div>

                  <hr className={styles.reviewDivider} />

                  <div className={styles.reviewAnswer}>
                    <p
                      className={
                        isCorrect ? styles.correctText : styles.wrongText
                      }
                    >
                      Your Answer: {userAnswer}
                    </p>

                    <p>
                      Correct Answer:{" "}
                      <span className={styles.correctAnswer}>
                        {correctAnswer}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showQuizModal && (
        <QuizModesModal
          source={source}
          lessonId={source === "deck" ? undefined : lessonId}
          deckId={source === "deck" ? resultDeckId || deckId : undefined}
          quizzes={results.answers}
          cards={results.answers}
          onSelectMode={
            resultCourseId && source !== "deck"
              ? startCoursePractice
              : undefined
          }
          onClose={() => setShowQuizModal(false)}
        />
      )}

      {showScrollUp && (
        <button
          type="button"
          className={styles.scrollTopButton}
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
