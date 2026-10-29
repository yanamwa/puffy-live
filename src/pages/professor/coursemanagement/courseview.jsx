import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";

import Swal from "sweetalert2";
import styles from "./courseview.module.css";
import StudentIdentityCard from "../../../components/students/StudentIdentityCard";
import { API_BASE } from "../../../config.js";
import { downloadEnrollmentPdf } from "../../../services/pdfDownload.js";

const API_BASE_URL = API_BASE;

const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const DEFAULT_PROFILE_IMAGE = "/images/temporaryimg.png";

/* =====================================================
   TOKEN
===================================================== */

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

/* =====================================================
   PROFILE IMAGE
===================================================== */

function resolveProfileImage(imagePath) {
  if (!imagePath) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  let fixedPath = imagePath;

  if (fixedPath.startsWith("/api/uploads/profile-images/")) {
    fixedPath = fixedPath.replace(
      "/api/uploads/profile-images/",
      "/uploads/profile-images/",
    );
  }

  if (!fixedPath.startsWith("/")) {
    fixedPath = `/${fixedPath}`;
  }

  return `${SERVER_ORIGIN}${fixedPath}`;
}

/* =====================================================
   DATE
===================================================== */

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

/* =====================================================
   COMPONENT
===================================================== */

export default function CourseView() {
  const { courseId } = useParams();

  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("enrolled");
  const [studentPage, setStudentPage] = useState(1);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const savePdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadEnrollmentPdf(
        enrolledStudents,
        `enrolled-students-${courseId}`,
      );
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "PDF download failed",
        text: error.message,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const [course, setCourse] = useState(null);

  const [requests, setRequests] = useState([]);

  const [enrolledStudents, setEnrolledStudents] = useState([]);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [processingId, setProcessingId] = useState(null);

  const [rejectTarget, setRejectTarget] = useState(null);

  const [rejectReason, setRejectReason] = useState("");

  const [rejectError, setRejectError] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);

  /* ===================================================
     LOAD COURSE + ENROLLMENTS
  =================================================== */

  const loadCourseData = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      throw new Error("Professor authentication is required.");
    }

    /*
     * Fetch the exact course selected
     * from Course Management.
     */
    const courseResponse = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
      method: "GET",

      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const courseResult = await courseResponse.json().catch(() => ({}));

    if (!courseResponse.ok) {
      throw new Error(courseResult.message || "Could not load course.");
    }

    const loadedCourse =
      courseResult.course ||
      courseResult.data?.course ||
      courseResult.data ||
      null;

    if (!loadedCourse) {
      throw new Error("Course data was not returned.");
    }

    /*
     * Fetch enrollment requests +
     * approved students specifically
     * for THIS course ID.
     */
    const enrollmentResponse = await fetch(
      `${API_BASE_URL}/courses/${courseId}/enrollments`,
      {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },
      },
    );

    const enrollmentResult = await enrollmentResponse.json().catch(() => ({}));

    if (!enrollmentResponse.ok) {
      throw new Error(
        enrollmentResult.message || "Could not load course students.",
      );
    }

    setCourse(loadedCourse);

    setRequests(
      Array.isArray(enrollmentResult.pending) ? enrollmentResult.pending : [],
    );

    setEnrolledStudents(
      Array.isArray(enrollmentResult.enrolled) ? enrollmentResult.enrolled : [],
    );
  }, [courseId]);

  /* ===================================================
     INITIAL LOAD
  =================================================== */

  useEffect(() => {
    let active = true;

    async function loadPage() {
      try {
        setLoading(true);
        setErrorMessage("");

        await loadCourseData();
      } catch (error) {
        console.error("Course View loading error:", error);

        if (active) {
          setCourse(null);

          setRequests([]);

          setEnrolledStudents([]);

          setErrorMessage(error.message || "Unable to load this course.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [courseId, loadCourseData]);

  /* ===================================================
     DISPLAYED STUDENTS
  =================================================== */

  const displayedStudents = useMemo(
    () => (activeTab === "requests" ? requests : enrolledStudents),
    [activeTab, requests, enrolledStudents],
  );
  const studentPageCount = Math.max(1, Math.ceil(displayedStudents.length / 5));
  const currentStudentPage = Math.min(studentPage, studentPageCount);
  const visibleStudents = displayedStudents.slice(
    (currentStudentPage - 1) * 5,
    currentStudentPage * 5,
  );
  useEffect(() => {
    setStudentPage(1);
  }, [activeTab, courseId]);

  const getStudentName = (student) =>
    student?.displayName || student?.name || "Student";

  const getStudentKey = (student) =>
    student?.enrollmentId ||
    student?.userId ||
    student?.studentId ||
    student?.email ||
    student?.name ||
    "";

  const getStudentIdentifier = (student) =>
    student?.userId ||
    student?.studentUserId ||
    student?.accountId ||
    student?.id ||
    student?.studentId ||
    "";

  /* ===================================================
     APPROVE
  =================================================== */

  const handleApprove = async (student) => {
    const name = getStudentName(student);

    const result = await Swal.fire({
      title: "Approve Enrollment?",
      text: `Are you sure you want to approve ${name}?`,
      imageUrl: "/images/questionmark.png",
      imageWidth: 330,
      imageHeight: 220,
      imageAlt: "Confirm enrollment approval",
      target: document.body,
      customClass: {
        container: styles.unenrollOverlay,
        popup: `${styles.unenrollDialog} ${styles.approveDialog}`,
      },
      showCancelButton: true,
      confirmButtonText: "Yes, approve",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#7FA8D6",
      cancelButtonColor: "#858d9b",
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setProcessingId(student.enrollmentId);

      const token = getStoredToken();

      if (!token) {
        throw new Error("Professor authentication is required.");
      }

      const response = await fetch(
        `${API_BASE_URL}/enrollments/${student.enrollmentId}/approve`,
        {
          method: "PATCH",

          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to approve student.");
      }

      // Reload enrollment data from database
      await loadCourseData();

      // Success SweetAlert
      await Swal.fire({
        imageUrl: "/images/approved.png",
        imageWidth: 330,
        imageHeight: 220,
        imageAlt: "Enrollment approved",
        target: document.body,
        customClass: {
          container: styles.unenrollOverlay,
          popup: `${styles.unenrollDialog} ${styles.approveDialog}`,
        },
        title: "Enrollment Approved",
        text: `${name} has been successfully enrolled in the course.`,
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    } catch (error) {
      console.error("Approve enrollment error:", error);

      await Swal.fire({
        icon: "error",
        title: "Approval Failed",
        text: error.message || "Unable to approve student.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    } finally {
      setProcessingId(null);
    }
  };

  /* ===================================================
     DECLINE
  =================================================== */

  const openRejectDialog = (student) => {
    setRejectTarget(student);
    setRejectReason("");
    setRejectError("");
  };

  const closeRejectDialog = () => {
    if (processingId) {
      return;
    }

    setRejectTarget(null);
    setRejectReason("");
    setRejectError("");
  };

  const handleDecline = async (student, reason) => {
    const cleanReason = reason.trim();

    if (!cleanReason) {
      setRejectError("Please enter a reason before declining this request.");
      return;
    }

    if (cleanReason.length > 500) {
      setRejectError("Reason must be 500 characters or fewer.");
      return;
    }

    try {
      setProcessingId(student.enrollmentId);
      setRejectError("");

      const token = getStoredToken();

      const response = await fetch(
        `${API_BASE_URL}/enrollments/${student.enrollmentId}/decline`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: cleanReason,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to decline enrollment request.",
        );
      }

      // Refresh enrollment data
      await loadCourseData();

      // Close decline modal
      setRejectTarget(null);
      setRejectReason("");
      setRejectError("");

      // Email successfully sent
      if (data.emailSent) {
        await Swal.fire({
          icon: "success",
          title: "Enrollment Declined",
          text: "The enrollment request was declined and the email was sent successfully.",
          confirmButtonText: "OK",
        });

        return;
      }

      // Enrollment declined but email failed
      await Swal.fire({
        icon: "warning",
        title: "Enrollment Declined",
        html: `
        <p>The enrollment request was declined, but the email notification could not be sent.</p>
        <p><strong>Error:</strong> ${
          data.emailError || "Unknown email error."
        }</p>
      `,
        confirmButtonText: "OK",
      });
    } catch (error) {
      console.error("Decline enrollment error:", error);

      await Swal.fire({
        icon: "error",
        title: "Decline Failed",
        text: error.message || "Unable to decline enrollment request.",
        confirmButtonText: "OK",
      });
    } finally {
      setProcessingId(null);
    }
  };

  /* ===================================================
   UNENROLL
=================================================== */

  const getFriendlyUnenrollMessage = (error) => {
    const message = error?.message || "Unable to unenroll student.";

    if (/route not found/i.test(message)) {
      return "The professor unenroll route is not running yet. Please restart the backend server and try again.";
    }

    if (/not actively enrolled/i.test(message)) {
      return "This student is no longer actively enrolled in this course.";
    }

    return message;
  };

  const requestProfessorUnenroll = async (student, token, reason) => {
    const enrollmentId = student?.enrollmentId;

    if (!enrollmentId) {
      throw new Error("Enrollment record is missing for this student.");
    }

    const response = await fetch(
      `${API_BASE_URL}/enrollments/${enrollmentId}/unenroll`,
      {
        method: "PATCH",

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          reason,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data.message || data.error || "Unable to unenroll student.";

      if (/route not found/i.test(message)) {
        throw new Error(
          "The professor unenroll route is not running yet. Please restart the backend server and try again.",
        );
      }

      throw new Error(message);
    }

    return data;
  };

  const handleUnenroll = async (student) => {
    const name = getStudentName(student);

    const result = await Swal.fire({
      title: "Unenroll Student",
      html: `
      <p style="margin-bottom: 12px;">
        Please provide a reason for unenrolling
        <strong>${name}</strong>.
      </p>
    `,
      input: "textarea",
      inputPlaceholder: "Enter reason for unenrolling...",
      inputAttributes: {
        maxlength: "500",
        "aria-label": "Reason for unenrolling student",
      },

      imageUrl: "/images/warning.png",
      imageWidth: 330,
      imageHeight: 220,
      imageAlt: "Warning",
      target: document.body,
      customClass: {
        container: styles.unenrollOverlay,
        popup: styles.unenrollDialog,
      },

      showCancelButton: true,

      confirmButtonText: "Confirm Unenroll",
      cancelButtonText: "Cancel",

      confirmButtonColor: "#7fa8d6",
      cancelButtonColor: "#ffffff",

      reverseButtons: true,

      inputValidator: (value) => {
        const reason = value?.trim();

        if (!reason) {
          return "Please enter a reason before unenrolling this student.";
        }

        if (reason.length > 500) {
          return "Reason must be 500 characters or fewer.";
        }

        return undefined;
      },
    });

    if (!result.isConfirmed) {
      return;
    }

    const reason = result.value.trim();

    const studentKey = getStudentKey(student);

    try {
      setProcessingId(studentKey);

      const token = getStoredToken();

      if (!token) {
        throw new Error("Professor authentication is required.");
      }

      const data = await requestProfessorUnenroll(student, token, reason);

      // Reload latest enrollment data
      await loadCourseData();

      // Email sent successfully
      if (data.emailSent) {
        await Swal.fire({
          icon: "success",
          title: "Student Unenrolled",
          text: `${name} has been removed from the course and the email notification was sent successfully.`,
          confirmButtonText: "OK",
          confirmButtonColor: "#7FA8D6",
        });

        return;
      }

      // Unenrolled successfully, but email failed
      await Swal.fire({
        icon: "warning",
        title: "Student Unenrolled",
        html: `
        <p>
          ${name} has been removed from the course,
          but the email notification could not be sent.
        </p>

        <p>
          <strong>Error:</strong>
          ${data.emailError || "Unknown email error."}
        </p>
      `,
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    } catch (error) {
      console.error("Unenroll student error:", error);

      await Swal.fire({
        icon: "error",
        title: "Unable to Unenroll",
        text: getFriendlyUnenrollMessage(error),
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    } finally {
      setProcessingId(null);
    }
  };

  /* ===================================================
     LOADING
  =================================================== */

  if (loading) {
    return (
      <section className={styles.courseViewPage}>
        <div className={styles.loading}>Loading course...</div>
      </section>
    );
  }

  /* ===================================================
     ERROR
  =================================================== */

  if (errorMessage || !course) {
    return (
      <section className={styles.courseViewPage}>
        <div className={styles.loading}>
          <p>{errorMessage || "Course not found."}</p>

          <button type="button" onClick={() => navigate("/professor/courses")}>
            Back to Courses
          </button>
        </div>
      </section>
    );
  }

  /* ===================================================
     COURSE VALUES
  =================================================== */

  const courseCode =
    course.code || course.courseCode || course.course_code || "COURSE";

  const courseTitle =
    course.title ||
    course.courseName ||
    course.course_name ||
    "Untitled Course";

  const courseDescription = course.summary || course.description || "";

  const moduleCount =
    course.moduleCount ?? course.module_count ?? course.modules ?? 0;

  const quizCount =
    course.quizzes ?? course.quizCount ?? course.quiz_count ?? 0;

  const studentCount = enrolledStudents.length;

  const createdDate =
    course.createdAt ||
    course.created_at ||
    course.updatedAt ||
    course.updated_at;

  /* ===================================================
     PAGE
  =================================================== */

  return (
    <section className={styles.courseViewPage}>
      <nav className={styles.backBar} aria-label="Back navigation">
        <button type="button" onClick={() => navigate("/professor/courses")}>
          <span aria-hidden="true">‹</span> Back to courses
        </button>
      </nav>
      {/* ===============================================
          PAGE HEADER
      ================================================ */}

      <div className={styles.pageHeader}>
        <div>
          <h1>Course View</h1>

          <p>View enrollment requests and students enrolled in this course.</p>
        </div>
        <div className={styles.printActions}>
          <button
            type="button"
            className={styles.printButton}
            onClick={() => window.print()}
          >
            Print
          </button>
          <button
            type="button"
            className={styles.printButton}
            onClick={savePdf}
            disabled={downloadingPdf}
            title="Download enrolled students as a PDF"
          >
            {downloadingPdf ? "Downloading…" : "Save as PDF"}
          </button>
        </div>
      </div>

      {/* ===============================================
          COURSE INFORMATION
      ================================================ */}

      <div className={styles.courseInfo}>
        <div className={styles.courseInfoTop}>
          <div className={styles.courseCode}>
            <span>Course Code:</span>

            <strong>{courseCode}</strong>
          </div>

          <span className={styles.dateCreated}>
            Date created: {formatDate(createdDate)}
          </span>
        </div>

        <h2>{courseTitle}</h2>

        {courseDescription && (
          <p className={styles.courseProgram}>{courseDescription}</p>
        )}

        <div className={styles.courseStats}>
          <span>{studentCount} students</span>

          <span>{moduleCount} Modules</span>

          <span>{quizCount} Quizzes</span>
        </div>
      </div>

      {/* ===============================================
          STUDENTS SECTION
      ================================================ */}

      <div className={styles.studentSection}>
        {/* =============================================
            TABS
        ============================================== */}

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "requests" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("requests")}
          >
            Enrollment Request
            {requests.length > 0 && (
              <span className={styles.requestCount}>{requests.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "enrolled" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("enrolled")}
          >
            Enrolled Students
            {enrolledStudents.length > 0 && (
              <span className={styles.requestCount}>
                {enrolledStudents.length}
              </span>
            )}
          </button>
        </div>

        {/* =============================================
            TABLE
        ============================================== */}

        <div className={styles.tableWrapper}>
          <table className={styles.studentTable}>
            <thead>
              <tr>
                <th>Student ID</th>

                <th>Name</th>

                <th>Email</th>

                <th>Year Level</th>

                <th>Section</th>

                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan="6" className={styles.emptyTable}>
                    {activeTab === "requests"
                      ? "No enrollment requests."
                      : "No enrolled students yet."}
                  </td>
                </tr>
              ) : (
                visibleStudents.map((student) => {
                  const studentKey = getStudentKey(student);

                  const name = getStudentName(student);

                  const image = resolveProfileImage(student.profileImage);

                  const isProcessing = processingId === studentKey;

                  return (
                    <tr key={studentKey}>
                      <td>{student.studentId || "N/A"}</td>

                      <td>
                        <div className={styles.studentName}>
                          <img
                            src={image}
                            alt={name}
                            className={styles.avatar}
                            onError={(event) => {
                              event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                            }}
                          />

                          <span>{name}</span>
                        </div>
                      </td>

                      <td>{student.email || "N/A"}</td>

                      <td>{student.yearLevel || "N/A"}</td>

                      <td>{student.sectionName || student.section_name || student.section || "N/A"}</td>

                      <td>
                        {activeTab === "requests" ? (
                          <div className={styles.actionButtons}>
                            <button
                              type="button"
                              className={styles.approveBtn}
                              disabled={isProcessing}
                              onClick={() => handleApprove(student)}
                            >
                              {isProcessing ? "Processing..." : "Approve"}
                            </button>

                            <button
                              type="button"
                              className={styles.declineBtn}
                              disabled={isProcessing}
                              onClick={() => openRejectDialog(student)}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <div className={styles.actionButtons}>
                            <button
                              type="button"
                              className={styles.viewBtn}
                              onClick={() => setSelectedStudent(student)}
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className={styles.unenrollBtn}
                              disabled={isProcessing}
                              onClick={() => handleUnenroll(student)}
                            >
                              {isProcessing ? "Removing..." : "Unenroll"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {displayedStudents.length > 0 && (
          <nav
            className={styles.studentPagination}
            aria-label="Student list pages"
          >
            <span>
              Showing {(currentStudentPage - 1) * 5 + 1}–
              {Math.min(currentStudentPage * 5, displayedStudents.length)} of{" "}
              {displayedStudents.length}
            </span>
            <div>
              <button
                type="button"
                disabled={currentStudentPage === 1}
                onClick={() => setStudentPage(currentStudentPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {currentStudentPage} of {studentPageCount}
              </span>
              <button
                type="button"
                disabled={currentStudentPage === studentPageCount}
                onClick={() => setStudentPage(currentStudentPage + 1)}
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </div>
      <div className="course-enrollment-print">
        <header className="enrollment-report-brand">
          <img src="/images/puffybrain.png" alt="PuffyBrain" />
          <div><strong>PuffyBrain</strong><p>Adaptive Quiz System with Learning Feedback<br />Department of Computer Studies</p></div>
          <div className="enrollment-report-date"><span>ACADEMIC REPORT</span><p>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p></div>
        </header>
        <h1>Student Enrollment Report</h1>
        <p className="enrollment-report-subtitle">Official list of students enrolled in the selected course</p>
        <div className="enrollment-report-details">
          <div><span>Course</span><strong>{courseTitle}</strong></div>
          <div><span>Total Students</span><strong>{studentCount} {studentCount === 1 ? "Student" : "Students"}</strong></div>
          <div><span>Course Code</span><strong>{courseCode}</strong></div>
          <div><span>Professor</span><strong>{course.professorName || course.professor_name || course.instructorName || course.instructor_name || "Course instructor"}</strong></div>
        </div>
        <h2>Enrolled Students</h2>
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Year Level</th>
              <th>Section</th>
            </tr>
          </thead>
          <tbody>
            {enrolledStudents.length ? (
              enrolledStudents.map((student) => (
                <tr key={getStudentKey(student)}>
                  <td>{student.studentId || "N/A"}</td>
                  <td>{getStudentName(student)}</td>
                  <td>{student.email || "N/A"}</td>
                  <td>{student.yearLevel || "N/A"}</td>
                  <td>{student.sectionName || student.section_name || student.section || "N/A"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No enrolled students.</td>
              </tr>
            )}
          </tbody>
        </table>
        <footer className="enrollment-report-footer">Generated by PuffyBrain · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</footer>
      </div>
      {selectedStudent && createPortal(
        <div
          className={styles.studentModalOverlay}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className={styles.studentIdModal}
            role="dialog"
            aria-modal="true"
            aria-label="Student identification card"
            onClick={(event) => event.stopPropagation()}
          >
            <StudentIdentityCard
              student={{
                ...selectedStudent,

                course:
                  selectedStudent.course ||
                  selectedStudent.program ||
                  course.program ||
                  course.courseName ||
                  course.course_name ||
                  course.title,

                yearLevel:
                  selectedStudent.yearLevel || selectedStudent.year_level,

                sectionName:
                  selectedStudent.sectionName ||
                  selectedStudent.section_name ||
                  selectedStudent.section,
              }}
              editable={false}
            />
          </div>
        </div>,
        document.body,
      )}

      {rejectTarget && createPortal(
        <div
          className={styles.rejectOverlay}
          role="presentation"
          onClick={closeRejectDialog}
        >
          <form
            className={styles.rejectDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-enrollment-title"
            onSubmit={(event) => {
              event.preventDefault();
              handleDecline(rejectTarget, rejectReason);
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="decline-enrollment-title" className={styles.rejectDialogTitle}>Decline Enrollment</h2>

            <p>
              {`Reason for declining ${
                rejectTarget.displayName || rejectTarget.name || "this student"
              }`}
            </p>

            <textarea
              value={rejectReason}
              maxLength={500}
              aria-label="Reason for declining enrollment"
              aria-describedby="decline-reason-feedback"
              aria-invalid={Boolean(rejectError)}
              placeholder="Enter decline reason"
              onChange={(event) => {
                setRejectReason(event.target.value);
                setRejectError("");
              }}
              autoFocus
            />

            <div className={styles.reasonFooter} id="decline-reason-feedback" aria-live="polite">
              <span>{rejectReason.length}/500</span>

              {rejectError && <strong>{rejectError}</strong>}
            </div>

            <div className={styles.rejectActions}>
              <button
                type="button"
                className={styles.cancelRejectBtn}
                disabled={processingId === rejectTarget.enrollmentId}
                onClick={closeRejectDialog}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={styles.confirmRejectBtn}
                disabled={processingId === rejectTarget.enrollmentId}
              >
                {processingId === rejectTarget.enrollmentId
                  ? "Declining..."
                  : "Decline"}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </section>
  );
}
