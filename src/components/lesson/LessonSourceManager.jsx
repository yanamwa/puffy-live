import Swal from "sweetalert2";
import {
  FiRefreshCw,
  FiRotateCw,
  FiTrash2,
  FiFileText,
  FiPlay,
} from "react-icons/fi";
import styles from "./LessonSourceManager.module.css";
import { notifyLessonGenerated } from "../../services/lessonNotifications.js";
import { useEffect, useState, useRef } from "react";
import {
  retryLessonGeneration,
  listLessonSources,
  regenerateLessonSource,
  deleteLessonSource,
  waitForLessonJob,
} from "../../services/lessonRagApi.js";

export default function LessonSourceManager({
  courseId,
  lessonId = null,
  jobScope,
  onGenerated,
  generationContext = null,
  selected = [], onSelect, disabled = false, onOrganizing,
}) {
  const [sources, setSources] = useState([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [failedJob, setFailedJob] = useState(null);
  const succeeded = useRef(false);
  const sourceScope = useRef(null);
  const [loadedScope, setLoadedScope] = useState(null);
  const key = `puffy-rag-job:${courseId}:${jobScope || lessonId || "course"}`;
  sourceScope.current = key;
  const pending = Number(courseId) > 0 ? localStorage.getItem(key) : null;
  useEffect(() => {
    succeeded.current = false;
    setFailedJob(localStorage.getItem(key + ":failed"));
  }, [key]);
  const refresh = async () => {
    if (!(Number(courseId) > 0)) return;
    const requestedScope = key;
    const result = await listLessonSources(courseId, jobScope ?? lessonId);
    if (sourceScope.current !== requestedScope) return;
    setLoadedScope(requestedScope);
    setSources(result.sources);
    if (!localStorage.getItem(key)) {
      const failed = result.failed_jobs?.[0];
      setFailedJob(succeeded.current ? null : failed?.job_id || null);
    }
  };
  useEffect(() => {
    sourceScope.current = key;
    setSources([]);
    setLoadedScope(null);
    setMessage("");
    setBusy(false);
    if (Number(courseId) > 0)
      refresh().catch((error) => {
        if (sourceScope.current === key) setMessage(error.message);
      });
    return () => {
      sourceScope.current = null;
    };
  }, [courseId, lessonId, key]);
  useEffect(() => {
    let lastRefresh = 0;
    const update = (event) => {
      if (
        event.detail.job_id !== localStorage.getItem(key) &&
        event.detail.job_id !== pending
      )
        return;
      if (event.detail.status === "failed") {
        succeeded.current = false;
        setFailedJob(event.detail.job_id);
        setMessage(
          "Your files were saved, but generation could not be verified. Retry generation to reuse the indexed sources.",
        );
      }
      const now = Date.now();
      if (
        now - lastRefresh > 5000 ||
        ["completed", "failed"].includes(event.detail.status)
      ) {
        lastRefresh = now;
        refresh().catch((error) => setMessage(error.message));
      }
    };
    window.addEventListener("lesson-rag-progress", update);
    return () => window.removeEventListener("lesson-rag-progress", update);
  }, [courseId, lessonId, key, pending]);
  if (!(Number(courseId) > 0)) return null;
  const visibleSources = loadedScope === key ? sources : [];
  const progress = (job) => setMessage(`${job.progress}% — ${job.phase}`);
  const queued = (jobId) => localStorage.setItem(key, jobId);
  const organizing = value => {
    setBusy(value);
    onOrganizing?.(value);
  };
  const complete = (result) => {
    if (sourceScope.current !== key) return;
    onGenerated(result);
    succeeded.current = true;
    localStorage.removeItem(key);
    localStorage.removeItem(key + ":failed");
    setFailedJob(null);
    setMessage("");
    notifyLessonGenerated(result.lesson_pages || [], result.source_coverage);
  };
  const generate = async (id, reindex) => {
    const confirmation = await Swal.fire({
      title: "Organize this saved source?",
      text: "PuffyBrain will use this document to prepare lesson pages for your review.",
      showCancelButton: true,
      confirmButtonText: "Generate pages",
      cancelButtonText: "Keep current pages",
      focusCancel: true,
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        container: styles.confirmContainer,
        popup: styles.confirmPopup,
        title: styles.confirmTitle,
        htmlContainer: styles.confirmText,
        actions: styles.confirmActions,
        confirmButton: styles.confirmButton,
        cancelButton: styles.cancelButton,
      },
    });
    if (!confirmation.isConfirmed || sourceScope.current !== key) return;
    organizing(true);
    try {
      complete(await regenerateLessonSource(id, reindex, progress, queued, generationContext, jobScope ?? lessonId));
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      organizing(false);
    }
  };
  const resume = async () => {
    organizing(true);
    try {
      complete(await waitForLessonJob(pending, progress));
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      organizing(false);
    }
  };
  const retry = async () => {
    organizing(true);
    localStorage.setItem(key, failedJob);
    try {
      const result = await retryLessonGeneration(failedJob, progress, queued);
      complete(result);
      await refresh();
    } catch (error) {
      setMessage(error.message);
      localStorage.removeItem(key);
    } finally {
      organizing(false);
    }
  };
  const remove = async (id) => {
    if (
      !window.confirm(
        "Delete this source and its searchable chunks? Saved lesson text will remain.",
      )
    )
      return;
    setBusy(true);
    try {
      await deleteLessonSource(id);
      await refresh();
      setMessage("Source deleted.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details
      className={styles.panel}
      aria-busy={busy}
      onToggle={(event) => {
        if (event.currentTarget.open)
          refresh().catch((error) => setMessage(error.message));
      }}
    >
      <summary className={styles.summary}>Saved source documents</summary>
      {pending && (
        <button
          className={styles.primaryButton}
          type="button"
          disabled={busy || disabled}
          onClick={resume}
        >
          <FiPlay aria-hidden="true" />
          Resume generation
        </button>
      )}
      {failedJob && (
        <button
          className={styles.primaryButton}
          type="button"
          disabled={busy || disabled}
          onClick={retry}
        >
          <FiRotateCw aria-hidden="true" />
          Retry with saved sources
        </button>
      )}
      {message && (
        <p className={styles.status} role="status">
          {message}
        </p>
      )}
      {!visibleSources.length && (
        <p>No source documents indexed for this module yet.</p>
      )}
      {visibleSources.map((source) => (
        <div key={source.document_id} className={styles.source}>
          <div className={styles.sourceHeader}>
            <span className={styles.fileIcon}>
              <FiFileText aria-hidden="true" />
            </span>
            <div className={styles.sourceInfo}>
              <strong className={styles.filename}>{source.filename}</strong>
              <span className={styles.meta}>
                {source.chunk_count} searchable chunks
              </span>
            </div>
            <span
              className={
                source.processing_status === "ready"
                  ? styles.readyBadge
                  : styles.badge
              }
            >
              {source.processing_status}
            </span>
          </div>
          <div className={styles.actions}>
            {onSelect && source.processing_status === "ready" && (
              <label>
                <input type="checkbox" checked={selected.includes(String(source.document_id))} disabled={busy || disabled}
                  onChange={event => onSelect(event.target.checked ? [...selected, String(source.document_id)] : selected.filter(id => id !== String(source.document_id)))} />
                Include in this module draft
              </label>
            )}
            <button
              className={styles.primaryButton}
              type="button"
              disabled={busy || disabled || source.processing_status !== "ready"}
              onClick={() => generate(source.document_id, false)}
            >
              <FiPlay aria-hidden="true" />
              Generate again
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={busy || disabled}
              onClick={() => generate(source.document_id, true)}
            >
              <FiRefreshCw aria-hidden="true" />
              Reindex & generate
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={busy || disabled}
              onClick={() => remove(source.document_id)}
            >
              <FiTrash2 aria-hidden="true" />
              Delete source
            </button>
          </div>
        </div>
      ))}
    </details>
  );
}
