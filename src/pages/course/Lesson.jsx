import LessonContent from "../../components/lesson/LessonContent.jsx";
import { studentModuleNavigation } from "../../utils/studentModuleVisibility.js";
import {
  readAccountQuizResult,
  saveAccountQuizResult,
} from "../../utils/quizStorage.js";
import styles from "./lesson.module.css";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import { API_BASE } from "../../config.js";
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import {
  modulePracticePath,
  practiceModuleId,
} from "../../services/adaptivePractice.js";
import LoadingState from "../../components/LoadingState.jsx";
import QuizModesModal from "../../components/quizmodes/QuizModesModal.jsx";
import {
  fetchCourseContent,
  getCourseContentModules,
  getCourseLessonPages,
  getCourseQuizItems,
} from "./courseContent.js";
import {
  getStudentProgressStorageKey,
  saveStudentReadingProgress,
} from "../student/courses/studentCourseData.js";

const saveAccountLessonProgress = (baseKey, record) => {
  const key = getStudentProgressStorageKey(baseKey);
  if (key) localStorage.setItem(key, record);
};

const LESSON_QUIZ_LIMIT = 5;

// Compare selected answers case-insensitively while preserving meaningful characters.
const normalizeRecapAnswer = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const resolveRecapAnswer = (quiz) => {
  const raw = quiz?.correct_answer ?? quiz?.correctAnswer ?? quiz?.answer ?? "";
  const options = quiz?.options || [];
  const letter = /^\s*([a-z])[.)]?\s*$/i.exec(String(raw));
  if (letter && options.length)
    return options[letter[1].toUpperCase().charCodeAt(0) - 65] ?? raw;
  return String(raw).replace(/^\s*[A-D][.)]\s+/i, "");
};

const getLessonPageMedia = (page) => {
  const media = page?.media || {};
  const url = media.url || page?.mediaUrl || page?.media_url || "";

  if (!url) return null;

  return {
    url,
    name: media.name || page?.mediaName || page?.media_name || "Lesson media",
    type: media.type || page?.mediaType || page?.media_type || "",
  };
};

const getStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("puffy-user") || "null");
    return user?.userId || user?.id || user?.user_id || null;
  } catch {
    return null;
  }
};

