import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import QuizModesModal from "../../../components/quizmodes/QuizModesModal.jsx";
import {
  modulePracticePath,
  practiceModuleId,
  readModuleRecapAnswers,
  requestModulePractice,
  prepareModulePractice,
} from "../../../services/adaptivePractice.js";
import {
  clearPracticeProgress,
  PracticeProgressKey,
} from "../../../utils/practiceResume.js";
import { studentModuleNavigation } from "../../../utils/studentModuleVisibility.js";
import LessonResult from "../../course/LessonResult.jsx";
import { getCourseContentModules } from "../../course/courseContent.js";
import { fetchCourse } from "../../../services/courseApi.js";
import Flashcards from "../../quizzes/inQuiz/inQuiz/realFlashcard.jsx";
import QandA from "../../quizzes/inQuiz/inQuiz/qanda.jsx";
import MultipleChoice from "../../quizzes/inQuiz/inQuiz/multiplechoice.jsx";
import Matching from "../../quizzes/inQuiz/inQuiz/matching.jsx";
import TimedQuiz from "../../quizzes/inQuiz/inQuiz/timedinquiz.jsx";
import MixedMode from "../../quizzes/inQuiz/inQuiz/randommodes.jsx";
import FlashcardsTutorial, {
  flashcardIntro,
} from "../../quizzes/inQuiz/tutorials/flashcards-tutorial.jsx";
import QandATutorial, {
  qnaIntro,
} from "../../quizzes/inQuiz/tutorials/QandA-tutorial.jsx";
import MultipleChoiceTutorial, {
  multipleChoiceIntro,
} from "../../quizzes/inQuiz/tutorials/multipleChoice-Tutorial.jsx";
import MatchingTutorial, {
  matchingIntro,
} from "../../quizzes/inQuiz/tutorials/matching-tutorial.jsx";
import TimedTutorial, {
  timedIntro,
} from "../../quizzes/inQuiz/tutorials/timedquiz-tutorial.jsx";
import MixedModeTutorial from "../../quizzes/inQuiz/tutorials/randommodes.jsx";
import { getStudentProgressStorageKey } from "./studentCourseData.js";
import styles from "./ModulePractice.module.css";
import { coursePracticeModule } from "../../quizzes/inQuiz/practiceSession.js";

const modes = {
  flashcard: [FlashcardsTutorial, Flashcards, flashcardIntro],
  qna: [QandATutorial, QandA, qnaIntro],
  multiple: [MultipleChoiceTutorial, MultipleChoice, multipleChoiceIntro],
  matching: [MatchingTutorial, Matching, matchingIntro],
  timed: [TimedTutorial, TimedQuiz, timedIntro],
  mixed: [
    MixedModeTutorial,
    MixedMode,
    {
      frames: ["/images/mixed_match.png"],
      screen: flashcardIntro.screen,
      artwork: styles.mixedIntroImage,
    },
  ],
};

function PracticeQuestionLoader({ intro, status }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const { frames, screen, artwork } = intro;

  useEffect(() => {
    if (frames.length < 2) return;
    const interval = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 220);
    return () => clearInterval(interval);
  }, [frames]);

  return (
    <div
      className={`${screen} ${styles.loadingScreen}`}
      role="status"
      aria-label="Loading practice questions"
    >
      <img src={frames[frameIndex]} className={artwork} alt="" />
      <p className={styles.waitMessage}>
        {status === "queued"
          ? "Your practice is in the queue…"
          : status === "running"
            ? "Preparing and checking your 10 questions…"
            : "Loading your practice…"}
      </p>
    </div>
  );
}

