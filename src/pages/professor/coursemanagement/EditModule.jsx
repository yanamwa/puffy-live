import QuizSourceEvidence from "../../../components/quizmodes/QuizSourceEvidence.jsx";
import {
  requestQuizSettings,
  quizSourceFields,
  quizGenerationFields,
  notifyQuizGenerated,
} from "../../../services/quizGenerationUi.js";
import { notifyLessonGenerated } from "../../../services/lessonNotifications.js";
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import { uploadLessonSource } from "../../../services/lessonRagApi.js";
import LessonSourceEvidence from "../../../components/lesson/LessonSourceEvidence.jsx";
import LessonSourceManager from "../../../components/lesson/LessonSourceManager.jsx";
import LessonFilePicker from "../../../components/lesson/LessonFilePicker.jsx";
import {
  LayoutDashboard,
  Users,
  Layers,
  LibraryBig,
  LogOut,
  Search,
  User,
  Settings,
  Database,
} from "lucide-react";
import Swal from "sweetalert2";
import styles from "./editmodule.module.css";
import "boxicons/css/boxicons.min.css";
import { API_BASE } from "../../../config.js";
import LoadingState from "../../../components/LoadingState.jsx";
import AdminSidebar from "../../components/ASidebar";
import AdminHeader from "../../components/AHeader";

const GENERATE_COOLDOWN_MS = 5 * 60 * 60 * 1000;
const GENERATE_COOLDOWN_KEY = "editModuleQuizGenerateCooldown";

function parseDeckCards(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((item, index) =>
      normalizeQuizItem({
        ...item,
        id: item.id || index + 1,
        question: String(item.question || "").trim(),
        options: item.options,
        correct_answer: item.correct_answer || item.correctAnswer,
        explanation: String(item.explanation || "").trim(),
      }),
    );
  }

  const text = String(raw).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed.map((x, i) =>
        normalizeQuizItem({
          ...x,
          id: i + 1,
          question: String(x.question || "").trim(),
          options: x.options,
          correct_answer: x.correct_answer || x.correctAnswer,
          explanation: String(x.explanation || "").trim(),
        }),
      );
    }
  } catch (error) {
    console.error("Invalid quiz JSON:", error);
  }

  return [];
}

function serializeQuizItems(items) {
  return JSON.stringify(
    items.map((item) => ({
      ...item,
      question: String(item.question || "").trim(),
      options: Array.isArray(item.options)
        ? item.options.map((opt) => String(opt || "").trim())
        : [],
      correct_answer: String(item.correct_answer || "").trim(),
      explanation: String(item.explanation || "").trim(),
    })),
  );
}

function parseLessonPages(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((page, index) => ({
      ...page,
      id: page.id || index + 1,
      title: String(page.title || `Lesson Page ${index + 1}`).trim(),
      content: String(page.content || page.description || "").trim(),
    }));
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map((page, index) => ({
        ...page,
        id: index + 1,
        title: String(page.title || `Lesson Page ${index + 1}`).trim(),
        content: String(page.content || "").trim(),
      }));
    }
  } catch {
    return [
      {
        id: 1,
        title: "Lesson Content",
        content: String(raw || "").trim(),
      },
    ];
  }

  return [];
}

function serializeLessonPages(pages) {
  return JSON.stringify(
    pages.map((page) => ({
      ...page,
      title: String(page.title || "").trim(),
      content: String(page.content || "").trim(),
    })),
  );
}

const TITLE_CHAR_LIMIT = 100;
const LONG_TEXT_CHAR_LIMIT = 750;
const LESSON_CONTENT_CHAR_LIMIT = 6000;
const QUIZ_CHAR_LIMIT = 500;
const EXPLANATION_CHAR_LIMIT = 500;

function getCharCount(value) {
  return String(value || "").length;
}

function limitChars(value, limit) {
  return String(value || "").slice(0, limit);
}

function hasTooMuchRepeatedPattern(value) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();

  if (text.length < 12) return false;

  if (/(.)\1{5,}/.test(text)) return true;

  const commonSpamPatterns = [
    "dadada",
    "awawaw",
    "asdfasdf",
    "qwertyqwerty",
    "hahaha",
    "hehehe",
  ];

  if (commonSpamPatterns.some((pattern) => text.includes(pattern))) return true;

  for (let size = 2; size <= 10; size++) {
    for (let start = 0; start <= text.length - size * 4; start++) {
      const pattern = text.slice(start, start + size);
      const repeated = pattern.repeat(4);

      if (text.includes(repeated)) return true;
    }
  }

  const chunks = text.match(/.{1,4}/g) || [];
  const uniqueChunks = new Set(chunks);

  return chunks.length >= 8 && uniqueChunks.size <= 3;
}

function isLikelyGibberish(value) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();

  if (!text) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  const suspiciousWords = words.filter((word) => {
    if (word.length < 8) return false;

    const vowels = (word.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowels / word.length;

    const consonantRuns = word.match(/[bcdfghjklmnpqrstvwxyz]{5,}/g) || [];
    const hasLongConsonantRun = consonantRuns.length > 0;

    return vowelRatio < 0.18 || hasLongConsonantRun;
  });

  const noSpaceText = text.replace(/\s+/g, "");
  const vowels = (noSpaceText.match(/[aeiou]/g) || []).length;
  const vowelRatio = noSpaceText.length ? vowels / noSpaceText.length : 0;
  const hasVeryLongNoSpaceText = words.length === 1 && noSpaceText.length >= 18;

  if (hasVeryLongNoSpaceText && vowelRatio < 0.22) return true;

  return suspiciousWords.length >= Math.ceil(words.length * 0.6);
}

function isInvalidText(value) {
  return hasTooMuchRepeatedPattern(value) || isLikelyGibberish(value);
}

