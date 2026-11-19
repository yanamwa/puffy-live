import { useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ADMIN_MODES_EVENT,
  ADMIN_MODES_KEY,
  fetchQuizModes,
} from "../../services/quizModeApi.js";
import ModeCard from "./ModeCard.jsx";
import styles from "./QuizModesModal.module.css";

function resolveModeImage(mode) {
  const image = String(mode.image || "").trim();

  if (image.startsWith("data:image/")) return image;
  if (!image && mode.kind === "mixed") return "/images/mixed_match.png";
  if (!image) return "/images/flashcard.png";
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("/")) return image;

  return `/images/${image}`;
}

const modeRouteFallbacks = {
  flashcard: "/flashcards-tutorial",
  qna: "/QandA-tutorial",
  multiple: "/multipleChoice-tutorial",
  matching: "/Matching-tutorial",
  timed: "/timedquiz-tutorial",
  mixed: "/random-modes-tutorial",
  survival: "/random-modes-tutorial",
};

function getModeRoute(mode, modeKind) {
  const route = String(mode.route || "").trim();
  return route || modeRouteFallbacks[modeKind] || modeRouteFallbacks.flashcard;
}

function buildPracticeRoute(route, source, id) {
  const cleanRoute = String(route || "").replace(/\/+$/, "");

  if (!cleanRoute) return "";
  if (!id) return cleanRoute;

  if (cleanRoute.includes(":lessonId")) {
    return cleanRoute.replace(":lessonId", encodeURIComponent(id));
  }

  if (cleanRoute.includes(":deckId")) {
    return cleanRoute.replace(":deckId", encodeURIComponent(id));
  }

  return `${cleanRoute}/${source === "deck" ? "deck" : "lesson"}/${encodeURIComponent(
    id,
  )}`;
}

export default function QuizModesModal({
  source,
  deckId,
  lessonId,
  cards = [],
  quizzes = [],
  onClose,
  onSelectMode,
}) {
  const navigate = useNavigate();
  const [modes, setModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, reloadModes] = useReducer((version) => version + 1, 0);

  const isDeck = source === "deck";
  const isLesson = ["lesson", "module", "course"].includes(source);

  useEffect(() => {
    let active = true;

    async function loadModes() {
      setLoading(true);
      setLoadError("");
      try {
        const loadedModes = await fetchQuizModes();
        if (active) setModes(loadedModes);
      } catch (error) {
        if (active)
          setLoadError(error.message || "Quiz modes could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadModes();
    return () => {
      active = false;
    };
  }, [loadVersion]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === ADMIN_MODES_KEY || event.key === null) reloadModes();
    };

    window.addEventListener(ADMIN_MODES_EVENT, reloadModes);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(ADMIN_MODES_EVENT, reloadModes);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const getQuestionCount = () => {
    if (isDeck) return cards.length;
    if (isLesson) return quizzes.length;
    return 0;
  };

  const calculateTimedQuizSeconds = () => {
    const totalSeconds = getQuestionCount() * 90;
    return Math.min(Math.max(totalSeconds, 120), 1800);
  };

  const handleStartPractice = (mode) => {
    const modeKind = mode.kind;
    if (onSelectMode) {
      onSelectMode(modeKind);
      return;
    }
    // This picker launches practice only. Never inherit a previous Main Quiz flag.
    let savedScope = {};
    try { savedScope = JSON.parse(localStorage.getItem("practiceScope") || "{}"); } catch { /* Start with a clean practice scope. */ }
    const routeId = isDeck ? deckId : lessonId;
    const storedId = localStorage.getItem(isDeck ? "practiceDeckId" : "practiceLessonId");
    const sameScope = String(storedId || "") === String(routeId || "");
    localStorage.setItem("practiceScope", JSON.stringify({
      ...(sameScope ? savedScope : {}),
      scopeType: source === "deck" ? "deck" : source === "course" ? "course" : source === "module" ? "module" : "lesson",
    }));
    const route = getModeRoute(mode, modeKind);
    const selectedMode = {
      ...mode,
      quizMode: modeKind,
      route,
    };

    if (modeKind === "timed") {
      localStorage.setItem(
        "timedQuizSeconds",
        String(calculateTimedQuizSeconds()),
      );
    } else {
      localStorage.removeItem("timedQuizSeconds");
    }

    localStorage.setItem("practiceMode", JSON.stringify(selectedMode));

    if (isDeck) {
      localStorage.setItem("practiceSource", "deck");
      localStorage.setItem("practiceDeckId", deckId || "");
      localStorage.setItem("practiceCards", JSON.stringify(cards));

      const nextRoute = buildPracticeRoute(route, "deck", deckId);

      if (nextRoute) {
        navigate(nextRoute);
      } else {
        onClose?.();
      }
      return;
    }

    if (isLesson) {
      localStorage.setItem("practiceSource", source || "lesson");
      localStorage.setItem("practiceLessonId", lessonId || "");
      localStorage.setItem("practiceQuizzes", JSON.stringify(quizzes));

      const nextRoute = buildPracticeRoute(route, source || "lesson", lessonId);

      if (nextRoute) {
        navigate(nextRoute);
      } else {
        onClose?.();
      }
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalBox}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Choose Quiz Type</h2>
          <button
            className={styles.closeModal}
            type="button"
            onClick={onClose}
            aria-label="Close quiz modes"
          >
            x
          </button>
        </div>

        <div className={styles.cardsScroll}>
          <div className={styles.modeOptions}>
            {loading ? (
              <p className={styles.emptyModes}>Loading quiz modes...</p>
            ) : loadError ? (
              <section className={styles.emptyModes}>
                <p role="alert">{loadError}</p>
                <button type="button" className={styles.retryButton} onClick={reloadModes}>
                  Try again
                </button>
              </section>
            ) : modes.length === 0 ? (
              <p className={styles.emptyModes}>No quiz modes available.</p>
            ) : (
              modes.map((mode) => (
                <ModeCard
                  key={mode.id}
                  title={mode.title || mode.mode_name}
                  img={resolveModeImage(mode)}
                  desc={mode.description}
                  onClick={() => handleStartPractice(mode)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
