import { useState } from "react";
import Swal from "sweetalert2";
import { API_BASE } from "../../../config.js";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiMail,
  FiDownload,
  FiPrinter,
} from "react-icons/fi";
import "./MainQuizResponses.css";

import { readMainQuizResponseAnswer } from "../../../services/mainQuizResponse.js";

function formatReportDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

export default function MainQuizResponses({
  courseId,
  courseTitle,
  quizTitle,
  assessmentTitle,
  attempts,
  onBack,
  embedded = false,
  passScore,
}) {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const percentOf = (a) => a.earnedScore != null && Number.isFinite(Number(a.earnedScore)) && Number(a.total) > 0 ? Math.round(Number(a.earnedScore) / Number(a.total) * 100) : null;
  const passed = (a) => percentOf(a) !== null && Number(a.earnedScore) >= (Number.isFinite(passScore) ? passScore : Math.max(1, Math.ceil(Number(a.total || 0) * 0.7)));
  const visibleResponses = attempts.filter(a => `${a.name || ""} ${a.section || ""} ${a.email || ""} ${a.moduleTitle || ""}`.toLowerCase().includes(search.toLowerCase()) && (resultFilter === "all" || (percentOf(a) === null ? "ungraded" : passed(a) ? "passed" : "failed") === resultFilter));
  const [selectedId, setSelectedId] = useState(null);
  const [includeKey, setIncludeKey] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const foundIndex = attempts.findIndex(
    (attempt) => String(attempt.id) === String(selectedId),
  );
  const index = foundIndex < 0 ? 0 : foundIndex;
  const attempt = attempts[index];
  const responseCourseBase = String(courseTitle || "").replace(
    /\s-\sAll Modules$/i,
    "",
  );
  const selectedCourseTitle =
    detailsOpen && attempt?.moduleTitle
      ? [responseCourseBase, attempt.moduleTitle].filter(Boolean).join(" - ")
      : courseTitle;
  const answers = (attempt?.answers || []).map(readMainQuizResponseAnswer);
  const typedAnswers = answers.map((answer, questionIndex) => {
    const rawType = String(
      answer.questionType ||
        attempt?.answers?.[questionIndex]?.type ||
        attempt?.answers?.[questionIndex]?.question_type ||
        "",
    )
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const type = /multiple.?choice|mcq/.test(rawType)
      ? "multiple_choice"
      : /identification|short.?answer|fill.?in/.test(rawType)
        ? "identification"
        : /true.?false|boolean/.test(rawType)
          ? "true_false"
          : "other";
    return { ...answer, questionIndex, type };
  });
  const responseTestGroups = [
    { type: "multiple_choice", title: "Multiple Choice" },
    { type: "identification", title: "Identification" },
    { type: "true_false", title: "True or False" },
    { type: "other", title: "Assessment Questions" },
  ]
    .map((group) => ({
      ...group,
      answers: typedAnswers.filter((answer) => answer.type === group.type),
    }))
    .filter((group) => group.answers.length)
    .map((group, groupIndex) => ({
      ...group,
      heading: `Test ${groupIndex + 1}: ${group.title}`,
    }));
  const reportPrintedAt = new Intl.DateTimeFormat(undefined, {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  const reportText = attempt
    ? [
        selectedCourseTitle,
        quizTitle,
        `Student: ${attempt.name}`,
        `Email: ${attempt.email || "Unavailable"}`,
        `Score: ${attempt.earnedScore ?? "Unavailable"} / ${attempt.total}`,
        "",
        ...answers.map(
          (answer, i) =>
            `${i + 1}. ${answer.question}\nStudent answer: ${answer.selected || "No answer"}\nCorrect answer: ${answer.correct || "Not recorded"}${answer.explanation ? `\nExplanation: ${answer.explanation}` : ""}`,
        ),
      ].join("\n")
    : "";
  const changeStudent = (next) => {
    setSelectedId(attempts[next].id);
    setNotice("");
  };
  const emailScore = async () => {
    if (sending || !attempts.length || !courseId) return;
    const escape = (value) =>
      String(value ?? "").replace(
        /[&<>"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[char],
      );
    const recipients = attempts.filter((item) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email || ""),
    );
    const skipped = attempts.length - recipients.length;
    const selection = await Swal.fire({
      title: "Email scores & answer keys",
      html:
        '<p class="quiz-email-description">Each student receives their own saved score and answer key.</p>' +
        '<label class="quiz-email-all"><input type="checkbox" id="quiz-email-all"> Select all students (' +
        recipients.length +
        ")</label>" +
        '<div class="quiz-email-recipients">' +
        recipients
          .map(
            (item, i) =>
              '<label class="quiz-email-recipient"><input type="checkbox" name="quiz-email-recipient" value="' +
              i +
              '" ' +
              (String(item.id) === String(attempt?.id) ? "checked" : "") +
              "><span><strong>" +
              escape(item.name) +
              "</strong><small>" +
              escape(item.email) +
              "</small></span></label>",
          )
          .join("") +
        "</div>" +
        (skipped
          ? '<p class="quiz-email-description">' +
            skipped +
            " response(s) unavailable because the student email is missing or invalid.</p>"
          : ""),
      showCancelButton: true,
      confirmButtonText: "Send emails",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#7fa8d6",
      buttonsStyling: false,
      customClass: {
        popup: "quiz-email-popup",
        confirmButton: "quiz-email-confirm",
        cancelButton: "quiz-email-cancel",
      },
      didOpen: (popup) => {
        const all = popup.querySelector("#quiz-email-all");
        const boxes = [
          ...popup.querySelectorAll('input[name="quiz-email-recipient"]'),
        ];
        const sync = () => {
          const count = boxes.filter((box) => box.checked).length;
          all.checked = count > 0 && count === boxes.length;
          all.indeterminate = count > 0 && count < boxes.length;
          Swal.getConfirmButton().textContent = "Send emails (" + count + ")";
        };
        all.addEventListener("change", () => {
          boxes.forEach((box) => {
            box.checked = all.checked;
          });
          sync();
        });
        boxes.forEach((box) => box.addEventListener("change", sync));
        sync();
      },
      preConfirm: () => {
        const chosen = [
          ...Swal.getPopup().querySelectorAll(
            'input[name="quiz-email-recipient"]:checked',
          ),
        ].map((box) => recipients[Number(box.value)]);
        if (!chosen.length) {
          Swal.showValidationMessage("Select at least one student.");
          return false;
        }
        return chosen;
      },
    });
    if (!selection.isConfirmed) return;
    setSending(true);
    setNotice("");
    const failed = [];
    let sent = 0;
    Swal.fire({
      title: "Sending emails…",
      text: "0 of " + selection.value.length + " processed",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      for (const recipient of selection.value) {
        try {
          const response = await fetch(
            `${API_BASE}/assessment-attempts/${encodeURIComponent(courseId)}/${encodeURIComponent(recipient.id)}/email`,
            {
              method: "POST",
              credentials: "include",
              headers: lessonAuthHeaders(),
            },
          );
          const data = await response.json();
          if (!response.ok || !data.success)
            throw new Error(data.message || "Could not send the email.");
          sent++;
        } catch (error) {
          failed.push(
            recipient.name + ": " + (error.message || "Could not send email."),
          );
        }
        Swal.update({
          text:
            sent +
            failed.length +
            " of " +
            selection.value.length +
            " processed",
        });
      }
      const message =
        sent +
        " email(s) sent successfully." +
        (failed.length ? " " + failed.length + " failed." : "");
      setNotice(message);
      await Swal.fire({
        icon: failed.length ? (sent ? "warning" : "error") : "success",
        title: failed.length ? "Email delivery results" : "Emails sent!",
        text:
          message +
          (failed.length
            ? "\n\n" + failed.join("\n")
            : " Students received their scores and answer keys."),
        confirmButtonColor: "#7fa8d6",
      });
    } finally {
      setSending(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([reportText], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `main-quiz-result-${attempt.id}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const renderResponseQuestion = (answer, print = false) => (
    <article
      className={`main-response-card main-response-question ${answer.isCorrect === true ? "response-correct" : answer.isCorrect === false ? "response-incorrect" : ""}`}
      key={answer.questionIndex}
    >
      <div className="main-response-question-heading">
        <div>
          <span className="main-response-question-number">
            Question {answer.questionIndex + 1}
          </span>
          <h3>{answer.question}</h3>
        </div>
        <span>
          {answer.isCorrect === true
            ? "✓ Correct"
            : answer.isCorrect === false
              ? "✕ Incorrect"
              : "Not graded"}
        </span>
      </div>
      {answer.options.length > 0 && (
        <ul>
          {answer.options.map((option, j) => (
            <li
              key={j}
              className={option === answer.selected ? "response-selected" : ""}
            >
              <span aria-hidden="true">
                {print
                  ? `${String.fromCharCode(65 + j)}.`
                  : option === answer.selected
                    ? "◉"
                    : "○"}
              </span>{" "}
              {option}
              {option === answer.selected && <small>Student answer</small>}
            </li>
          ))}
        </ul>
      )}
      <p>
        <strong>Student answer:</strong> {answer.selected || "No answer"}
      </p>
      {includeKey && (
        <div className="main-response-answer-key">
          <p>
            <strong>Correct answer:</strong> {answer.correct || "Not recorded"}
          </p>
          {answer.explanation && <p>{answer.explanation}</p>}
        </div>
      )}
    </article>
  );
  return (
    <section
      className={`main-response-page ${embedded ? "main-response-embedded" : ""}`}
    >
      <div className="main-response-toolbar">
        {!embedded && (
          <button type="button" onClick={onBack}>
            <FiArrowLeft /> Back to summary
          </button>
        )}
        <div className="main-response-toolbar-heading">
          <div>
            <span className="main-response-eyebrow">MAIN QUIZ RESPONSES</span>

            <p>
              {selectedCourseTitle} · {quizTitle}
            </p>
          </div>
        </div>
        {!embedded && (
          <nav className="main-response-tabs" aria-label="Response views">
            <button type="button" onClick={onBack}>
              Summary
            </button>
            <span className="main-response-active-tab" aria-current="page">
              Individual
            </span>
          </nav>
        )}
        <div className="main-response-actions">
          <div className="main-response-pager">
            <span className="main-response-field-label">Student response</span>
            <button
              type="button"
              aria-label="Previous response"
              onClick={() => changeStudent(index - 1)}
              disabled={index === 0}
            >
              <FiChevronLeft />
            </button>
            <select
              aria-label="Select student response"
              value={attempt?.id ?? ""}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setNotice("");
              }}
            >
              {attempts.map((item, i) => (
                <option key={item.id} value={item.id}>
                  {i + 1}. {item.name}
                </option>
              ))}
            </select>
            <span className="main-response-position">
              {attempts.length ? index + 1 : 0} / {attempts.length}
            </span>
            <button
              type="button"
              aria-label="Next response"
              onClick={() => changeStudent(index + 1)}
              disabled={index >= attempts.length - 1}
            >
              <FiChevronRight />
            </button>
          </div>
          <div className="main-response-action-buttons">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!attempt}
            >
              <FiPrinter /> Print
            </button>
            <button
              className="main-response-primary"
              type="button"
              onClick={emailScore}
              disabled={!attempts.length || sending || !courseId}
              title="Choose students to receive their scores and answer keys"
            >
              <FiMail /> {sending ? "Sending…" : "Email score & answer key"}
            </button>
            <button type="button" onClick={download} disabled={!attempt}>
              <FiDownload /> Download results
            </button>
          </div>
        </div>
        <label className="main-response-key-toggle">
          <input
            type="checkbox"
            checked={includeKey}
            onChange={(event) => setIncludeKey(event.target.checked)}
          />{" "}
          Show answer key in response and print
        </label>
        <p className="main-response-email-note">
          Choose selected students or all students to receive their own score
          and answer key.
        </p>
        {notice && (
          <p className="main-response-notice" role="status">
            {notice}
          </p>
        )}
      </div>
      {!detailsOpen && (
        <section className="response-directory qa-print-report">
          <header className="response-print-heading">
            <span>ACADEMIC REPORT</span>
            <h2>Student Response Summary</h2>
            <p>{courseTitle}</p>
            <p>{quizTitle}</p>
          </header>
          <div className="response-directory-heading">
            <label htmlFor="response-search">Student responses</label>
            <span>{visibleResponses.length} responses</span>
          </div>
          <input
            id="response-search"
            type="search"
            placeholder="Search student name, section, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <nav className="response-result-tabs" aria-label="Filter results">
            {["all", "passed", "failed"].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={resultFilter === value}
                onClick={() => setResultFilter(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </nav>
          {visibleResponses.map((student, i) => (
            <article
              className="response-student-card"
              key={student.id ?? i}
            >
              <div>
                <h3>{student.name}</h3>
                <p className="response-student-meta">
                  <span>{student.section || "Section unavailable"}</span>
                  <span>{student.email || "Email not recorded"}</span>
                </p>
                <div className="response-outcome-line">
                  <span
                    className={`response-outcome ${passed(student) ? "passed" : "failed"}`}
                  >
                    {percentOf(student) === null
                      ? "Not graded"
                      : passed(student)
                        ? "Passed"
                        : "Failed"}
                  </span>
                  <span className="response-module-name">
                    Module: {student.moduleTitle || "Unavailable"}
                  </span>
                </div>
              </div>
              <div className="response-card-actions">
                <strong className={passed(student) ? "passed" : "failed"}>
                  {percentOf(student) === null
                    ? "Not graded"
                    : `${percentOf(student)}%`}
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(student.id);
                    setDetailsOpen(true);
                  }}
                >
                  View Details
                </button>
              </div>
            </article>
          ))}
          {!visibleResponses.length && (
            <p className="response-directory-empty">
              No responses match these filters.
            </p>
          )}
          {visibleResponses.length > 0 && (
            <table className="response-summary-print" aria-label="Student score summary">
              <thead>
                <tr>
                  <th scope="col">Student Name</th>
                  <th scope="col">Year Level</th>
                  <th scope="col">Section</th>
                  <th scope="col">Score</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {visibleResponses.map((student, i) => (
                  <tr key={student.id ?? i}>
                    <td>{student.name || "Name unavailable"}</td>
                    <td>{student.yearLevel || "N/A"}</td>
                    <td>{student.section || "Section unavailable"}</td>
                    <td>
                      {percentOf(student) === null ? (
                        "Not graded"
                      ) : (
                        <>
                          <strong>{percentOf(student)}%</strong>
                          <small>
                            {student.earnedScore} / {student.total}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {percentOf(student) === null
                        ? "Not graded"
                        : passed(student)
                          ? "Passed"
                          : "Failed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {detailsOpen && attempt ? (
        <div className="main-response-report qa-print-report">
          <header className="response-print-heading response-individual-print-heading">
            <div className="response-paper-brand-row">
              <span>{reportPrintedAt}</span>
              <strong>PuffyBrain</strong>
            </div>
            <h2>{attempt.moduleTitle || "Module unavailable"}</h2>
            <div className="response-paper-student-fields">
              <div><span>Name:</span><strong>{attempt.name || ""}</strong></div>
              <div><span>Date:</span><strong>{formatReportDate(attempt.submittedAt)}</strong></div>
              <div><span>Section:</span><strong>{attempt.section || ""}</strong></div>
              <div><span>Score:</span><strong>{percentOf(attempt) === null ? "Not graded" : `${attempt.earnedScore} / ${attempt.total} (${percentOf(attempt)}%)`}</strong></div>
            </div>
          </header>
          <nav className="response-detail-back"><button type="button" onClick={() => setDetailsOpen(false)}>‹ Back to students</button></nav>
          <section className="response-detail-summary main-response-card">
            <header><h2>{attempt.name}</h2><p>{attempt.section || "Section unavailable"} · {quizTitle}</p><div className="response-outcome-line"><span className={`response-outcome ${passed(attempt) ? "passed" : "failed"}`}>{passed(attempt) ? "Passed" : "Failed"}</span><span className="response-module-name">Module: {attempt.moduleTitle || "Unavailable"}</span></div></header>
            <div className="response-detail-metrics">
              <div><span>Score</span><strong>{percentOf(attempt)}%</strong></div>
              {["LOTS", "HOTS"].map(skill => {
                const skillAnswers = (attempt.answers || []).filter(a => String(a.thinking_skill ?? a.thinkingSkill ?? "").toUpperCase() === skill || (skill === "LOTS" ? ["Remember", "Understand", "Apply"] : ["Analyze", "Evaluate", "Create"]).includes(a.cognitive_level ?? a.cognitiveLevel));
                const correct = skillAnswers.filter(a => readMainQuizResponseAnswer(a).isCorrect === true).length;
                return <div key={skill}><span>{skill}</span><strong>{skillAnswers.length ? `${Math.round(correct / skillAnswers.length * 100)}%` : "N/A"}</strong></div>;
              })}
            </div>
            <h3>Quiz Details</h3>
            <dl className="response-quiz-facts"><dt>Assessment</dt><dd>{assessmentTitle || `${courseTitle} - ${quizTitle || "Main Quiz"}`}</dd><dt>Module</dt><dd>{attempt.moduleTitle || "Module unavailable"}</dd><dt>Passing Score</dt><dd>{Number(attempt.total) > 0 ? `${Math.round((Number.isFinite(passScore) ? passScore : Math.max(1, Math.ceil(Number(attempt.total) * 0.7))) / Number(attempt.total) * 100)}%` : "N/A"}</dd></dl>
          </section>
          <section className="response-student-answers response-student-answers-screen">
            <h2>Student Answers</h2>
            {typedAnswers.map((answer) => renderResponseQuestion(answer))}
            {!answers.length && (
              <p className="main-response-card">
                Question-level answers were not recorded for this response.
              </p>
            )}
          </section>
          <section className="response-student-answers response-student-answers-print">
            {responseTestGroups.map((group) => (
              <div className="response-test-section" key={group.type}>
                <h3>{group.heading}</h3>
                {group.answers.map((answer) => renderResponseQuestion(answer, true))}
              </div>
            ))}
            {!answers.length && (
              <p className="main-response-card">
                Question-level answers were not recorded for this response.
              </p>
            )}
          </section>
        </div>
      ) : (
        !attempt && <p className="main-response-card">No responses yet.</p>
      )}
    </section>
  );
}
