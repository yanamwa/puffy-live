import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { catalogPdf } from "../../services/catalogApi.js";
import "../../pages/admin/modules/Modules.css";
import "./catalog.css";

export function CatalogModal({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
  variant = "",
  footer,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const previous = document.activeElement,
      node = ref.current;
    node?.focus();
    const key = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const focusable = [
          ...node.querySelectorAll(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],iframe,[tabindex="0"]',
          ),
        ];
        const first = focusable[0],
          last = focusable.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    node?.addEventListener("keydown", key);
    return () => {
      node?.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose, busy]);
  return createPortal(
    <div className="admin-module-modal-backdrop catalog-backdrop">
      <section
        className={`admin-module-modal catalog-modal ${wide ? "catalog-wide" : ""} ${variant ? `catalog-${variant}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="catalog-button catalog-close"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>
        <div className="catalog-modal-body">{children}</div>
        {footer && <footer className="catalog-modal-footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
export function PdfPreview({ path }) {
  const [state, setState] = useState({ url: "", error: "" });
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    setState({ url: "", error: "" });
    catalogPdf(path, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setState({ url, error: "" });
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ url: "", error: error.message });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  if (state.error) return <p role="alert">{state.error}</p>;
  return state.url ? (
    <div className="catalog-pdf">
      <a href={state.url} target="_blank" rel="noreferrer">
        Open PDF in a new tab
      </a>
      <iframe src={state.url} title="Syllabus PDF preview" />
    </div>
  ) : (
    <p role="status">Loading PDF preview…</p>
  );
}
