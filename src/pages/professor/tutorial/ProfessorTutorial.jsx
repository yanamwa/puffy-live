import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  professorTutorialStepPath,
  professorTutorialSteps,
} from "./professorTutorialSteps.js";
import "../../student/tutorial/StudentTutorial.css";
import "./ProfessorTutorial.css";

const edge = 12;
const gap = 18;
const minSidebarPanelWidth = 220;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function visibleBounds(bounds, width, height) {
  return {
    left: clamp(bounds.left - 4, 0, width),
    right: clamp(bounds.right + 4, 0, width),
    top: clamp(bounds.top - 4, 0, height),
    bottom: clamp(bounds.bottom + 4, 0, height),
  };
}

export default function ProfessorTutorial({
  step,
  onFinish,
  onSkip = onFinish,
}) {
  const navigate = useNavigate();
  const panel = useRef(null);
  const saving = useRef(false);
  const [placement, setPlacement] = useState(null);
  const [popupContainer, setPopupContainer] = useState(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const index = professorTutorialSteps.indexOf(step);
  const lastStep = index === professorTutorialSteps.length - 1;
  const popupMode = Boolean(step.popupTarget);
  const popupAnchor =
    popupMode &&
    popupContainer?.isConnected &&
    popupContainer.matches(step.popupTarget)
      ? popupContainer
      : null;
  const popupTarget = popupAnchor
    ? (popupAnchor.closest(".swal2-container, dialog") ?? popupAnchor)
    : null;

  useLayoutEffect(() => {
    if (!step.popupTarget) {
      setPopupContainer(null);
      return;
    }
    const syncPopupContainer = () => {
      const next = document.querySelector(step.popupTarget);
      setPopupContainer((current) => (current === next ? current : next));
    };
    syncPopupContainer();
    const observer = new MutationObserver(syncPopupContainer);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [step]);

  useLayoutEffect(() => {
    if (step.popupTarget) {
      setPlacement(null);
      return;
    }
    const layout = document.querySelector(".professor-layout");
    if (!layout) return;
    const previousFocus = document.activeElement;
    // Keep the preview's scroll container available while its controls are inert.
    const background = step.allowPreviewScroll
      ? layout.querySelectorAll(
          ".professor-sidebar, .professor-header, .professor-content > *",
        )
      : [layout];
    const previousInert = Array.from(background, (element) => ({
      element,
      inert: element.inert,
    }));
    previousInert.forEach(({ element }) => {
      element.inert = true;
    });

    return () => {
      previousInert.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [step]);

  useLayoutEffect(() => {
    const layout = document.querySelector(".professor-layout");
    const dialog = panel.current;
    if (!dialog) return;
    const popupBoundary = step.popupTarget
      ? popupAnchor?.closest(".swal2-popup, dialog")
      : null;

    const findTarget = () =>
      step.popupTarget
        ? document.querySelector(step.target)
        : layout?.querySelector(step.target);
    let target = findTarget();
    let panelAnchor = step.panelAnchor
      ? (document.querySelector(step.panelAnchor) ?? target)
      : target;
    const sidebar = step.preferSidebar
      ? layout?.querySelector(".professor-sidebar")
      : null;
    const lastSidebarLink = sidebar?.querySelector(
      ".professor-link:last-child",
    );
    const logout = sidebar?.querySelector(".professor-logout");
    panelAnchor?.scrollIntoView({ block: "nearest", behavior: "instant" });

    function positionPanel() {
      const bounds = target?.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const { width: panelWidth, height: panelHeight } =
        dialog.getBoundingClientRect();

      if (
        !bounds?.width ||
        !bounds.height ||
        bounds.bottom <= 0 ||
        bounds.top >= height
      ) {
        setPlacement(null);
        return;
      }

      const frame = visibleBounds(bounds, width, height);
      const spotlight = {
        left: frame.left,
        top: frame.top,
        width: frame.right - frame.left,
        height: frame.bottom - frame.top,
      };

      if (sidebar) {
        const sidebarBounds = sidebar.getBoundingClientRect();
        const sidebarLeft = Math.max(edge, sidebarBounds.left + edge);
        const sidebarRight = Math.min(
          frame.left - gap,
          sidebarBounds.right - edge,
        );
        const availableWidth = sidebarRight - sidebarLeft;

        if (availableWidth >= minSidebarPanelWidth) {
          const menuBottom =
            lastSidebarLink?.getBoundingClientRect().bottom ?? frame.top;
          const sidebarBottom =
            logout?.getBoundingClientRect().top ?? sidebarBounds.bottom;
          setPlacement({
            spotlight,
            panel: {
              left: sidebarLeft,
              top: clamp(
                menuBottom + gap,
                edge,
                Math.min(height, sidebarBottom) - panelHeight - edge,
              ),
              bottom: "auto",
              maxWidth: availableWidth,
            },
          });
          return;
        }
      }

      if (popupBoundary) {
        const popupBounds = popupBoundary.getBoundingClientRect();
        const popupRight = Math.max(frame.right, popupBounds.right);
        const availableWidth = width - popupRight - gap - edge;

        if (availableWidth >= minSidebarPanelWidth) {
          const center = (frame.top + frame.bottom) / 2;
          const panelTop = clamp(
            center - panelHeight / 2,
            edge,
            height - panelHeight - edge,
          );
          const panelWidth = Math.min(
            dialog.getBoundingClientRect().width,
            availableWidth,
          );
          setPlacement({
            spotlight,
            panel: {
              left: popupRight + gap,
              top: panelTop,
              bottom: "auto",
              width: panelWidth,
              maxWidth: availableWidth,
              "--tutorial-arrow-y": `${clamp(center - panelTop, 18, panelHeight - 18)}px`,
            },
            arrow: "left",
          });
          return;
        }
      }

      const { left, right, top, bottom } =
        panelAnchor === target
          ? frame
          : visibleBounds(panelAnchor.getBoundingClientRect(), width, height);

      if (right + gap + panelWidth + edge <= width) {
        const center = (top + bottom) / 2;
        const panelTop = clamp(
          center - panelHeight / 2,
          edge,
          height - panelHeight - edge,
        );
        setPlacement({
          spotlight,
          panel: {
            left: right + gap,
            top: panelTop,
            bottom: "auto",
            "--tutorial-arrow-y": `${clamp(center - panelTop, 18, panelHeight - 18)}px`,
          },
          arrow: "left",
        });
        return;
      }

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
        spotlight,
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
    if (panelAnchor && panelAnchor !== target) observer.observe(panelAnchor);
    if (sidebar) observer.observe(sidebar);
    const targetObserver = new MutationObserver(() => {
      const nextTarget = findTarget();
      const nextAnchor = step.panelAnchor
        ? (document.querySelector(step.panelAnchor) ?? nextTarget)
        : nextTarget;

      if (nextTarget !== target) {
        if (target) observer.unobserve(target);
        target = nextTarget;
        if (target) {
          observer.observe(target);
          target.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
      }
      if (nextAnchor !== panelAnchor) {
        if (panelAnchor && panelAnchor !== target) observer.unobserve(panelAnchor);
        panelAnchor = nextAnchor;
        if (panelAnchor && panelAnchor !== target) observer.observe(panelAnchor);
      }
      positionPanel();
    });
    const observerRoot = step.popupTarget ? document.body : layout;
    if (observerRoot)
      targetObserver.observe(observerRoot, { childList: true, subtree: true });
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    positionPanel();

    return () => {
      observer.disconnect();
      targetObserver.disconnect();
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [step, popupAnchor, popupTarget]);

  useLayoutEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, [step, popupTarget, confirmingSkip, isSaving, error]);

  function move(nextIndex) {
    setError("");
    navigate(professorTutorialStepPath(professorTutorialSteps[nextIndex]), {
      replace: true,
    });
  }

  function toggleSkip(confirm) {
    setError("");
    setConfirmingSkip(confirm);
  }

  async function complete(callback) {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setError("");

    try {
      await callback();
    } catch {
      setError("Could not save your tutorial progress. Please try again.");
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  function keepFocusInPanel(event) {
    if (event.key !== "Tab") return;
    const buttons = [
      ...panel.current.querySelectorAll("button:not(:disabled)"),
    ];
    const current = buttons.indexOf(document.activeElement);
    const next =
      current < 0
        ? event.shiftKey
          ? buttons.length - 1
          : 0
        : (current + (event.shiftKey ? -1 : 1) + buttons.length) %
          buttons.length;
    event.preventDefault();
    (buttons[next] || panel.current).focus();
  }

  if (popupMode && !popupTarget) return null;

  return createPortal(
    <div
      className="student-tutorial-layer professor-tutorial-layer"
      data-scroll-preview={step.allowPreviewScroll ? "" : undefined}
    >
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
        className="student-tutorial-panel professor-tutorial-panel"
        style={placement?.panel}
        data-arrow={placement?.arrow}
        role={popupMode ? "region" : "dialog"}
        aria-modal={popupMode ? undefined : "true"}
        aria-labelledby="professor-tutorial-title"
        aria-describedby="professor-tutorial-description"
        aria-busy={isSaving}
        tabIndex={-1}
        onKeyDown={keepFocusInPanel}
      >
        <p className="student-tutorial-progress">
          Step {index + 1} of {professorTutorialSteps.length}
        </p>
        <h2 id="professor-tutorial-title">
          {confirmingSkip ? "Skip the tutorial?" : step.title}
        </h2>
        <p id="professor-tutorial-description">
          {confirmingSkip
            ? "Continue to Settings? You can update your password there whenever you need to."
            : step.description}
        </p>
        {error && (
          <p className="student-tutorial-error" role="alert">
            {error}
          </p>
        )}
        <div className="student-tutorial-actions">
          {confirmingSkip ? (
            <>
              <button
                type="button"
                onClick={() => toggleSkip(false)}
                disabled={isSaving}
              >
                Continue tutorial
              </button>
              <button
                type="button"
                className="student-tutorial-next"
                onClick={() => complete(onSkip)}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Skip tutorial"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => toggleSkip(true)}
                disabled={isSaving}
              >
                Skip tutorial
              </button>
              <button
                type="button"
                onClick={() => move(index - 1)}
                disabled={index === 0 || isSaving}
              >
                Previous
              </button>
              <button
                type="button"
                className="student-tutorial-next"
                onClick={
                  lastStep ? () => complete(onFinish) : () => move(index + 1)
                }
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : lastStep ? "Finish tutorial" : "Next"}
              </button>
            </>
          )}
        </div>
      </section>
    </div>,
    popupMode ? popupTarget : document.body,
  );
}