function counterClass(current, limit) {
  return current >= limit
    ? `${styles.wordCounter} ${styles.wordCounterFull}`
    : styles.wordCounter;
}

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
  return [...unique.values()];
}

function normalizeQuizItem(item) {
  if (item.type === "identification")
    return {
      ...item,
      options: [],
      accepted_answers: normalizeAcceptedAnswers(
        item.accepted_answers ??
          item.acceptedAnswers ??
          item.acceptable_answers ??
          item.answer_aliases ??
          item.alternatives,
      ),
      correct_answer: String(
        item.correct_answer || item.correctAnswer || "",
      ).trim(),
    };
  if (item.type === "true_false")
    return {
      ...item,
      options: ["True", "False"],
      accepted_answers: [],
      correct_answer: String(
        item.correct_answer || item.correctAnswer || "",
      ).trim(),
    };

  const correctAnswer = limitChars(
    String(item.correct_answer || item.correctAnswer || "").trim(),
    QUIZ_CHAR_LIMIT,
  );

  const options = Array.isArray(item.options)
    ? [...item.options, "", "", ""]
        .slice(0, 4)
        .map((option) =>
          limitChars(String(option || "").trim(), QUIZ_CHAR_LIMIT),
        )
    : ["", "", "", ""];

  if (
    correctAnswer &&
    !options.some(
      (option) => option.trim().toLowerCase() === correctAnswer.toLowerCase(),
    )
  ) {
    const emptyIndex = options.findIndex((option) => !option.trim());
    options[emptyIndex === -1 ? 3 : emptyIndex] = correctAnswer;
  }

  return {
    ...item,
    options,
    accepted_answers: [],
    correct_answer: correctAnswer,
  };
}

function getCorrectOptionIndex(item) {
  const answer = String(item.correct_answer || "")
    .trim()
    .toLowerCase();
  if (!answer || !Array.isArray(item.options)) return "";

  const index = item.options.findIndex(
    (option) =>
      String(option || "")
        .trim()
        .toLowerCase() === answer,
  );

  return index === -1 ? "" : String(index);
}

