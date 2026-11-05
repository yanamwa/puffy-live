import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import {
  deleteQuizModeById,
  fetchQuizModes,
  saveQuizMode,
} from "../../../services/quizModeApi.js";

import "./SuperAdminModesManagement.css";

const emptyForm = {
  title: "",
  description: "",
  route: "",
  image: "",
};

function ModeImagePreview({ source, title }) {
  const [failedSource, setFailedSource] = useState("");
  if (!source) return <p className="mode-image-placeholder">No image selected.</p>;
  if (failedSource === source) return <p className="mode-image-placeholder">Image unavailable. Check the image path.</p>;
  return (
    <figure className="mode-image-card">
      <img src={source} alt={`${title || "Mode"} preview`} onError={() => setFailedSource(source)} />
    </figure>
  );
}

/* =====================================================
   MODE CODE
===================================================== */

function getModeCode(mode) {
  return `MD${String(mode.id).padStart(7, "0")}`;
}

/* =====================================================
   SWEETALERT HELPERS
===================================================== */

function showSuccess(message, title = "Success") {
  return Swal.fire({
    icon: "success",
    title,
    text: message,
    confirmButtonText: "OK",
  });
}

function showError(message, title = "Error") {
  return Swal.fire({
    icon: "error",
    title,
    text: message,
    confirmButtonText: "OK",
  });
}

function showWarning(message, title = "Warning") {
  return Swal.fire({
    icon: "warning",
    title,
    text: message,
    confirmButtonText: "OK",
  });
}

/* =====================================================
   COMPONENT
===================================================== */

