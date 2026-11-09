import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { API_BASE } from "../../../config.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import { requiresStudentPasswordChange } from "../../../utils/passwordPolicy.js";
import { StudentTutorialContext } from "./StudentTutorialContext.js";
import {
  STUDENT_SETTINGS_PATH,
  tutorialStepPath,
  tutorialSteps,
} from "./studentTutorialSteps.js";
import "./StudentTutorial.css";

const edge = 12;
const gap = 18;
const numberedStepIds = [
  ...new Set(tutorialSteps.map((step) => step.numberedStep ?? step.id)),
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export default function StudentTutorial({ step, children }) {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const preview = useRef(null);
  const panel = useRef(null);
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [placement, setPlacement] = useState(null);
  const index = tutorialSteps.indexOf(step);
  const lastStep = index === tutorialSteps.length - 1;
  const stepNumber = numberedStepIds.indexOf(step.numberedStep ?? step.id) + 1;

  useLayoutEffect(() => {
    const target = preview.current.querySelector(step.target);
    const dialog = panel.current;
    target?.scrollIntoView({ block: "center", behavior: "instant" });
    dialog.focus({ preventScroll: true });

    function positionPanel() {
      const bounds = target?.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const { width: panelWidth, height: panelHeight } =
        dialog.getBoundingClientRect();

      if (!bounds || bounds.bottom <= 0 || bounds.top >= height) {
        setPlacement(null);
        return;
      }

      const left = clamp(bounds.left - 4, 0, width);
      const right = clamp(bounds.right + 4, 0, width);
      const top = clamp(bounds.top - 4, 0, height);
      const bottom = clamp(bounds.bottom + 4, 0, height);
      const center = (left + right) / 2;
      const below =
        height - bottom >= panelHeight + gap + edge || bottom + top < height;
      const panelLeft = clamp(
        center - panelWidth / 2,
        edge,
        width - panelWidth - edge,
      );
      const anchor = below ? bottom + gap : top - panelHeight - gap;
      const panelTop = clamp(anchor, edge, height - panelHeight - edge);

      setPlacement({
        spotlight: { left, top, width: right - left, height: bottom - top },
        panel: {
          left: panelLeft,
          top: panelTop,
          bottom: "auto",
          "--tutorial-arrow-x": `${clamp(center - panelLeft, 18, panelWidth - 18)}px`,
        },
        arrow: panelTop === anchor ? (below ? "above" : "below") : undefined,
      });
    }

    const observer = new ResizeObserver(positionPanel);
    observer.observe(dialog);
    if (target) observer.observe(target);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    positionPanel();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [step]);

  function goToStep(nextIndex) {
    setError("");
    navigate(tutorialStepPath(tutorialSteps[nextIndex]), { replace: true });
  }

  async function confirmSkipTutorial() {
    const { isConfirmed } = await Swal.fire({
      title: "Are you sure?",
      text: requiresStudentPasswordChange(user)
        ? "Skip the tutorial and go to Settings to change your temporary password?"
        : "Skip the tutorial and go to Settings?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Skip tutorial",
      cancelButtonText: "Continue tutorial",
      confirmButtonColor: "#225a90",
      cancelButtonColor: "#516881",
      reverseButtons: true,
      focusCancel: true,
      customClass: { container: "student-tutorial-skip-confirmation" },
    });

    if (isConfirmed) await completeTutorial();
  }

  async function completeTutorial() {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/users/me/complete-tutorial`, {
        method: "POST",
        credentials: "include",
        headers: lessonAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true) {
        throw new Error(
          data.message || "Could not save the tutorial. Please try again.",
        );
      }

      updateUser({
        onboardingCompleted: true,
        onboarding_completed: 1,
        studentTutorialPending: false,
      });
      navigate(STUDENT_SETTINGS_PATH, { replace: true });
    } catch (requestError) {
      setError(
        requestError.message ||
          "Could not save the tutorial. Please try again.",
      );
      saving.current = false;
      setIsSaving(false);
    }
  }

  function keepFocusInPanel(event) {
    if (event.key !== "Tab") return;
    const buttons = [
      ...panel.current.querySelectorAll("button:not(:disabled)"),
    ];
    const focusedIndex = buttons.indexOf(document.activeElement);
    const nextIndex =
      focusedIndex < 0
        ? event.shiftKey
          ? buttons.length - 1
          : 0
        : (focusedIndex + (event.shiftKey ? -1 : 1) + buttons.length) %
          buttons.length;
    event.preventDefault();
    (buttons[nextIndex] || panel.current).focus();
  }

  return (
    <StudentTutorialContext.Provider value={true}>
      <div ref={preview} inert>
        {children}
      </div>
      {createPortal(
        <div className="student-tutorial-layer">
          {placement ? (
            <div
              className="student-tutorial-spotlight"
              style={placement.spotlight}
            />
          ) : (
            <div className="student-tutorial-dim" />
          )}
          <section
            ref={panel}
            className="student-tutorial-panel"
            style={placement?.panel}
            data-arrow={placement?.arrow}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-tutorial-title"
            aria-describedby="student-tutorial-description"
            tabIndex={-1}
            onKeyDown={keepFocusInPanel}
          >
            <p className="student-tutorial-progress">
              Step {stepNumber} of {numberedStepIds.length}
            </p>
            <h2 id="student-tutorial-title">{step.title}</h2>
            <p id="student-tutorial-description">
              {step.description}
              {lastStep &&
                requiresStudentPasswordChange(user) &&
                " Change your temporary password there to unlock your account."}
            </p>
            {error && (
              <p className="student-tutorial-error" role="alert">
                {error}
              </p>
            )}
            <div className="student-tutorial-actions">
              <button
                type="button"
                onClick={confirmSkipTutorial}
                disabled={isSaving}
              >
                Skip tutorial
              </button>
              <button
                type="button"
                onClick={() => goToStep(index - 1)}
                disabled={index === 0 || isSaving}
              >
                Previous
              </button>
              <button
                type="button"
                className="student-tutorial-next"
                onClick={
                  lastStep ? completeTutorial : () => goToStep(index + 1)
                }
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : lastStep ? "Finish tutorial" : "Next"}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </StudentTutorialContext.Provider>
  );
}