export default function EditModule() {
  const { id } = useParams();
  const navigate = useNavigate();

  const API_URL = `${API_BASE}/adminLearningModule.php`;
  const AI_API_URL = `${API_BASE}/lessons/generate-quiz`;
  const EXTRACT_API_URL = `${API_BASE}/lessons/process-file`;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [bellNotifications, setBellNotifications] = useState([]);
  const notificationCount = bellNotifications.filter(
    (notif) => notif.status === "unread",
  ).length;

  const [loading, setLoading] = useState(true);
  const [sourceCourseId, setSourceCourseId] = useState(null);

  const [admin, setAdmin] = useState({
    username: "Admin",
    full_name: "",
    email: "",
    role: "",
    profile_image: "/images/temporary profile.jpg",
  });

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editLearningObjectives, setEditLearningObjectives] = useState("");
  const [editLessonPages, setEditLessonPages] = useState([]);
  const [editStatus, setEditStatus] = useState("draft");

  const [editQuizItems, setEditQuizItems] = useState([]);
  const [generatingEditQuiz, setGeneratingEditQuiz] = useState(false);

  const [uploadedFile, setUploadedFile] = useState([]);
  const [extractingFile, setExtractingFile] = useState(false);

  const handleLimitedChange = (setter, limit) => (e) => {
    setter(limitChars(e.target.value, limit));
  };

  const handleLimitedLessonChange = (index, field, limit) => (e) => {
    updateLessonPage(index, field, limitChars(e.target.value, limit));
  };

  const menuItems = [
    {
      label: "Dashboard",
      path: "/admin/dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    {
      label: "User Management",
      path: "/admin/users",
      icon: <Users size={20} />,
    },
    {
      label: "Module Management",
      path: "/admin/modules",
      icon: <Layers size={20} />,
    },
    {
      label: "Decks Management",
      path: "/admin/decks",
      icon: <LibraryBig size={20} />,
    },
    {
      label: "Notification Management",
      path: "/admin/notifications",
      icon: <i className="bx bx-bell"></i>,
    },
    {
      label: "Backup & Restore",
      path: "/admin/backup-restore",
      icon: <Database size={20} />,
    },
  ];

  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/admin/login";
  };

  const fetchAdmin = async () => {
    try {
      const res = await fetch(`${API_BASE}/getAdminProfile.php`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!data.success) {
        console.error(data.message || "Admin not found");
        return;
      }

      setAdmin({
        username: data.admin?.username || "Admin",
        full_name: data.admin?.full_name || "",
        email: data.admin?.email || "",
        role: data.admin?.role || "Administrator",
        profile_image:
          data.admin?.profile_image || "/images/temporary profile.jpg",
      });
    } catch (err) {
      console.error("Fetch admin error:", err);
    }
  };

  const fetchBellNotifications = async () => {
    try {
      const storedAdmin = JSON.parse(localStorage.getItem("admin") || "{}");

      const res = await fetch(
        `${API_BASE}/getAdminNotifications.php?admin_id=${storedAdmin.id || ""}`,
        { credentials: "include" },
      );

      const data = await res.json();

      if (data.success) {
        setBellNotifications(data.notifications || []);
      } else {
        setBellNotifications([]);
      }
    } catch (err) {
      console.error("Bell notification fetch error:", err);
      setBellNotifications([]);
    }
  };

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();

    const storedAdmin = JSON.parse(localStorage.getItem("admin") || "{}");
    const adminId = storedAdmin.id;

    if (!adminId) {
      Swal.fire("Error", "No admin ID found. Please log in again.", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/markAdminNotificationsRead.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ admin_id: adminId }),
      });

      const data = await res.json();

      if (data.success) {
        await fetchBellNotifications();
        setNotificationOpen(true);
      } else {
        Swal.fire("Error", data.message || "Failed to mark as read.", "error");
      }
    } catch (err) {
      console.error("Mark all as read error:", err);
      Swal.fire("Server Error", "Failed to mark as read.", "error");
    }
  };

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const res = await fetch(API_URL, {
          credentials: "include",
          headers: lessonAuthHeaders(),
        });

        const data = await res.json();

        if (data?.success && Array.isArray(data.modules)) {
          const mod = data.modules.find((m) => String(m.id) === String(id));

          if (!mod) {
            await Swal.fire({
              icon: "error",
              title: "Not Found",
              text: "Module not found.",
            });

            navigate("/admin/modules");
            return;
          }

          setEditTitle(mod.title || "");
          setSourceCourseId(mod.course_id || mod.courseId || null);
          setEditDesc(mod.description || "");
          setEditSubject(mod.subject || "");
          setEditLearningObjectives(mod.learning_objectives || "");
          setEditLessonPages(
            parseLessonPages(
              mod.lesson_content ||
                mod.lessonContent ||
                mod.lesson_pages ||
                mod.lessonPages ||
                "",
            ),
          );
          setEditStatus(String(mod.status || "draft").toLowerCase());
          setEditQuizItems(
            parseDeckCards(
              mod.quiz_contents ||
                mod.quizModule ||
                mod.quiz_items ||
                mod.quizItems,
            ),
          );
        }
      } catch (err) {
        console.error("LOAD ERROR:", err);

        await Swal.fire({
          icon: "error",
          title: "Load Failed",
          text: "Could not fetch module.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();
    fetchBellNotifications();
    fetchModule();

    const handler = (e) => {
      const insideDropdown = e.target.closest(`.${styles.notificationWrapper}`);

      if (!insideDropdown) {
        setNotificationOpen(false);
      }
    };

    window.addEventListener("click", handler);

    return () => window.removeEventListener("click", handler);
  }, [id, navigate]);

  const handleUploadAndExtract = async () => {
    if (!uploadedFile.length) {
      await Swal.fire({
        icon: "warning",
        title: "No File Selected",
        text: "Please choose PDF, PPT, PPTX, DOCX, or TXT files first.",
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Replace Current Module Content?",
      text: "This will replace the current title, description, subject, objectives, and lesson pages.",
      showCancelButton: true,
      confirmButtonText: "Yes, replace it",
      cancelButtonText: "Cancel",
      customClass: {
        popup: styles.replacePopup,
        title: styles.replaceTitle,
        htmlContainer: styles.replaceHtml,
        confirmButton: styles.replaceConfirmBtn,
        cancelButton: styles.replaceCancelBtn,
      },
      buttonsStyling: false,
    });

    if (!confirm.isConfirmed) return;

    const formData = new FormData();
    uploadedFile.forEach((file) => formData.append("files", file));
    if (!sourceCourseId) {
      Swal.fire(
        "Course required",
        "This module needs a saved course association before indexing a source.",
        "info",
      );
      return;
    }
    formData.append("course_id", sourceCourseId);
    formData.append("lesson_id", id);

    setExtractingFile(true);

    Swal.fire({
      title: "Sorting Lesson...",
      text: "Organizing the file into lesson pages.",
      imageUrl: "/images/Loading.png",
      imageWidth: 220,
      imageHeight: 220,
      allowOutsideClick: false,
      showConfirmButton: false,
      customClass: {
        popup: styles.lessonPopup,
        image: styles.lessonPopupImage,
        title: styles.lessonPopupTitle,
        htmlContainer: styles.lessonPopupText,
        loader: styles.lessonPopupLoader,
      },
      didOpen: () => Swal.showLoading(),
    });

    try {
      const data = await uploadLessonSource(formData, (job) => {
        if (Swal.isVisible())
          Swal.update({
            text: `Organizing lesson: ${job.progress}% (${job.phase})`,
          });
      });

      Swal.close();

      if (!data.success) {
        throw new Error(data.message || "Could not extract module content.");
      }

      const pages =
        Array.isArray(data.lesson_pages) && data.lesson_pages.length > 0
          ? data.lesson_pages.map((page, index) => ({
              ...page,
              id: index + 1,
              title: String(page.title || `Lesson Page ${index + 1}`).trim(),
              content: String(page.content || "").trim(),
            }))
          : parseLessonPages(data.lesson_content || "");

      if (pages.length === 0) {
        throw new Error(
          data.message ||
            "The materials uploaded, but no lesson pages were created. Use files containing selectable text.",
        );
      }

      setEditTitle(data.module_title || "");
      setEditSubject(data.subject || "");
      setEditDesc(data.description || "");
      setEditLearningObjectives(data.learning_objectives || "");
      setEditLessonPages(pages);
      setUploadedFile([]);

      notifyLessonGenerated(pages);
    } catch (err) {
      console.error("UPLOAD EXTRACT ERROR:", err);
      Swal.close();

      await Swal.fire({
        icon: "error",
        title: "Extraction Failed",
        text: err.message || "Something went wrong while extracting the file.",
      });
    } finally {
      setExtractingFile(false);
    }
  };

  const getLessonContentForAI = () => {
    return editLessonPages
      .map((page, index) => `Page ${index + 1}: ${page.title}\n${page.content}`)
      .join("\n\n");
  };

  const generateQuizFromAI = async (settings) => {
    const res = await fetch(AI_API_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...lessonAuthHeaders(),
      },
      body: JSON.stringify({
        ...quizSourceFields(sourceCourseId, id, editLessonPages),
        lesson_title: editTitle,
        learning_objectives: editLearningObjectives,
        lesson_content: getLessonContentForAI(),
        ...quizGenerationFields(settings, {
          lessonTitle: editTitle,
          learningObjectives: editLearningObjectives,
          lessonContent: getLessonContentForAI(),
        }),
      }),
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server did not return valid quiz content.");
    }

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Could not generate quiz.");
    }

    let questions = [];

    if (Array.isArray(data.quiz)) {
      questions = data.quiz;
    } else if (Array.isArray(data.quiz?.questions)) {
      questions = data.quiz.questions;
    } else if (Array.isArray(data.questions)) {
      questions = data.questions;
    }

    return questions.map((item, index) =>
      normalizeQuizItem({
        ...item,
        id: index + 1,
        question: String(item.question || "").trim(),
        options: item.options,
        correct_answer: item.correct_answer || item.correctAnswer,
        explanation: String(item.explanation || "").trim(),
      }),
    );
  };

  const handleGenerateQuizForEdit = async () => {
    const lastGeneratedAt = Number(
      localStorage.getItem(GENERATE_COOLDOWN_KEY) || 0,
    );
    const now = Date.now();
    const timeLeft = GENERATE_COOLDOWN_MS - (now - lastGeneratedAt);

    if (lastGeneratedAt && timeLeft > 0) {
      const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));

      await Swal.fire({
        icon: "warning",
        title: "Generate Cooldown",
        text: `You can generate again in about ${hoursLeft} hour(s).`,
        buttonsStyling: false,
      });
      return;
    }

    if (!editLearningObjectives.trim() && editLessonPages.length === 0) {
      await Swal.fire({
        icon: "warning",
        title: "Missing Content",
        text: "Please enter learning objectives or lesson pages first.",
        buttonsStyling: false,
      });
      return;
    }

    const { value: formValues } = await requestQuizSettings();

    if (!formValues) return;

    setGeneratingEditQuiz(true);

    try {
      const quizItems = await generateQuizFromAI(formValues);

      setEditQuizItems(quizItems);
      localStorage.setItem(GENERATE_COOLDOWN_KEY, String(Date.now()));

      notifyQuizGenerated(quizItems.length);
    } catch (err) {
      console.error("AI GENERATE EDIT ERROR:", err);

      await Swal.fire({
        icon: "error",
        title: /couldn.t verify|grounding/i.test(error.message || "")
          ? "Lesson needs another attempt"
          : "Generation Failed",
        text: err.message || "Something went wrong while generating quiz.",
        buttonsStyling: false,
      });
    } finally {
      setGeneratingEditQuiz(false);
    }
  };

  const generateOptionsForItem = async (item) => {
    const res = await fetch(`${API_BASE}/generateOptions.php`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: item.question,
        correct_answer: item.correct_answer,
      }),
    });

    const data = await res.json();

    if (!data.success || !Array.isArray(data.wrong_options)) {
      throw new Error(data.message || "Could not generate wrong options.");
    }

    return {
      ...item,
      options: [...data.wrong_options.slice(0, 3), item.correct_answer].map(
        (option) => limitChars(String(option || "").trim(), QUIZ_CHAR_LIMIT),
      ),
      explanation: item.explanation?.trim()
        ? item.explanation
        : data.explanation || "",
    };
  };

  const isTrueFalseQuestion = (item) => {
    const answer = String(item.correct_answer || "")
      .trim()
      .toLowerCase();
    const options = Array.isArray(item.options)
      ? item.options.map((opt) =>
          String(opt || "")
            .trim()
            .toLowerCase(),
        )
      : [];

    return (
      ["true", "false"].includes(answer) &&
      options.includes("true") &&
      options.includes("false")
    );
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Missing Title",
        text: "Module title is required.",
      });
      return;
    }

    const hasInvalidRepeatedText =
      isInvalidText(editTitle) ||
      isInvalidText(editDesc) ||
      isInvalidText(editSubject) ||
      isInvalidText(editLearningObjectives) ||
      editLessonPages.some(
        (page) => isInvalidText(page.title) || isInvalidText(page.content),
      ) ||
      editQuizItems.some(
        (item) =>
          isInvalidText(item.question) ||
          isInvalidText(item.correct_answer) ||
          isInvalidText(item.explanation) ||
          item.options.some((option) => isInvalidText(option)),
      );

    if (hasInvalidRepeatedText) {
      await Swal.fire({
        icon: "warning",
        title: "Invalid Content",
        text: "Repeated random characters, repeated text patterns, or keyboard-smash text are not allowed.",
      });
      return;
    }

    const completedQuizItems = [];

    for (const item of editQuizItems) {
      const hasQuestion = String(item.question || "").trim();
      const hasAnswer = String(item.correct_answer || "").trim();

      const hasEnoughOptions =
        isTrueFalseQuestion(item) ||
        item.options.slice(0, 4).every((opt) => String(opt || "").trim());

      if (hasQuestion && hasAnswer && !hasEnoughOptions) {
        try {
          const generatedItem = await generateOptionsForItem(item);
          completedQuizItems.push(generatedItem);
        } catch (err) {
          console.error("OPTION GENERATE ERROR:", err);

          await Swal.fire({
            icon: "error",
            title: "Options Not Generated",
            text: "Please fill all options before publishing.",
          });

          return;
        }
      } else {
        completedQuizItems.push(item);
      }
    }

    const hasLessons = editLessonPages.some(
      (page) =>
        String(page.title || "").trim() && String(page.content || "").trim(),
    );

    const hasQuiz =
      completedQuizItems.length > 0 &&
      completedQuizItems.every((item) => {
        const hasQuestion = String(item.question || "").trim();
        const hasAnswer = String(item.correct_answer || "").trim();

        if (!hasQuestion || !hasAnswer) return false;

        if (isTrueFalseQuestion(item)) return true;

        return item.options
          .slice(0, 4)
          .every((opt) => String(opt || "").trim());
      });

    const hasRequiredContent =
      editDesc.trim() &&
      editSubject.trim() &&
      editLearningObjectives.trim() &&
      hasLessons &&
      hasQuiz;

    const finalStatus = hasRequiredContent ? editStatus : "draft";

    const payload = {
      action: "update",
      id: Number(id),
      title: editTitle.trim(),
      description: editDesc.trim(),
      subject: editSubject.trim(),
      learning_objectives: editLearningObjectives.trim(),
      lesson_content: serializeLessonPages(editLessonPages),
      status: finalStatus,
      quiz_contents: serializeQuizItems(completedQuizItems),
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      console.log("SAVE RAW RESPONSE:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server did not return valid JSON.");
      }

      if (data.success) {
        await Swal.fire({
          icon: "success",
          title: "Updated!",
          text: `Module successfully saved as ${
            finalStatus === "publish" ? "Published" : "Draft"
          }.`,
          buttonsStyling: false,
        });

        navigate("/admin/modules");
      } else {
        await Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: data.message || "Update failed.",
        });
      }
    } catch (err) {
      console.error("SAVE ERROR:", err);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Error updating module.",
      });
    }
  };

  const addLessonPage = async () => {
    const { value } = await Swal.fire({
      html: `
        <div class="${styles.quizGenerateModal}">
          <div class="${styles.quizGenerateHeader}">
            <span>Add Lesson Page</span>
          </div>

          <div class="${styles.quizGenerateBody}">
            <div class="${styles.quizGenerateGroup}">
              <label>Page Title</label>
              <input
                id="lesson-title"
                type="text"
                placeholder="Enter page title"
              />
              <small id="lesson-title-counter">0/${TITLE_CHAR_LIMIT} characters</small>
            </div>

            <div class="${styles.quizGenerateGroup}">
              <label>Page Content</label>
              <textarea
                id="lesson-content"
                class="${styles.popupLongTextarea}"
                placeholder="Enter page content"
              ></textarea>
              <small id="lesson-content-counter">0/${LESSON_CONTENT_CHAR_LIMIT} characters</small>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      buttonsStyling: false,
      confirmButtonText: "Add Page",
      cancelButtonText: "Cancel",
      customClass: {
        popup: styles.quizGeneratePopup,
        htmlContainer: styles.quizGenerateHtml,
        actions: styles.quizGenerateActions,
        confirmButton: styles.quizGenerateConfirm,
        cancelButton: styles.quizGenerateCancel,
      },
      didOpen: () => {
        const titleInput = document.getElementById("lesson-title");
        const contentInput = document.getElementById("lesson-content");
        const titleCounter = document.getElementById("lesson-title-counter");
        const contentCounter = document.getElementById(
          "lesson-content-counter",
        );

        const syncCounter = (input, counter, limit) => {
          input.value = limitChars(input.value, limit);
          const count = getCharCount(input.value);
          counter.textContent = `${count}/${limit} characters`;
          counter.style.color = count >= limit ? "#b0478f" : "#666";
        };

        titleInput.addEventListener("input", () =>
          syncCounter(titleInput, titleCounter, TITLE_CHAR_LIMIT),
        );

        contentInput.addEventListener("input", () =>
          syncCounter(contentInput, contentCounter, LESSON_CONTENT_CHAR_LIMIT),
        );
      },
      preConfirm: () => {
        const title = limitChars(
          document.getElementById("lesson-title")?.value.trim(),
          TITLE_CHAR_LIMIT,
        );
        const content = limitChars(
          document.getElementById("lesson-content")?.value.trim(),
          LESSON_CONTENT_CHAR_LIMIT,
        );

        if (!title || !content) {
          Swal.showValidationMessage(
            "Please fill in the page title and content.",
          );
          return false;
        }

        return { title, content };
      },
    });

    if (!value) return;

    setEditLessonPages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        title: value.title,
        content: value.content,
      },
    ]);
  };

  const updateLessonPage = (index, field, value) => {
    setEditLessonPages((prev) =>
      prev.map((page, i) =>
        i === index
          ? {
              ...page,
              [field]: value,
              ...(field === "content"
                ? {
                    grounding: {
                      ...page.grounding,
                      model_review_passed: false,
                      human_review_required: true,
                    },
                  }
                : {}),
            }
          : page,
      ),
    );
  };

  const removeLessonPage = (index) => {
    setEditLessonPages((prev) => prev.filter((_, i) => i !== index));
  };

  const addEditQuizItem = async () => {
    const { value } = await Swal.fire({
      html: `
      <div class="${styles.quizGenerateModal}">
        <div class="${styles.quizGenerateHeader}">
          <span>Add Quiz Item</span>
        </div>

        <div class="${styles.quizGenerateBody}">
          <div class="${styles.quizGenerateGroup}">
            <label>Question</label>
            <input
              id="quiz-question"
              type="text"
              placeholder="Enter question"
            />
            <small id="question-counter">0/${QUIZ_CHAR_LIMIT} characters</small>
          </div>

          <div class="${styles.quizGenerateGroup}">
            <label>Options</label>
            <input id="quiz-option-1" type="text" maxlength="${QUIZ_CHAR_LIMIT}" placeholder="Option 1" />
            <small id="option-1-counter">0/${QUIZ_CHAR_LIMIT} characters</small>
            <input id="quiz-option-2" type="text" maxlength="${QUIZ_CHAR_LIMIT}" placeholder="Option 2" />
            <small id="option-2-counter">0/${QUIZ_CHAR_LIMIT} characters</small>
            <input id="quiz-option-3" type="text" maxlength="${QUIZ_CHAR_LIMIT}" placeholder="Option 3" />
            <small id="option-3-counter">0/${QUIZ_CHAR_LIMIT} characters</small>
            <input id="quiz-option-4" type="text" maxlength="${QUIZ_CHAR_LIMIT}" placeholder="Option 4" />
            <small id="option-4-counter">0/${QUIZ_CHAR_LIMIT} characters</small>
            <label>Answer Key</label>
            <select id="quiz-answer">
              <option value="">Select correct option</option>
              <option value="0">Option 1</option>
              <option value="1">Option 2</option>
              <option value="2">Option 3</option>
              <option value="3">Option 4</option>
            </select>
          </div>

          <div class="${styles.quizGenerateGroup}">
            <label>Explanation</label>
            <textarea
              id="quiz-explanation"
              class="${styles.popupShortTextarea}"
              placeholder="Enter explanation"
            ></textarea>
            <small id="explanation-counter">0/${EXPLANATION_CHAR_LIMIT} characters</small>
          </div>
        </div>
      </div>
    `,
      showCancelButton: true,
      buttonsStyling: false,
      confirmButtonText: "Add Quiz",
      cancelButtonText: "Cancel",
      customClass: {
        popup: styles.quizGeneratePopup,
        htmlContainer: styles.quizGenerateHtml,
        actions: styles.quizGenerateActions,
        confirmButton: styles.quizGenerateConfirm,
        cancelButton: styles.quizGenerateCancel,
      },
      didOpen: () => {
        const questionInput = document.getElementById("quiz-question");
        const questionCounter = document.getElementById("question-counter");
        const explanationInput = document.getElementById("quiz-explanation");
        const explanationCounter = document.getElementById(
          "explanation-counter",
        );
        const optionInputs = [1, 2, 3, 4].map((num) =>
          document.getElementById(`quiz-option-${num}`),
        );
        const optionCounters = [1, 2, 3, 4].map((num) =>
          document.getElementById(`option-${num}-counter`),
        );

        const updateQuizCounter = (input, counter) => {
          input.value = limitChars(input.value, QUIZ_CHAR_LIMIT);

          const count = getCharCount(input.value);
          counter.textContent = `${count}/${QUIZ_CHAR_LIMIT} characters`;
          counter.style.color = count >= QUIZ_CHAR_LIMIT ? "#b0478f" : "#666";
        };

        questionInput.addEventListener("input", () =>
          updateQuizCounter(questionInput, questionCounter),
        );

        optionInputs.forEach((input, index) => {
          input.addEventListener("input", () =>
            updateQuizCounter(input, optionCounters[index]),
          );
        });

        explanationInput.addEventListener("input", () => {
          explanationInput.value = limitChars(
            explanationInput.value,
            EXPLANATION_CHAR_LIMIT,
          );

          const count = getCharCount(explanationInput.value);
          explanationCounter.textContent = `${count}/${EXPLANATION_CHAR_LIMIT} characters`;
          explanationCounter.style.color =
            count >= EXPLANATION_CHAR_LIMIT ? "#b0478f" : "#666";
        });
      },
      preConfirm: () => {
        const question = limitChars(
          document.getElementById("quiz-question")?.value || "",
          QUIZ_CHAR_LIMIT,
        ).trim();

        const options = [1, 2, 3, 4].map((num) =>
          limitChars(
            document.getElementById(`quiz-option-${num}`)?.value || "",
            QUIZ_CHAR_LIMIT,
          ).trim(),
        );

        const [option1, option2, option3, option4] = options;
        const answerValue = document.getElementById("quiz-answer")?.value || "";
        const answerIndex = Number(answerValue);
        const correct_answer =
          answerValue !== "" ? options[answerIndex] || "" : "";

        const explanation = limitChars(
          document.getElementById("quiz-explanation")?.value || "",
          EXPLANATION_CHAR_LIMIT,
        ).trim();

        if (
          !question ||
          !option1 ||
          !option2 ||
          !option3 ||
          !option4 ||
          !correct_answer
        ) {
          Swal.showValidationMessage(
            "Please fill in the question, 4 options, and select the correct answer.",
          );
          return false;
        }

        return {
          question,
          options,
          correct_answer,
          explanation,
        };
      },
    });

    if (!value) return;

    setEditQuizItems((prev) => [
      ...prev,
      normalizeQuizItem({
        id: prev.length + 1,
        question: value.question,
        options: value.options,
        correct_answer: value.correct_answer,
        explanation: value.explanation,
      }),
    ]);
  };

  const updateEditQuizQuestion = (index, value) => {
    setEditQuizItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, question: limitChars(value, QUIZ_CHAR_LIMIT) }
          : item,
      ),
    );
  };

  const updateEditQuizOption = (itemIndex, optionIndex, value) => {
    setEditQuizItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;

        const updatedOptions = [...item.options];
        const previousOption = String(updatedOptions[optionIndex] || "").trim();
        const currentAnswer = String(item.correct_answer || "").trim();

        updatedOptions[optionIndex] = limitChars(value, QUIZ_CHAR_LIMIT);

        return {
          ...item,
          options: updatedOptions,
          correct_answer:
            currentAnswer &&
            previousOption.toLowerCase() === currentAnswer.toLowerCase()
              ? updatedOptions[optionIndex]
              : item.correct_answer,
        };
      }),
    );
  };

  const updateEditCorrectAnswer = (index, optionIndex) => {
    setEditQuizItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        return {
          ...item,
          correct_answer:
            optionIndex === "" ? "" : item.options[Number(optionIndex)] || "",
        };
      }),
    );
  };

  const updateEditExplanation = (index, value) => {
    setEditQuizItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, explanation: limitChars(value, EXPLANATION_CHAR_LIMIT) }
          : item,
      ),
    );
  };
  const removeEditQuizItem = (index) => {
    setEditQuizItems((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className={styles.gridContainer}>
        <main className={styles.main}>
          <LoadingState />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.gridContainer}>
      <AdminSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <AdminHeader
        admin={admin}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        notificationOpen={notificationOpen}
        setNotificationOpen={setNotificationOpen}
        bellNotifications={bellNotifications}
        notificationCount={notificationCount}
        handleMarkAllAsRead={handleMarkAllAsRead}
      />
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1>Edit Module</h1>
          <p className={styles.pageHeaderText}>
            Build the course using modules. Each module can contain lesson pages
            and its own quiz.
          </p>
        </div>

        <div className={styles.formCard}>
          <div className={styles.popupInfoGrid}>
            <div className={styles.popupField}>
              <label className={styles.popupLabel}>
                Module Title <span className={styles.required}>*Required</span>
              </label>

              <input
                className={styles.popupInput}
                value={editTitle}
                onChange={handleLimitedChange(setEditTitle, TITLE_CHAR_LIMIT)}
                placeholder="Enter module title"
              />
              <div
                className={counterClass(
                  getCharCount(editTitle),
                  TITLE_CHAR_LIMIT,
                )}
              >
                {getCharCount(editTitle)}/{TITLE_CHAR_LIMIT} characters
              </div>
            </div>

            <div className={styles.popupField}>
              <label className={styles.popupLabel}>Status</label>

              <select
                className={styles.popupSelect}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="publish">Publish</option>
              </select>
            </div>
          </div>

          <div className={styles.popupSection}>
            <label className={styles.popupLabel}>
              Module Description{" "}
              <span className={styles.required}>*Required</span>
            </label>

            <textarea
              className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
              value={editDesc}
              onChange={handleLimitedChange(setEditDesc, LONG_TEXT_CHAR_LIMIT)}
              placeholder="Enter module description"
            />
            <div
              className={counterClass(
                getCharCount(editDesc),
                LONG_TEXT_CHAR_LIMIT,
              )}
            >
              {getCharCount(editDesc)}/{LONG_TEXT_CHAR_LIMIT} characters
            </div>
          </div>

          <div className={styles.popupSection}>
            <label className={styles.popupLabel}>
              Subject <span className={styles.required}>*Required</span>
            </label>

            <input
              className={styles.popupInput}
              value={editSubject}
              onChange={handleLimitedChange(setEditSubject, TITLE_CHAR_LIMIT)}
              placeholder="Enter subject"
            />
            <div
              className={counterClass(
                getCharCount(editSubject),
                TITLE_CHAR_LIMIT,
              )}
            >
              {getCharCount(editSubject)}/{TITLE_CHAR_LIMIT} characters
            </div>
          </div>

          <div className={styles.popupSection}>
            <label className={styles.popupLabel}>
              Organize Learning Module
            </label>

            <div className={styles.uploadRow}>
              <LessonFilePicker
                files={uploadedFile}
                disabled={extractingFile}
                buttonClassName={styles.customFileBtn}
                onChange={setUploadedFile}
              />

              <button
                type="button"
                className={styles.popupAddBtn}
                onClick={handleUploadAndExtract}
                disabled={extractingFile || !uploadedFile.length}
              >
                {extractingFile ? "Generating..." : "Generate Module"}
              </button>
            </div>
            <LessonSourceManager
              courseId={sourceCourseId}
              lessonId={Number(id)}
              onGenerated={(result) => {
                setEditTitle(result.module_title);
                setEditDesc(result.description);
                setEditSubject(result.subject);
                setEditLearningObjectives(result.learning_objectives);
                setEditLessonPages(
                  result.lesson_pages.map((page, index) => ({
                    ...page,
                    id: index + 1,
                  })),
                );
              }}
            />
          </div>

          <div className={styles.popupSection}>
            <label className={styles.popupLabel}>
              Learning Objectives{" "}
              <span className={styles.required}>*Required</span>
            </label>

            <textarea
              className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
              value={editLearningObjectives}
              onChange={handleLimitedChange(
                setEditLearningObjectives,
                LONG_TEXT_CHAR_LIMIT,
              )}
              placeholder="Enter learning objectives"
            />
            <div
              className={counterClass(
                getCharCount(editLearningObjectives),
                LONG_TEXT_CHAR_LIMIT,
              )}
            >
              {getCharCount(editLearningObjectives)}/{LONG_TEXT_CHAR_LIMIT}{" "}
              characters
            </div>
          </div>

          <div className={styles.popupSection}>
            <div className={styles.popupSectionRow}>
              <label className={styles.popupLabel}>
                Lesson Pages <span className={styles.required}>*Required</span>
              </label>

              <button
                type="button"
                className={styles.popupAddBtn}
                onClick={addLessonPage}
              >
                Add Page +
              </button>
            </div>

            {editLessonPages.length === 0 ? (
              <div className={styles.popupEmptyQuiz}>No lesson pages yet.</div>
            ) : (
              editLessonPages.map((page, index) => (
                <div key={index} className={styles.popupQuizCard}>
                  <div className={styles.popupQuizCardTop}>
                    <span className={styles.popupQuizCardTitle}>
                      Page {index + 1}
                    </span>

                    <button
                      type="button"
                      className={styles.popupRemoveBtn}
                      onClick={() => removeLessonPage(index)}
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    className={`${styles.popupInput} ${styles.lessonPageText}`}
                    value={page.title}
                    onChange={handleLimitedLessonChange(
                      index,
                      "title",
                      TITLE_CHAR_LIMIT,
                    )}
                    placeholder="Page title"
                  />
                  <div
                    className={counterClass(
                      getCharCount(page.title),
                      TITLE_CHAR_LIMIT,
                    )}
                  >
                    {getCharCount(page.title)}/{TITLE_CHAR_LIMIT} characters
                  </div>

                  <textarea
                    className={`${styles.popupTextarea} ${styles.popupLargeBox} ${styles.lessonPageText}`}
                    value={page.content}
                    onChange={handleLimitedLessonChange(
                      index,
                      "content",
                      LESSON_CONTENT_CHAR_LIMIT,
                    )}
                    placeholder="Page content"
                  />
                  <div
                    className={counterClass(
                      getCharCount(page.content),
                      LESSON_CONTENT_CHAR_LIMIT,
                    )}
                  >
                    {getCharCount(page.content)}/{LESSON_CONTENT_CHAR_LIMIT}{" "}
                    characters
                  </div>
                  <LessonSourceEvidence page={page} />
                </div>
              ))
            )}
          </div>

          <div className={styles.popupSection}>
            <div className={styles.popupSectionRow}>
              <label className={styles.popupLabel}>
                Quiz Module <span className={styles.required}>*Required</span>
              </label>

              <div className={styles.quizActions}>
                <button
                  type="button"
                  className={styles.popupAddBtn}
                  onClick={handleGenerateQuizForEdit}
                  disabled={generatingEditQuiz}
                >
                  {generatingEditQuiz ? "Generating..." : "Auto Generate"}
                </button>

                <button
                  type="button"
                  className={styles.popupAddBtn}
                  onClick={addEditQuizItem}
                >
                  Add +
                </button>
              </div>
            </div>

            {editQuizItems.length === 0 ? (
              <div className={styles.popupEmptyQuiz}>No quiz items yet.</div>
            ) : (
              editQuizItems.map((item, index) => (
                <div key={index} className={styles.popupQuizCard}>
                  <div className={styles.popupQuizCardTop}>
                    <span className={styles.popupQuizCardTitle}>
                      Item {index + 1}
                    </span>

                    <button
                      type="button"
                      className={styles.popupRemoveBtn}
                      onClick={() => removeEditQuizItem(index)}
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    className={styles.popupInput}
                    value={item.question}
                    onChange={(e) =>
                      updateEditQuizQuestion(index, e.target.value)
                    }
                    placeholder="Question"
                  />
                  <div
                    className={counterClass(
                      getCharCount(item.question),
                      QUIZ_CHAR_LIMIT,
                    )}
                  >
                    {getCharCount(item.question)}/{QUIZ_CHAR_LIMIT} characters
                  </div>

                  <div className={styles.optionsGrid}>
                    {item.options.slice(0, 4).map((option, optionIndex) => (
                      <input
                        key={optionIndex}
                        className={styles.popupInput}
                        value={option}
                        onChange={(e) =>
                          updateEditQuizOption(
                            index,
                            optionIndex,
                            e.target.value,
                          )
                        }
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                    ))}
                  </div>

                  {item.type === "identification" ? (
                    <input
                      className={styles.popupInput}
                      value={item.correct_answer}
                      aria-label="Correct identification answer"
                      placeholder="Correct identification answer"
                      maxLength={150}
                      onChange={(event) =>
                        setEditQuizItems((current) =>
                          current.map((q, i) =>
                            i === index
                              ? { ...q, correct_answer: event.target.value }
                              : q,
                          ),
                        )
                      }
                    />
                  ) : (
                    <select
                      className={styles.popupInput}
                      value={getCorrectOptionIndex(item)}
                      onChange={(e) =>
                        updateEditCorrectAnswer(index, e.target.value)
                      }
                    >
                      <option value="">Select correct answer</option>
                      {item.options.slice(0, 4).map((option, optionIndex) => (
                        <option
                          key={optionIndex}
                          value={optionIndex}
                          disabled={!String(option || "").trim()}
                        >
                          Option {optionIndex + 1}
                        </option>
                      ))}
                    </select>
                  )}
                  <div
                    className={counterClass(
                      getCharCount(item.correct_answer),
                      QUIZ_CHAR_LIMIT,
                    )}
                  >
                    {getCharCount(item.correct_answer)}/{QUIZ_CHAR_LIMIT}{" "}
                    characters
                  </div>

                  {item.type === "identification" && (
                    <div>
                      <label className={styles.popupLabel}>
                        Other accepted answers (optional, one per line)
                      </label>
                      <textarea
                        className={styles.popupTextarea}
                        value={(item.accepted_answers || []).join("\n")}
                        aria-label="Other accepted answers"
                        placeholder="Enter approved alternatives, such as another spelling"
                        maxLength={3039}
                        onChange={(event) =>
                          setEditQuizItems((current) =>
                            current.map((question, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...question,
                                    accepted_answers: normalizeAcceptedAnswers(
                                      event.target.value,
                                    ).slice(0, 20),
                                  }
                                : question,
                            ),
                          )
                        }
                      />
                    </div>
                  )}

                  <textarea
                    className={`${styles.popupTextarea} ${styles.popupAnswerBox}`}
                    value={item.explanation}
                    onChange={(e) =>
                      updateEditExplanation(index, e.target.value)
                    }
                    placeholder="Explanation"
                  />
                  <QuizSourceEvidence question={item} />

                  <div
                    className={counterClass(
                      getCharCount(item.explanation),
                      EXPLANATION_CHAR_LIMIT,
                    )}
                  >
                    {getCharCount(item.explanation)}/{EXPLANATION_CHAR_LIMIT}{" "}
                    characters
                  </div>
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
              onClick={saveEdit}
            >
              Save
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