export default function SuperAdminModesManagement() {
  const [modes, setModes] = useState([]);
  const [query, setQuery] = useState("");

  const [form, setForm] = useState(emptyForm);

  const [editingMode, setEditingMode] = useState(null);

  const [viewMode, setViewMode] = useState(null);

  const [formOpen, setFormOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingModeId, setDeletingModeId] = useState(null);

  /* =====================================================
     LOAD MODES
  ===================================================== */

  useEffect(() => {
    let active = true;

    async function loadModes() {
      try {
        setLoading(true);

        const loadedModes = await fetchQuizModes();

        if (active) {
          setModes(Array.isArray(loadedModes) ? loadedModes : []);
        }
      } catch (error) {
        console.error("Load modes error:", error);

        if (active) {
          setModes([]);

          await showError(
            error.message ||
              "Could not load quiz modes. Please make sure the backend server is running.",
            "Could Not Load Modes",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadModes();

    return () => {
      active = false;
    };
  }, []);

  /* =====================================================
     SEARCH
  ===================================================== */

  const filteredModes = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return modes;
    }

    return modes.filter((mode) => {
      const modeCode = getModeCode(mode).toLowerCase();

      const title = String(mode.title || "").toLowerCase();

      const description = String(mode.description || "").toLowerCase();

      const route = String(mode.route || "").toLowerCase();

      const image = String(mode.image || "").toLowerCase();

      return (
        modeCode.includes(search) ||
        title.includes(search) ||
        description.includes(search) ||
        route.includes(search) ||
        image.includes(search)
      );
    });
  }, [modes, query]);

  /* =====================================================
     OPEN ADD MODE
  ===================================================== */

  const openAdd = () => {
    if (saving) {
      return;
    }

    setEditingMode(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  /* =====================================================
     OPEN EDIT MODE
  ===================================================== */

  const openEdit = (mode) => {
    if (saving) {
      return;
    }

    setEditingMode(mode);

    setForm({
      title: mode.title || "",
      description: mode.description || "",
      route: mode.route || "",
      image: mode.image || "",
    });

    setFormOpen(true);
  };

  /* =====================================================
     CLOSE FORM
  ===================================================== */

  const closeForm = () => {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingMode(null);
    setForm(emptyForm);
  };

  /* =====================================================
     SAVE MODE
  ===================================================== */

  const saveMode = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    const title = form.title.trim();
    const description = form.description.trim();
    const route = form.route.trim();
    const image = form.image.trim();

    /* -------------------------
       VALIDATION
    ------------------------- */

    if (!title) {
      await showWarning("Mode title is required.", "Missing Title");

      return;
    }

    if (!description) {
      await showWarning("Mode description is required.", "Missing Description");

      return;
    }

    if (!route) {
      await showWarning("Mode route is required.", "Missing Route");

      return;
    }

    if (!route.startsWith("/")) {
      await showWarning(
        'The route must start with "/". Example: /flashcards',
        "Invalid Route",
      );

      return;
    }

    const payload = {
      title,
      description,
      route,
      image,
    };

    /* -------------------------
       SAVE
    ------------------------- */

    try {
      setSaving(true);

      const savedMode = await saveQuizMode(
        editingMode
          ? {
              ...editingMode,
              ...payload,
            }
          : payload,
      );

      /* -------------------------
         UPDATE TABLE
      ------------------------- */

      setModes((current) =>
        editingMode
          ? current.map((mode) =>
              String(mode.id) === String(savedMode.id) ? savedMode : mode,
            )
          : [savedMode, ...current],
      );

      const wasEditing = Boolean(editingMode);

      /* -------------------------
         CLOSE MODAL
      ------------------------- */

      setFormOpen(false);
      setEditingMode(null);
      setForm(emptyForm);

      /* -------------------------
         SUCCESS FEEDBACK
      ------------------------- */

      await showSuccess(
        wasEditing
          ? `"${savedMode.title}" was updated successfully.`
          : `"${savedMode.title}" was created successfully.`,
        wasEditing ? "Mode Updated" : "Mode Created",
      );
    } catch (error) {
      console.error("Save mode error:", error);

      await showError(
        error.message || "The mode could not be saved.",
        editingMode ? "Update Failed" : "Create Failed",
      );
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     DELETE MODE
  ===================================================== */

  const deleteMode = async (mode) => {
    if (deletingModeId !== null || saving) {
      return;
    }

    /* -------------------------
       CONFIRMATION
    ------------------------- */

    const result = await Swal.fire({
      icon: "warning",

      title: "Delete Mode?",

      text: `Are you sure you want to delete "${mode.title}"?`,

      showCancelButton: true,

      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",

      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    /* -------------------------
       DELETE
    ------------------------- */

    try {
      setDeletingModeId(mode.id);

      await deleteQuizModeById(mode.id);

      /* -------------------------
         REMOVE FROM TABLE
      ------------------------- */

      setModes((current) =>
        current.filter((item) => String(item.id) !== String(mode.id)),
      );

      /* -------------------------
         CLOSE VIEW IF OPEN
      ------------------------- */

      if (viewMode && String(viewMode.id) === String(mode.id)) {
        setViewMode(null);
      }

      /* -------------------------
         SUCCESS
      ------------------------- */

      await showSuccess(
        `"${mode.title}" was deleted successfully.`,
        "Mode Deleted",
      );
    } catch (error) {
      console.error("Delete mode error:", error);

      await showError(
        error.message || "The mode could not be deleted.",
        "Delete Failed",
      );
    } finally {
      setDeletingModeId(null);
    }
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="admin-page feature-page mode-management-page">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="feature-page-top super-page-heading">
        <div>
          <h1>Mode Management</h1>

          <p>Create and manage practice modes for PuffyBrain users.</p>
        </div>

        <button
          className="primary-feature-btn compact"
          type="button"
          onClick={openAdd}
          disabled={saving}
        >
          + Add New Mode
        </button>
      </div>

      {/* =================================================
          SEARCH
      ================================================= */}

      <div className="mode-search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search modes"
          placeholder="Search by ID, title, description, or route..."
        />
      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="mode-table-wrap">
        <table className="mode-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Description</th>
              <th>Route</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="feature-empty" colSpan="5">
                  Loading modes...
                </td>
              </tr>
            ) : filteredModes.length === 0 ? (
              <tr>
                <td className="feature-empty" colSpan="5">
                  {query.trim()
                    ? "No modes match your search."
                    : "No modes found."}
                </td>
              </tr>
            ) : (
              filteredModes.map((mode) => {
                const deleting = String(deletingModeId) === String(mode.id);

                return (
                  <tr key={mode.id}>
                    <td>
                      <span className="mode-id">{getModeCode(mode)}</span>
                    </td>

                    <td>{mode.title}</td>

                    <td>{mode.description}</td>

                    <td>{mode.route}</td>

                    <td>
                      <div className="mode-actions">
                        <button
                          className="view-btn"
                          type="button"
                          disabled={deleting}
                          onClick={() => setViewMode(mode)}
                        >
                          View
                        </button>

                        <button
                          className="edit-btn"
                          type="button"
                          disabled={deleting || saving}
                          onClick={() => openEdit(mode)}
                        >
                          Edit
                        </button>

                        <button
                          className="delete-btn"
                          type="button"
                          disabled={deleting}
                          onClick={() => deleteMode(mode)}
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      {formOpen && (
        <div className="feature-modal-backdrop" onClick={closeForm}>
          <form
            className="feature-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingMode ? "Edit Mode" : "Add New Mode"}
            onSubmit={saveMode}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{editingMode ? "Edit Mode" : "Add New Mode"}</h2>
            <button className="mode-modal-close" type="button" onClick={closeForm} disabled={saving} aria-label="Close mode form">×</button>

            {/* TITLE */}

            <label className="feature-field">
              <span>Title</span>

              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Mode title"
                required
                disabled={saving}
              />
            </label>

            {/* DESCRIPTION */}

            <label className="feature-field">
              <span>Description</span>

              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Mode description"
                required
                disabled={saving}
              />
            </label>

            {/* ROUTE */}

            <label className="feature-field">
              <span>Route</span>

              <input
                value={form.route}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    route: event.target.value,
                  }))
                }
                placeholder="/flashcards-tutorial"
                required
                disabled={saving}
              />
            </label>

            {/* IMAGE */}

            <label className="feature-field">
              <span>Image Path</span>

              <input
                value={form.image}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    image: event.target.value,
                  }))
                }
                placeholder="/images/flashcard.png"
                disabled={saving}
              />
            </label>

            {/* ACTIONS */}

            <ModeImagePreview source={form.image.trim()} title={form.title} />

            <div className="feature-modal-actions">
              <button
                type="button"
                className="secondary-feature-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-feature-btn"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingMode
                    ? "Update Mode"
                    : "Save Mode"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================
          VIEW MODAL
      ================================================= */}

      {viewMode && (
        <div
          className="feature-modal-backdrop"
          onClick={() => setViewMode(null)}
        >
          <section
            className="feature-modal"
            role="dialog"
            aria-modal="true"
            aria-label="View Mode"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>View Mode</h2>
            <button className="mode-modal-close" type="button" onClick={() => setViewMode(null)} aria-label="Close mode details">×</button>

            <dl className="feature-details">
              <div>
                <dt>ID</dt>

                <dd>{getModeCode(viewMode)}</dd>
              </div>

              <div>
                <dt>Title</dt>

                <dd>{viewMode.title}</dd>
              </div>

              <div>
                <dt>Description</dt>

                <dd>{viewMode.description}</dd>
              </div>

              <div>
                <dt>Route</dt>

                <dd>{viewMode.route}</dd>
              </div>

              <div>
                <dt>Image</dt>

                <dd><ModeImagePreview source={viewMode.image} title={viewMode.title} /></dd>
              </div>
            </dl>

            <div className="feature-modal-actions">
              <button
                type="button"
                className="primary-feature-btn"
                onClick={() => setViewMode(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
