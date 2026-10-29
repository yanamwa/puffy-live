import { CatalogModal } from "../../../components/catalog/CatalogModal.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FiArchive, FiEye, FiRotateCcw } from "react-icons/fi";

import Swal from "sweetalert2";

import { getProfessorCourseOwner } from "../../professor/professorData";

import { archiveCourseById } from "../../../services/courseApi.js";

import "./Modules.css";



import { API_BASE } from "../../../config.js";



function getToken() {

  return localStorage.getItem("puffy-token") || localStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("puffy-token") || sessionStorage.getItem("token") || sessionStorage.getItem("authToken") || "";

}



function isArchived(course) {

  const value = course.archived ?? course.isArchived ?? course.is_archived ?? 0;

  return value === true || value === 1 || String(value).toLowerCase() === "true" || String(value) === "1";

}



async function getAllCourses() {

  const token = getToken();

  const response = await fetch(`${API_BASE}/courses?includeArchived=1`, {

    headers: token ? { Authorization: `Bearer ${token}` } : {},

    credentials: "include",

    cache: "no-store",

  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {

    throw new Error(result.message || `Could not load courses (HTTP ${response.status}).`);

  }

  if (!Array.isArray(result.courses)) {

    throw new Error("Unexpected courses response: expected a courses array.");

  }

  return result.courses;

}



function formatCourseId(course) {

  const cleanDate = String(course.updatedAt || "").replaceAll("-", "").slice(2);

  return course.code || `CRS${cleanDate || "000000"}${String(course.id).slice(-3).padStart(3, "0")}`;

}

function getStatusLabel(status) {

  const normalized = String(status || "").toLowerCase();

  return normalized === "published" || normalized === "publish" ? "Publish" : "Draft";

}

function parseList(value) {

  if (Array.isArray(value)) return value;

  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; }

  catch { return []; }

}



export default function ModuleManagementPage() {

  const [allCourses, setAllCourses] = useState([]);

  const [view, setView] = useState("active");

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(null);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [busyId, setBusyId] = useState(null);



  // Initial load shows a loading state. Background sync updates the table silently.
  const refreshCourses = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    try {
      const loaded = await getAllCourses();
      setAllCourses(loaded);
      setErrorMessage("");
    } catch (error) {
      // Do not interrupt users with repeated alerts during automatic polling.
      if (initial) {
        const message = error.message || "Unable to load courses.";
        setErrorMessage(message);
        await Swal.fire({ icon: "error", title: "Could not load courses", text: message });
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const sync = async (initial = false) => {
      if (!active || inFlight || (!initial && document.hidden)) return;
      inFlight = true;
      try { await refreshCourses({ initial }); }
      finally { inFlight = false; }
    };

    sync(true);
    // Near-real-time synchronization without requiring a Refresh button.
    const intervalId = window.setInterval(() => sync(), 10000);
    const onFocus = () => sync();
    const onVisibilityChange = () => { if (!document.hidden) sync(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshCourses]);

  const activeCount = allCourses.filter((course) => !isArchived(course)).length;

  const archivedCount = allCourses.filter(isArchived).length;

  const displayedCourses = useMemo(() => {

    const query = searchQuery.trim().toLowerCase();

    return allCourses.filter((course) => (view === "archived" ? isArchived(course) : !isArchived(course)))

      .filter((course) => !query || [course.title, course.code, course.subject, course.summary, getProfessorCourseOwner(course)]

        .join(" ").toLowerCase().includes(query));

  }, [allCourses, view, searchQuery]);



  const selectedLessons = useMemo(() => parseList(selectedCourse?.lessonPages || selectedCourse?.lessonContent), [selectedCourse]);

  const selectedQuizItems = useMemo(() => parseList(selectedCourse?.quizItems || selectedCourse?.quizModule), [selectedCourse]);



  const archiveCourse = async (course) => {

    const result = await Swal.fire({

      title: "Archive course?", text: `Archive “${course.title || "Untitled course"}”? Students will no longer see it in their active courses.`,

      icon: "warning", showCancelButton: true, confirmButtonText: "Yes, archive", cancelButtonText: "Cancel",

      confirmButtonColor: "#f24b4b",

    });

    if (!result.isConfirmed) return;

    setBusyId(course.id);

    try {

      await archiveCourseById(course.id, true, { fallback: false });

      // Re-read the database rather than relying on an optimistic frontend-only archive.

      const loaded = await getAllCourses();

      setAllCourses(loaded);

      setSelectedCourse(null);

      await Swal.fire({ icon: "success", title: "Course archived", text: "Find it under Archived.", timer: 1800, showConfirmButton: false });

    } catch (error) {

      await Swal.fire({ icon: "error", title: "Archive failed", text: error.message || "Could not archive this course." });

    } finally { setBusyId(null); }

  };



  const restoreCourse = async (course) => {

    const result = await Swal.fire({

      icon: "question",

      title: "Restore course?",

      text: `Restore “${course.title || "Untitled course"}” to active courses?`,

      showCancelButton: true,

      confirmButtonText: "Yes, restore",

      cancelButtonText: "Cancel",

      confirmButtonColor: "#191b2c",

    });

    if (!result.isConfirmed) return;

    setBusyId(course.id);

    try {

      await archiveCourseById(course.id, false, { fallback: false });

      const loaded = await getAllCourses();

      setAllCourses(loaded);

      setSelectedCourse(null);

      await Swal.fire({ icon: "success", title: "Course restored", text: "The course is now in Active.", timer: 1800, showConfirmButton: false });

    } catch (error) {

      await Swal.fire({ icon: "error", title: "Restore failed", text: error.message || "Could not restore this course." });

    } finally {

      setBusyId(null);

    }

  };



  return (

    <div className="admin-page admin-modules-page">

      <div className="admin-modules-header"><div>

        <h1>Course Management</h1>

        <p>View and manage professor courses.</p>

      </div></div>

      <div className="admin-modules-toolbar">

        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}

          placeholder={view === "archived" ? "Search archived courses..." : "Search courses..."}

          aria-label="Search courses" />

        <div className="admin-modules-toolbar-right">

          <span>{displayedCourses.length} course(s)</span>

          <div className="admin-modules-view-tabs" role="group" aria-label="Course view">

            <button type="button" className={view === "active" ? "is-active" : ""}

              aria-pressed={view === "active"} onClick={() => { setView("active"); setSearchQuery(""); }}>

              Active ({activeCount})

            </button>

            <button type="button" className={view === "archived" ? "is-active" : ""}

              aria-pressed={view === "archived"} onClick={() => { setView("archived"); setSearchQuery(""); }}>

              Archived ({archivedCount})

            </button>

          </div>

    

        </div>

      </div>

      <div className="admin-modules-table-wrap">

        <table className="admin-modules-table"><thead><tr>

          <th>Course ID</th><th>Course Title</th><th>Professor</th><th>Subject</th>

          <th>Date Created</th><th>Status</th><th>Actions</th>

        </tr></thead><tbody>

          {loading ? <tr><td colSpan="7" className="admin-modules-empty">Loading courses...</td></tr>

          : errorMessage ? <tr><td colSpan="7" className="admin-modules-empty" role="alert">{errorMessage}</td></tr>

          : displayedCourses.length === 0 ? <tr><td colSpan="7" className="admin-modules-empty">

              {view === "archived" ? "No archived courses found." : "No active courses found."}

            </td></tr>

          : displayedCourses.map((course) => <tr key={course.id}>

            <td>{formatCourseId(course)}</td><td>{course.title || "Untitled course"}</td>

            <td>{getProfessorCourseOwner(course)}</td><td>{course.subject || course.code || "Not set"}</td>

            <td>{course.createdAt || course.created_at || course.updatedAt || "Not set"}</td>

            <td><span className={`admin-module-status ${view === "archived" ? "draft" : getStatusLabel(course.status) === "Publish" ? "publish" : "draft"}`}>

              {view === "archived" ? "Archived" : getStatusLabel(course.status)}

            </span></td>

            <td><div className="admin-module-actions">

              <button type="button" onClick={() => setSelectedCourse(course)}><FiEye /> View</button>

              {view === "active" && <button type="button" className="danger" disabled={busyId === course.id}

                onClick={() => archiveCourse(course)}><FiArchive /> {busyId === course.id ? "Archiving..." : "Archive"}</button>}

              {view === "archived" && <button type="button" disabled={busyId === course.id}

                onClick={() => restoreCourse(course)}><FiRotateCcw /> {busyId === course.id ? "Restoring..." : "Restore"}</button>}

            </div></td>

          </tr>)}

        </tbody></table>

      </div>

      {selectedCourse && <ProfessorClassDetails course={selectedCourse} onClose={() => setSelectedCourse(null)} />}







    </div>







  );







}

export function ProfessorClassDetails({ course, onClose }) {
  const lessons = parseList(course?.lessonPages || course?.lessonContent);
  const quizItems = parseList(course?.quizItems || course?.quizModule);
  const fields = [
    ["Professor", getProfessorCourseOwner(course)],
    ["Subject", course.subject || course.code || "Not set"],
    ["Status", isArchived(course) ? "Archived" : getStatusLabel(course.status)],
    ["Date Created", course.createdAt || course.created_at || course.updatedAt || "Not set"],
    ["Quiz Items", quizItems.length || course.quizzes || 0],
  ];
  return (
    <CatalogModal title={course.title || "Professor Class Details"} variant="details" wide onClose={onClose}>
      <p className="catalog-class-code">Class Join Code: <strong>{formatCourseId(course)}</strong></p>
      <dl className="catalog-info catalog-class-info">
        {fields.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <h3>Description</h3>
      <p>{course.summary || course.description || "No course description yet."}</p>
      <h3>Learning Objectives</h3>
      <p>{course.learningObjectives || "No learning objectives yet."}</p>
      <h3>Lesson Pages</h3>
      {lessons.length === 0 ? <p>No lesson pages yet.</p> : <div className="catalog-class-content">{lessons.map((page,index)=><article key={page.id || index}><h4>{page.title || `Page ${index+1}`}</h4><p>{page.content || "No lesson content."}</p></article>)}</div>}
      <h3>Course Quiz</h3>
      {quizItems.length === 0 ? <p>No quiz items yet.</p> : <div className="catalog-class-content">{quizItems.map((item,index)=><article key={item.id || index}><h4>{item.question || `Question ${index+1}`}</h4><p>Answer: {item.correct_answer || item.answer || "Not set"}</p></article>)}</div>}
    </CatalogModal>
  );
}
