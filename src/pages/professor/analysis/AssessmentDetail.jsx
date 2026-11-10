import { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { fetchCourses } from "../../../services/courseApi.js";
import QuizAssessmentDashboard from "./QuizAssessmentDashboard.jsx";
import { downloadAssessmentPdf } from "../../../services/pdfDownload.js";
import { tutorialCourseDraft } from "../tutorial/professorTutorialExamples.js";
function readItems(course) {
  const value =
    course?.quizItems ||
    course?.quiz_contents ||
    course?.quizModule ||
    course?.quiz_items ||
    [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : parsed?.questions || [];
  } catch {
    return [];
  }
}
export default function AssessmentDetail() {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { tutorialStep } = useOutletContext() ?? {};
  const tutorialAnalysis = tutorialStep?.id?.startsWith("analysis-");
  const initial = location.state?.course?.raw || location.state?.course || null;
  const [course, setCourse] = useState(tutorialAnalysis ? tutorialCourseDraft : initial);
  const [loading, setLoading] = useState(!tutorialAnalysis);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const savePdf = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadAssessmentPdf(`assessment-${courseId}`);
    } catch (error) {
      setDownloadError(error.message || "PDF download failed. Please retry.");
    } finally {
      setDownloading(false);
    }
  };
  useEffect(() => {
    if (tutorialAnalysis) {
      setCourse(tutorialCourseDraft);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    fetchCourses({}, { fallback: false })
      .then((courses) => {
        const found = courses.find(
          (item) =>
            String(item.id || item.course_id || item.courseId) ===
            String(courseId),
        );
        if (active) {
          setCourse(found || null);
          if (!found) setError("Assessment not found.");
        }
      })
      .catch((error) => {
        if (active)
          setError(error.message || "Could not load assessment details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId, tutorialAnalysis]);
  const title = course?.title || course?.course_name || "Assessment Analysis";
  return (
    <section className="qa-assessment-page qa-compact-assessment">
      <nav className="qa-back-bar" aria-label="Back navigation">
        <button type="button" onClick={() => navigate("/professor/students")}>‹ Back to assessment</button>
      </nav>
      <header className="qa-page-heading">
        <div><h1>Assessment Analysis</h1><p>Review practice and main quiz results for {title}.</p></div>
        <div className="qa-page-print-actions">
          <button type="button" className="qa-page-print" onClick={() => window.print()} disabled={loading || Boolean(error)}>Print</button>
          <button type="button" className="qa-page-print" onClick={savePdf} disabled={loading || Boolean(error) || downloading}>{downloading ? "Downloading…" : "Save as PDF"}</button>
        </div>
      </header>
      {downloadError && <p role="alert">{downloadError}</p>}
      {loading ? <p>Loading assessment details…</p> : error ? <p role="alert">{error}</p> : (
        <QuizAssessmentDashboard
          key={tutorialStep?.id || courseId}
          courseId={courseId}
          courseTitle={title}
          items={readItems(course)}
          course={course}
          tutorialMode={tutorialAnalysis}
          tutorialStep={tutorialStep}
        />
      )}
    </section>
  );
}