function PracticeSession({ courseId, moduleId, mode, onRetry }) {
  const location = useLocation();
  const navigate = useNavigate();
  const accountKey = getStudentProgressStorageKey("modulePractice");
  const savedState =
    location.state?.accountKey === accountKey ? location.state : null;
  const result = savedState?.practiceResult;
  const playing = Boolean(savedState?.playing);
  const [modules, setModules] = useState(null);
  const [practiceUnavailable, setPracticeUnavailable] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [recapRequired, setRecapRequired] = useState(false);
  const [preparationStatus, setPreparationStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const pending = useRef(null);
  const saving = useRef(false);
  const active = useRef(false);
  const moduleIndex =
    modules?.findIndex((module) => practiceModuleId(module) === moduleId) ?? -1;
  const module = modules?.[moduleIndex];
  const moduleTitle = module?.title || "Module practice";
  const coursePath = `/student/enrolled-courses/${courseId}`;
  const isCoursePractice = moduleId === "all-modules";
  const recapPath = isCoursePractice
    ? coursePath
    : `/lesson/${courseId}?module=${moduleIndex}&recap=1`;
  const { moduleNumber, nextModuleIndex } = isCoursePractice
    ? { moduleNumber: null, nextModuleIndex: null }
    : studentModuleNavigation(modules || [], moduleIndex);
  const nextModuleTitle = modules?.[nextModuleIndex]?.title || "";
  const practiceReview = useMemo(
    () =>
      result && {
        ...result,
        source: "module",
        courseId,
        moduleId,
        moduleIndex,
        moduleNumber,
        nextModuleIndex,
        nextModuleTitle,
        quizMode: mode,
        contentTitle: moduleTitle,
      },
    [
      result,
      courseId,
      moduleId,
      moduleIndex,
      moduleNumber,
      nextModuleIndex,
      nextModuleTitle,
      mode,
      moduleTitle,
    ],
  );
  const backToCourse = () => navigate(coursePath);
  const progressKey =
    attempt &&
    `${accountKey}:${courseId}:${moduleId}:${attempt.id}:${mode}:${attempt.questions.length}`;
  const session = useMemo(
    () =>
      attempt && {
        source: "module",
        lessonId: `module-practice-${attempt.id}`,
        items: attempt.questions,
        title: moduleTitle,
        scope: { courseId, scopeId: moduleId, scopeType: "module" },
      },
    [attempt, courseId, moduleId, moduleTitle],
  );

  useEffect(() => {
    let current = true;
    active.current = true;
    fetchCourse(courseId)
      .then((course) => {
        if (current) {
          const contentModules = getCourseContentModules(course);
          setModules(
            isCoursePractice
              ? [
                  ...contentModules,
                  coursePracticeModule(course, contentModules),
                ]
              : contentModules,
          );
        }
      })
      .catch((error) => {
        if (current) {
          console.error("Practice course loading failed", error);
          setPracticeUnavailable(error.message || "The course could not be loaded.");
        }
      });
    return () => {
      current = false;
      active.current = false;
    };
  }, [courseId, isCoursePractice]);

  useEffect(() => {
    if (!mode || !module || result) return;
    const controller = new AbortController();
    setRecapRequired(false);

    async function loadAttempt() {
      try {
        const prepared = await prepareModulePractice(
          {
            courseId: Number(courseId),
            moduleId,
            mode,
            recapAnswers: isCoursePractice
              ? modules
                  .slice(0, -1)
                  .flatMap((item, index) =>
                    readModuleRecapAnswers(courseId, index, item.id),
                  )
                  .filter((answer) =>
                    module.quizItems
                      .slice(0, 5)
                      .some((item) => item.question === answer.question),
                  )
                  .slice(0, 5)
              : readModuleRecapAnswers(courseId, moduleIndex, moduleId),
          },
          {
            signal: controller.signal,
            onProgress: setPreparationStatus,
          },
        );
        if (!controller.signal.aborted) setAttempt(prepared);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.code === "QUICK_RECAP_REQUIRED") {
          setRecapRequired(true);
          return;
        }
        console.error("Practice preparation failed", error);
        setPracticeUnavailable(error.message || "Practice could not be prepared. Please try again.");
      }
    }

    void loadAttempt();
    return () => controller.abort();
  }, [
    courseId,
    moduleId,
    moduleIndex,
    module,
    mode,
    result,
    modules,
    isCoursePractice,
  ]);

  async function finish(answers, finishReason) {
    if (!active.current || saving.current) return;
    saving.current = true;
    pending.current = { answers, finishReason };
    setSaveError("");
    try {
      const answersById = new Map(
        answers.map((answer) => [answer.cardId, answer.userAnswer]),
      );
      const { result: submitted } = await requestModulePractice("submit", {
        attemptId: attempt.id,
        mode,
        answers: attempt.questions.map(({ id }) => ({
          questionId: id,
          answer: String(answersById.get(id) ?? "").trim(),
        })),
      });
      clearPracticeProgress(progressKey);
      if (active.current)
        navigate(location.pathname + location.search, {
          replace: true,
          state: {
            accountKey,
            practiceResult: {
              ...submitted,
              timedOut: finishReason === "timeout",
            },
          },
        });
    } catch (error) {
      if (active.current) setSaveError(error.message);
    } finally {
      saving.current = false;
    }
  }

  if (practiceUnavailable || (modules && !module)) {
    return (
      <main className={styles.page}>
        <h1>Practice unavailable</h1>
        <p role="alert">
          {practiceUnavailable ||
            "This practice module is no longer available."}
        </p>
        <button type="button" className={styles.primary} onClick={onRetry}>
          Try again
        </button>
        <p>
          <Link to={coursePath}>Back to course</Link>
        </p>
      </main>
    );
  }
  if (!mode) {
    return (
      <QuizModesModal
        source="module"
        onClose={backToCourse}
        onSelectMode={(selected) =>
          navigate(modulePracticePath(courseId, { id: moduleId }, selected), {
            replace: true,
          })
        }
      />
    );
  }
  if (result) {
    return module ? (
      <LessonResult
        practiceResult={practiceReview}
        onPracticeAgain={() => navigate(location.pathname)}
      />
    ) : null;
  }
  const [Tutorial, Quiz, intro] = modes[mode];
  if (playing && session) {
    return (
      <PracticeProgressKey.Provider value={progressKey}>
        {saveError && (
          <div className={styles.page} role="alert">
            <p>{saveError}</p>
            <button
              className={styles.primary}
              type="button"
              onClick={() =>
                finish(pending.current.answers, pending.current.finishReason)
              }
            >
              Try saving again
            </button>
            <p>
              <Link to={coursePath}>Back to course</Link>
            </p>
          </div>
        )}
        <Quiz
          adaptivePractice={{ session, onBack: backToCourse, onFinish: finish }}
        />
      </PracticeProgressKey.Provider>
    );
  }
  if (recapRequired) {
    return (
      <main className={styles.page}>
        <p role="alert">Finish the Quick Recap to start practice.</p>
        <Link className={styles.primary} to={recapPath}>
          Finish Quick Recap
        </Link>
        <p>
          <Link to={coursePath}>Back to course</Link>
        </p>
      </main>
    );
  }

  if (!session)
    return <PracticeQuestionLoader intro={intro} status={preparationStatus} />;

  return (
    <Tutorial
      skipIntro
      onBack={backToCourse}
      onStart={() =>
        navigate(location.pathname + location.search, {
          replace: true,
          state: { accountKey, playing: true },
        })
      }
    />
  );
}

export default function ModulePractice() {
  const { courseId, moduleId } = useParams();
  const [searchParams] = useSearchParams();
  const [retry, setRetry] = useState(0);
  const selectedMode = searchParams.get("mode");
  const mode = Object.hasOwn(modes, selectedMode) ? selectedMode : null;
  return (
    <PracticeSession
      key={`${courseId}/${moduleId}/${mode}/${retry}`}
      courseId={courseId}
      moduleId={moduleId}
      mode={mode}
      onRetry={() => setRetry((count) => count + 1)}
    />
  );
}