function Lesson() {
  const { lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [identificationAnswer, setIdentificationAnswer] = useState("");
  useEffect(() => setIdentificationAnswer(""), [currentSlide]);
  const [quizResults, setQuizResults] = useState([]);
  const [hasTakenQuiz, setHasTakenQuiz] = useState(false);
  const [quizModesOpen, setQuizModesOpen] = useState(false);

  const modules = useMemo(() => getCourseContentModules(lesson), [lesson]);
  const requestedModuleIndex = Number(searchParams.get("module") || 0);
  const resumeRecap = searchParams.get("recap") === "1";
  const navigation = studentModuleNavigation(modules, requestedModuleIndex);
  const moduleIndex = navigation.moduleIndex;
  const activeModule = modules[moduleIndex] || null;
  const activeModuleId = practiceModuleId(activeModule);
  const moduleNumber = navigation.moduleNumber;
  const moduleCount = Math.max(navigation.moduleCount, 1);
  const modulePosition = Math.max(moduleNumber - 1, 0);
  const nextModuleIndex = navigation.nextModuleIndex;
  const nextModule = nextModuleIndex === null ? null : modules[nextModuleIndex];
  const courseId = lesson?.course_id || lessonId;
  const practicePath = modulePracticePath(courseId, activeModule);
  const moduleTitle = activeModule?.title || lesson?.title || "Untitled module";
  const moduleQuery = `?module=${moduleIndex}`;

  const quizResultKey = `lessonQuizResults_${lessonId}_module_${moduleIndex}`;

  useEffect(() => {
    let active = true;

    fetchCourseContent(lessonId)
      .then((content) => {
        if (active) setLesson(content);
      })
      .catch((err) => {
        console.error("Lesson content error:", err);
        if (active) setLesson(null);
      });

    return () => {
      active = false;
    };
  }, [lessonId]);

  const lessonSlides = useMemo(() => {
    return activeModule?.lessonPages?.length
      ? activeModule.lessonPages
      : getCourseLessonPages(lesson);
  }, [activeModule, lesson]);

  const moduleQuizItems = useMemo(() => {
    return activeModule?.quizItems ?? getCourseQuizItems(lesson);
  }, [activeModule, lesson]);

  const quizSlides = useMemo(() => {
    return moduleQuizItems
      .slice(0, LESSON_QUIZ_LIMIT)
      .filter((item) => item.type === "identification" || item.options?.length);
  }, [moduleQuizItems]);

  const allSlides = useMemo(() => {
    return [
      ...lessonSlides.map((slide) => ({
        type: "lesson",
        content: slide,
      })),
      ...quizSlides.map((slide) => ({
        type: "quiz",
        content: slide,
      })),
    ];
  }, [lessonSlides, quizSlides]);

  useEffect(() => {
    setCurrentSlide(0);
    setSelectedAnswers({});
    setQuizResults([]);
    setHasTakenQuiz(false);
  }, [lessonId, moduleIndex]);

  useEffect(() => {
    if (!allSlides.length) return;
    if (resumeRecap) {
      const firstRecap = allSlides.findIndex((slide) => slide.type === "quiz");
      if (firstRecap !== -1) {
        setCurrentSlide(firstRecap);
        return;
      }
    }
    const key = getStudentProgressStorageKey(`lessonProgress_${lessonId}_module_${moduleIndex}`);
    try {
      const saved = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
      const viewed = Number(saved?.last_viewed_card ?? saved?.studied_cards);
      if (Number.isFinite(viewed) && viewed > 0) {
        setCurrentSlide(Math.min(allSlides.length - 1, Math.max(0, viewed - 1)));
      }
    } catch { /* Ignore an invalid saved record. */ }
  }, [allSlides, lessonId, moduleIndex, resumeRecap]);

  useEffect(() => {
    if (allSlides.length === 0) return;

    const savedResults =
      readAccountQuizResult(quizResultKey) ||
      readAccountQuizResult("lessonQuizResults");

    if (!savedResults) {
      setHasTakenQuiz(false);
      setQuizResults([]);
      setSelectedAnswers({});
      return;
    }

    try {
      const parsed = JSON.parse(savedResults);

      const savedModuleIndex = Number(
        parsed.moduleIndex ?? parsed.module_index ?? 0,
      );

      if (
        Number(parsed.lessonId) !== Number(lessonId) ||
        savedModuleIndex !== moduleIndex ||
        (parsed.moduleId && String(parsed.moduleId) !== activeModuleId)
      ) {
        setHasTakenQuiz(false);
        setQuizResults([]);
        setSelectedAnswers({});
        return;
      }

      const savedAnswers = Array.isArray(parsed.answers) ? parsed.answers : [];
      const visibleQuizSlides = allSlides.filter(
        (slide) => slide.type === "quiz",
      );
      const visibleQuizQuestions = new Map(
        visibleQuizSlides.map((slide) => [slide.content.question, slide.content]),
      );
      const visibleSavedAnswers = savedAnswers.filter((item) => {
        const quiz = visibleQuizQuestions.get(item?.question);
        const answer = normalizeRecapAnswer(item?.userAnswer);
        return Boolean(
          quiz && answer && (
            quiz.type === "identification" ||
            quiz.options?.some((option) => normalizeRecapAnswer(option) === answer)
          ),
        );
      });
      const hasCompletedVisibleQuiz = visibleQuizSlides.every((slide) =>
        visibleSavedAnswers.some(
          (item) => item.question === slide.content.question,
        ),
      );

      setHasTakenQuiz(hasCompletedVisibleQuiz);
      setQuizResults(visibleSavedAnswers);

      const restoredAnswers = {};

      allSlides.forEach((slide, index) => {
        if (slide.type !== "quiz") return;

        const savedAnswer = visibleSavedAnswers.find(
          (item) => item.question === slide.content.question,
        );

        if (savedAnswer) {
          restoredAnswers[index] = savedAnswer.userAnswer;
        }
      });

      setSelectedAnswers(restoredAnswers);
    } catch {
      setHasTakenQuiz(false);
      setQuizResults([]);
      setSelectedAnswers({});
    }
  }, [quizResultKey, allSlides, lessonId, moduleIndex, activeModuleId]);

  const totalSlides = allSlides.length;

  const progressPercent = useMemo(() => {
    if (totalSlides === 0) return 0;
    return Math.round(((currentSlide + 1) / totalSlides) * 100);
  }, [currentSlide, totalSlides]);

  const currentItem = allSlides[currentSlide];
  const selectedAnswer = selectedAnswers[currentSlide];
  const currentLessonMedia =
    currentItem?.type === "lesson"
      ? getLessonPageMedia(currentItem.content)
      : null;

  const saveProgress = async (slideIndexToSave) => {
    const studiedSlides = totalSlides
      ? Math.min(Math.max(slideIndexToSave + 1, 0), totalSlides)
      : 0;
    const progressToSave = totalSlides
      ? Math.round((studiedSlides / totalSlides) * 100)
      : 100;
    const courseProgressToSave = Math.min(
      100,
      Math.round(((modulePosition + progressToSave / 100) / moduleCount) * 100),
    );

    saveStudentReadingProgress(lessonId, courseProgressToSave, {
      moduleIndex,
      moduleCount,
      moduleTitle,
      moduleProgress: progressToSave,
      totalSlides,
      studiedSlides,
      lastViewedSlide: studiedSlides,
    });

    const progressRecord = {
      module_index: moduleIndex,
      module_title: moduleTitle,
      total_cards: totalSlides,
      studied_cards: studiedSlides,
      progress_percent: progressToSave,
      course_progress_percent: courseProgressToSave,
      last_viewed_card: studiedSlides,
    };

    saveAccountLessonProgress(
      `lessonProgress_${lessonId}_module_${moduleIndex}`,
      JSON.stringify(progressRecord),
    );
    saveAccountLessonProgress(
      `lessonProgress_${lessonId}`,
      JSON.stringify({
        ...progressRecord,
        progress_percent: courseProgressToSave,
      }),
    );

    try {
      await fetch(`${API_BASE}/saveLessonProgress.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...lessonAuthHeaders(),
        },
        body: JSON.stringify({
          user_id: getStoredUserId(),
          lesson_id: Number(lessonId),
          total_cards: totalSlides,
          studied_cards: studiedSlides,
          last_viewed_card: studiedSlides,
        }),
      });
    } catch (error) {
      console.error("Error saving lesson progress:", error);
    }
  };

  const saveLessonResults = async (latestResults = quizResults) => {
    const finalScore = latestResults.filter((item) => item.isCorrect).length;

    const finalResult = {
      source: "module",
      lessonId: Number(lessonId),
      deckId: null,
      quizMode: "lesson",
      isTimedOut: false,
      score: finalScore,
      total: latestResults.length,
      answers: latestResults,
      courseId: lessonId,
      moduleIndex,
      moduleId: activeModuleId,
      moduleTitle,
      scopeType: "module",
      scopeTitle: moduleTitle,
      contentTitle: moduleTitle,
    };

    saveAccountQuizResult(quizResultKey, JSON.stringify(finalResult));
    if (String(courseId) !== lessonId) {
      saveAccountQuizResult(
        `lessonQuizResults_${courseId}_module_${moduleIndex}`,
        JSON.stringify(finalResult),
      );
    }
    saveAccountQuizResult("lessonQuizResults", JSON.stringify(finalResult));

    const completedCourseProgress = Math.min(
      100,
      Math.round(((modulePosition + 1) / moduleCount) * 100),
    );
    const completedRecord = {
      module_index: moduleIndex,
      module_title: moduleTitle,
      total_cards: totalSlides,
      studied_cards: totalSlides,
      progress_percent: 100,
      course_progress_percent: completedCourseProgress,
      last_viewed_card: totalSlides,
    };

    saveAccountLessonProgress(
      `lessonProgress_${lessonId}_module_${moduleIndex}`,
      JSON.stringify(completedRecord),
    );
    saveAccountLessonProgress(
      `lessonProgress_${lessonId}`,
      JSON.stringify({
        ...completedRecord,
        progress_percent: completedCourseProgress,
      }),
    );

    setHasTakenQuiz(true);

    await saveProgress(totalSlides - 1);
  };

  const continueToNextModule = () => {
    if (nextModule) {
      navigate(`/introduction/${lessonId}?module=${nextModuleIndex}`);
      return;
    }

    navigate(`/student/enrolled-courses/${lessonId}`);
  };

  const completeModuleAndPrompt = async (latestResults = quizResults) => {
    await saveLessonResults(latestResults);

    const continueLabel = nextModule
      ? `Continue to Module ${moduleNumber + 1}`
      : "Back to Course";
    const practicePrompt = nextModule
      ? `Do you want to practice Module ${moduleNumber} or continue to Module ${moduleNumber + 1}?`
      : `Do you want to practice Module ${moduleNumber} or return to the course?`;

    const result = await Swal.fire({
      imageUrl: "/images/complete.png",
        imageWidth: 300,
        imageAlt: "Module complete",
        customClass: {
          popup: "quiz-popup module-complete-popup",
          title: "quiz-popup-title",
          confirmButton: "quiz-popup-button",
        },
      title: `Module ${moduleNumber} Complete`,
      text: practicePath ? practicePrompt : "You completed this module.",
      showCancelButton: Boolean(practicePath),
      confirmButtonText: practicePath
        ? `Practice Module ${moduleNumber}`
        : continueLabel,
      cancelButtonText: continueLabel,
      allowOutsideClick: false,
      reverseButtons: false,
    });

    if (result.isConfirmed && practicePath) {
      setQuizModesOpen(true);
      return;
    }

    if (result.isConfirmed || result.dismiss === Swal.DismissReason.cancel) {
      continueToNextModule();
    }
  };

  const handleOptionSelect = async (slideIndex, option) => {
    if (hasTakenQuiz || selectedAnswers[slideIndex]) return;

    const quiz = currentItem?.content;
    const correctAnswer = resolveRecapAnswer(quiz);
    const explanation = quiz?.explanation || "No explanation available.";

    const isCorrect = Boolean(normalizeRecapAnswer(correctAnswer)) &&
      normalizeRecapAnswer(option) === normalizeRecapAnswer(correctAnswer);

    setSelectedAnswers((prev) => ({
      ...prev,
      [slideIndex]: option,
    }));

    const newResult = {
      question: quiz?.question || "Question not available",
      topic: quiz?.topic || "",
      cognitive_level: quiz?.cognitive_level || quiz?.cognitiveLevel || "",
      thinking_skill: quiz?.thinking_skill || quiz?.thinkingSkill || "",
      userAnswer: option,
      correctAnswer,
      explanation,
      isCorrect,
    };

    const updatedResults = [
      ...quizResults.filter((item) => item.question !== newResult.question),
      newResult,
    ];

    setQuizResults(updatedResults);
    // Keep partial recap answers as well as completed results across refreshes.
    saveAccountQuizResult(quizResultKey, JSON.stringify({
      lessonId: Number(lessonId), moduleIndex, moduleId: activeModuleId, answers: updatedResults,
    }));

    await Swal.fire({
      imageUrl: isCorrect ? "/images/correct.png" : "/images/wrong.png",
      imageWidth: 300,
      imageHeight: 200,
      imageAlt: isCorrect ? "Correct answer" : "Incorrect answer",
      html: `
        <div class="quiz-popup-content">
          <p class="quiz-popup-answer">
            <strong>Correct Answer:</strong><br />
            <span class="quiz-answer-value">${correctAnswer}</span>
          </p>

          ${
            explanation
              ? `<p class="quiz-popup-explanation">
                  <strong>Explanation:</strong><br />
                  ${explanation}
                </p>`
              : ""
          }
        </div>
      `,
      confirmButtonText: "Continue",
      allowOutsideClick: false,
      buttonsStyling: false,
      customClass: {
        popup: isCorrect
          ? "quiz-popup quiz-popup-correct"
          : "quiz-popup quiz-popup-incorrect",
        title: "quiz-popup-title",
        confirmButton: "quiz-popup-button",
        icon: "quiz-popup-icon",
      },
    });

    const nextSlide = slideIndex + 1;

    if (nextSlide < totalSlides) {
      await saveProgress(nextSlide);
      setCurrentSlide(nextSlide);
    } else {
      await completeModuleAndPrompt(updatedResults);
    }
  };

  const handleNext = async () => {
    const nextSlide = currentSlide + 1;

    if (
      currentItem?.type === "quiz" &&
      !selectedAnswers[currentSlide] &&
      !hasTakenQuiz
    ) {
      Swal.fire({
        imageUrl: "/images/reminder.png?v=2",
        imageWidth: 300,
        imageAlt: "Reminder to answer the quick check",
        customClass: {
          popup: "quiz-popup student-reminder-popup",
          title: "quiz-popup-title",
          confirmButton: "quiz-popup-button",
        },
        title: "Reminder: Answer First",
        text: "Please answer the quick check before continuing.",
      });
      return;
    }

    if (nextSlide < totalSlides) {
      await saveProgress(nextSlide);
      setCurrentSlide(nextSlide);
      return;
    }

    if (hasTakenQuiz) {
      await completeModuleAndPrompt(quizResults);
      return;
    }

    await completeModuleAndPrompt();
  };

  const handlePrevious = async () => {
    if (currentSlide > 0) {
      const prevSlide = currentSlide - 1;
      await saveProgress(prevSlide);
      setCurrentSlide(prevSlide);
    }
  };

  if (!lesson) {
    return <LoadingState />;
  }

  const hasOptions =
    currentItem?.type === "quiz" &&
    Array.isArray(currentItem?.content?.options) &&
    currentItem.content.options.length > 0;

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => navigate(`/student/enrolled-courses/${lessonId}`)}
      >
        ← Back to homepage
      </button>

      <div className={styles.content}>
        <div className={styles.ribbon}></div>

        <div className={styles.tabs}>
          <Link to={`/introduction/${lessonId}${moduleQuery}`}>
            <button className={styles.welcome} type="button">
              Introduction
            </button>
          </Link>

          <button className={styles.howitworksactive} type="button" disabled>
            Lesson
          </button>
        </div>
        <div className={styles.greets}>
          <p className={styles.slideCounter}>
            Slide {totalSlides > 0 ? currentSlide + 1 : 0} of {totalSlides}
          </p>

          <p className={styles.moduleEyebrow}>
            Module {moduleNumber} of {moduleCount}
          </p>

          <h2>
            Module {moduleNumber}: {moduleTitle}
          </h2>

          <div className={styles.progressWrapper}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <p className={styles.progressText}>{progressPercent}% complete</p>
          </div>

          <div className={styles.lessonText}>
            {!currentItem && "No lesson content yet."}

            {currentItem?.type === "lesson" && (
              <div className={styles.lessonSlide}>
                <h3 className={styles.lessonSlideTitle}>
                  {currentItem.content.title}
                </h3>

                {currentLessonMedia && (
                  <figure className={styles.lessonMedia}>
                    {currentLessonMedia.type.startsWith("video/") ? (
                      <video src={currentLessonMedia.url} controls />
                    ) : (
                      <img
                        src={currentLessonMedia.url}
                        alt="Lesson image"
                      />
                    )}
                  </figure>
                )}

                <div className={styles.lessonSlideContent}>
                  <LessonContent content={currentItem.content.content} />
                </div>
              </div>
            )}

            {currentItem?.type === "quiz" && (
              <div className={styles.quizSlide}>
                <h4 className={styles.quizTitle}>Quick Recap</h4>

                <p className={styles.quizQuestion}>
                  {currentItem.content.question || "No question available."}
                </p>

                {hasTakenQuiz && (
                  <p className={styles.noOptions}>
                    You already answered this quiz.
                  </p>
                )}

                {currentItem.content.type === "identification" ? (
                  <form
                    className={styles.optionsContainer}
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (identificationAnswer.trim())
                        handleOptionSelect(
                          currentSlide,
                          identificationAnswer.trim(),
                        );
                    }}
                  >
                    <input
                      className={styles.optionButton}
                      aria-label="Your identification answer"
                      placeholder="Type your answer"
                      maxLength={150}
                      value={identificationAnswer}
                      onChange={(event) =>
                        setIdentificationAnswer(event.target.value)
                      }
                      disabled={hasTakenQuiz || Boolean(selectedAnswer)}
                    />
                    <button
                      className={styles.button}
                      type="submit"
                      disabled={
                        hasTakenQuiz ||
                        Boolean(selectedAnswer) ||
                        !identificationAnswer.trim()
                      }
                    >
                      Submit answer
                    </button>
                  </form>
                ) : hasOptions ? (
                  <div className={styles.optionsContainer}>
                    {currentItem.content.options.map((option, index) => (
                      <button
                        key={index}
                        type="button"
                        className={`${styles.optionButton} ${
                          selectedAnswer === option ? styles.selectedOption : ""
                        }`}
                        onClick={() => handleOptionSelect(currentSlide, option)}
                        disabled={hasTakenQuiz || Boolean(selectedAnswer)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noOptions}>
                    No options available for this quiz.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className={styles.navButtons}>
            <button
              className={`${styles.button} ${styles.previousButton}`}
              onClick={handlePrevious}
              disabled={currentSlide === 0}
            >
              Previous
            </button>

            <button className={`${styles.button} ${styles.nextButton}`} onClick={handleNext}>
              {totalSlides === 0 || currentSlide === totalSlides - 1
                ? "Finish"
                : "Next"}
            </button>
          </div>
        </div>
      </div>
      {quizModesOpen && (
        <QuizModesModal
          source="module"
          onClose={() => setQuizModesOpen(false)}
          onSelectMode={(mode) => {
            setQuizModesOpen(false);
            navigate(modulePracticePath(courseId, activeModule, mode));
          }}
        />
      )}
    </div>
  );
}

export default Lesson;
