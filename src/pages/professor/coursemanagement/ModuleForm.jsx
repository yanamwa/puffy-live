import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { API_BASE } from "../../../config.js";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import styles from "./modulemanage.module.css";
import AdminLayout from "./AdminLayout.js";

function normalizeAcceptedAnswers(value) {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const unique = new Map();
  candidates.forEach((candidate) => {
    if (typeof candidate !== "string") return;
    const answer = candidate.trim();
    const key = answer.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
    if (key && !unique.has(key)) unique.set(key, answer);
  });
  return [...unique.values()].slice(0, 20);
}

function serializeQuizItems(items) {
  return JSON.stringify(
    items
      .map((item) => ({
        question: String(item.question || "").trim(),
        answer: String(item.answer || "").trim(),
        accepted_answers: normalizeAcceptedAnswers(item.accepted_answers),
      }))
      .filter((item) => item.question || item.answer),
  );
}

export default function ModuleForm({ mode }) {
  const API_URL = `${API_BASE}/adminLearningModule.php`;
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [subject, setSubject] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [status, setStatus] = useState(mode === "add" ? "Draft" : "inactive");
  const [quizItems, setQuizItems] = useState([]);

  useEffect(() => {
    if (mode !== "edit" || !id) return;

    fetch(API_URL, { headers: lessonAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.modules)) {
          const mod = data.modules.find((m) => String(m.id) === String(id));
          if (!mod) return;

          setTitle(mod.title || "");
          setDesc(mod.description || "");
          setSubject(mod.subject || "");
          setLearningObjectives(mod.learning_objectives || "");
          setLessonContent(mod.lesson_content || "");
          setStatus(mod.status || "inactive");

          try {
            const parsed = JSON.parse(mod.quiz_contents || "[]");
            setQuizItems(
              Array.isArray(parsed)
                ? parsed.map((item) => ({
                    ...item,
                    accepted_answers: normalizeAcceptedAnswers(
                      item.accepted_answers ??
                        item.acceptedAnswers ??
                        item.answer_aliases ??
                        item.alternatives,
                    ),
                  }))
                : [],
            );
          } catch {
            setQuizItems([]);
          }
        }
      })
      .catch((err) => console.error(err));
  }, [mode, id]);

  const addQuizItem = () => {
    setQuizItems((prev) => [
      ...prev,
      { question: "", answer: "", accepted_answers: [] },
    ]);
  };

  const updateQuizItem = (index, field, value) => {
    setQuizItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const removeQuizItem = (index) => {
    setQuizItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Missing Title",
        text: "Module title is required.",
      });
      return;
    }

    const payload =
      mode === "edit"
        ? {
            action: "update",
            id: Number(id),
            title,
            description: desc,
            subject,
            learning_objectives: learningObjectives,
            lesson_content: lessonContent,
            status,
            quiz_contents: serializeQuizItems(quizItems),
          }
        : {
            title,
            description: desc,
            subject,
            learning_objectives: learningObjectives,
            lesson_content: lessonContent,
            status,
            quiz_contents: serializeQuizItems(quizItems),
          };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        await Swal.fire({
          icon: "success",
          title: mode === "edit" ? "Updated!" : "Added!",
          text:
            mode === "edit"
              ? "Module updated successfully."
              : "Module added successfully.",
        });

        navigate("/admin/modules");
      } else {
        await Swal.fire({
          icon: "error",
          title: "Failed",
          text: data.message || "Something went wrong.",
        });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Request failed.",
      });
    }
  };

  const [uploadFile, setUploadFile] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const handleFileUpload = async () => {
    if (!uploadFile) {
      await Swal.fire({
        icon: "warning",
        title: "No File Selected",
        text: "Please choose a file first.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      setIsProcessingFile(true);

      const res = await fetch(`${API_BASE}/processLessonFile.php`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setSubject(data.subject || "");
        setLearningObjectives(data.learning_objectives || "");
        setLessonContent(data.lesson_content || "");

        await Swal.fire({
          icon: "success",
          title: "File Processed",
          text: "The lesson content was extracted successfully.",
        });
      } else {
        await Swal.fire({
          icon: "error",
          title: "Processing Failed",
          text: data.message || "Could not process file.",
        });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Upload failed.",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <AdminLayout>
      <div className={styles.pageHeader}>
        <h1>{mode === "edit" ? "Edit Module" : "Add New Module"}</h1>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>Module Title</label>
          <input
            className={styles.popupInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter module title"
          />
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>Module Description</label>
          <textarea
            className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Enter module description"
          />
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>Subject</label>
          <input
            className={styles.popupInput}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject/course"
          />
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>Upload Lesson File</label>
          <input
            type="file"
            accept=".txt,.pdf,.doc,.docx"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          />

          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              className={styles.popupAddBtn}
              onClick={handleFileUpload}
              disabled={isProcessingFile}
            >
              {isProcessingFile ? "Processing..." : "Upload and Extract"}
            </button>
          </div>
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>Learning Objectives</label>
          <textarea
            className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
            value={learningObjectives}
            onChange={(e) => setLearningObjectives(e.target.value)}
            placeholder="Enter learning objectives here..."
          />
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>Lessons</label>
          <textarea
            className={`${styles.popupTextarea} ${styles.popupLargeBox}`}
            value={lessonContent}
            onChange={(e) => setLessonContent(e.target.value)}
            placeholder="Enter lesson content here..."
          />
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>Status</label>
          <select
            className={styles.popupSelect}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Draft">Draft</option>
            <option value="Publish">Publish</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className={styles.popupSection}>
          <div className={styles.popupSectionRow}>
            <label className={styles.popupLabel}>Quiz Module</label>
            <button
              type="button"
              className={styles.popupAddBtn}
              onClick={addQuizItem}
            >
              Add +
            </button>
          </div>

          {quizItems.length === 0 ? (
            <div className={styles.popupEmptyQuiz}>No quiz items yet.</div>
          ) : (
            quizItems.map((item, index) => (
              <div key={index} className={styles.popupQuizCard}>
                <div className={styles.popupQuizCardTop}>
                  <span className={styles.popupQuizCardTitle}>
                    Item {index + 1}
                  </span>
                  <button
                    type="button"
                    className={styles.popupRemoveBtn}
                    onClick={() => removeQuizItem(index)}
                  >
                    Remove
                  </button>
                </div>

                <input
                  className={styles.popupInput}
                  value={item.question}
                  onChange={(e) =>
                    updateQuizItem(index, "question", e.target.value)
                  }
                  placeholder="Question"
                />

                <textarea
                  className={`${styles.popupTextarea} ${styles.popupAnswerBox}`}
                  value={item.answer}
                  onChange={(e) =>
                    updateQuizItem(index, "answer", e.target.value)
                  }
                  placeholder="Answer"
                />

                <label className={styles.popupLabel}>
                  Other accepted answers (optional, one per line)
                </label>
                <textarea
                  className={styles.popupTextarea}
                  value={(item.accepted_answers || []).join("\n")}
                  onChange={(event) =>
                    updateQuizItem(
                      index,
                      "accepted_answers",
                      normalizeAcceptedAnswers(event.target.value),
                    )
                  }
                  placeholder="Enter approved alternatives, such as another spelling"
                  aria-label="Other accepted answers, one per line"
                  maxLength={3039}
                />
              </div>
            ))
          )}
        </div>

        <div className={styles.popupActions}>
          <button
            className={styles.popupCancelBtn}
            type="button"
            onClick={() => navigate("/admin/modules")}
          >
            Cancel
          </button>
          <button
            className={styles.popupSaveBtn}
            type="button"
            onClick={handleSubmit}
          >
            Save
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
