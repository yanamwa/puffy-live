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
} from "../../../services/adaptivePractice.js";
import {
  clearPracticeProgress,
  PracticeProgressKey,
} from "../../../utils/practiceResume.js";
import { studentModuleNavigation } from "../../../utils/studentModuleVisibility.js";
import LessonResult from "../../course/LessonResult.jsx";
import {
  fetchCourseContent,
  getCourseContentModules,
} from "../../course/courseContent.js";
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

function PracticeQuestionLoader({ intro }) {
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
      <p className={styles.waitMessage}>Please wait...</p>
    </div>
  );
}

function PracticeSession({ courseId, moduleId, mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const accountKey = getStudentProgressStorageKey("modulePractice");
  const savedState =
    location.state?.accountKey === accountKey ? location.state : null;
  const result = savedState?.practiceResult;
  const playing = Boolean(savedState?.playing);
  const [modules, setModules] = useState(null);
  const [courseError, setCourseError] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [recapRequired, setRecapRequired] = useState(false);
  const [saveError, setSaveError] = useState("");
  const opened = useRef(false);
  const pending = useRef(null);
  const saving = useRef(false);
  const active = useRef(false);
  const moduleIndex =
    modules?.findIndex((module) => practiceModuleId(module) === moduleId) ?? -1;
  const module = modules?.[moduleIndex];
  const moduleTitle = module?.title || "Module practice";
  const coursePath = `/student/enrolled-courses/${courseId}`;
  const recapPath = `/lesson/${courseId}?module=${moduleIndex}&recap=1`;
  const { moduleNumber, nextModuleIndex } = studentModuleNavigation(
    modules || [],
    moduleIndex,
  );
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
    attempt && `${accountKey}:${courseId}:${moduleId}:${attempt.id}:${mode}`;
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
    fetchCourseContent(courseId)
      .then((course) => {
        if (current) setModules(getCourseContentModules(course));
      })
      .catch(() => {
        if (current) setCourseError("We couldn't load this course.");
      });
    return () => {
      current = false;
      active.current = false;
    };
  }, [courseId]);

  useEffect(() => {
    if (!mode || moduleIndex < 0 || result || opened.current) return;
    opened.current = true;

    async function loadAttempt() {
      try {
        const data = await requestModulePractice("start", {
          courseId: Number(courseId),
          moduleId,
          mode,
          recapAnswers: readModuleRecapAnswers(courseId, moduleIndex, moduleId),
        });
        if (active.current) setAttempt(data.attempt);
      } catch (error) {
        if (!active.current) return;
        if (error.code === "QUICK_RECAP_REQUIRED") {
          setRecapRequired(true);
          return;
        }
        navigate(coursePath, { replace: true });
      }
    }

    void loadAttempt();
  }, [courseId, coursePath, moduleId, moduleIndex, mode, navigate, result]);

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

  if (courseError || (modules && !module)) {
    return (
      <main className={styles.page}>
        <p role="alert">{courseError || "This module is unavailable."}</p>
        <Link to={coursePath}>Back to course</Link>
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

  if (!session) return <PracticeQuestionLoader intro={intro} />;

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
  const selectedMode = searchParams.get("mode");
  const mode = Object.hasOwn(modes, selectedMode) ? selectedMode : null;
  return (
    <PracticeSession
      key={`${courseId}/${moduleId}/${mode}`}
      courseId={courseId}
      moduleId={moduleId}
      mode={mode}
    />
  );
}
