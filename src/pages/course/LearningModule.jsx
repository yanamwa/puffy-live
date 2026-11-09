import { readAccountQuizResult } from "../../utils/quizStorage.js";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import styles from "./Learning_Module.module.css";
import "../../index.css";
import { API_BASE } from "../../config.js";
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import QuizModesModal from "../../components/quizmodes/QuizModesModal";
import UserHeader from "../../components/UserHeader";
import UserSidebar from "../../components/UserSidebar";
import LoadingState from "../../components/LoadingState.jsx";
import {
  fetchCourseContent,
  getCourseQuizItems,
  getCourseSlideCount,
} from "./courseContent.js";
import {
  enrollStudentInCourseAsync,
  loadStudentEnrolledCourses,
} from "../student/courses/studentCourseData.js";
import {
  markManagedNotificationsAsReadForRole,
  mergeManagedNotificationsForRole,
  subscribeToManagedNotifications,
} from "../../utils/notifications.js";

const toast = {
  success: (message) => console.info(message),
  error: (message) => window.alert(message),
};

function LearningModule() {
  const navigate = useNavigate();
  const { lessonId } = useParams();

  const [lesson, setLesson] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tab1");
  const [openModes, setOpenModes] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [myDecks, setMyDecks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [notifications, setNotifications] = useState(() =>
    mergeManagedNotificationsForRole("student", []),
  );

  const [user, setUser] = useState({
    id: null,
    username: "",
    year_level: "",
    profile_image: "/images/temporary profile.jpg",
  });

  const [progress, setProgress] = useState({
    total_cards: 0,
    studied_cards: 0,
    progress_percent: 0,
    last_viewed_card: 0,
  });

  const notificationCount = notifications.filter(
    (notif) => notif.status === "unread" || notif.unread,
  ).length;

  const currentCourse = useMemo(() => {
    return courses.find((course) => {
      const ids = [
        course.id,
        course.lesson_id,
        course.course_id,
        course.module_id,
        course.code,
        course.courseCode,
      ];

      return ids.some((id) => String(id || "").trim() === String(lessonId));
    });
  }, [courses, lessonId]);

  const isCourseAdded = useMemo(() => {
    return courses.some((course) => {
      const ids = [
        course.id,
        course.lesson_id,
        course.course_id,
        course.module_id,
        course.code,
        course.courseCode,
      ];

      return ids.some((id) => String(id || "").trim() === String(lessonId));
    });
  }, [courses, lessonId]);

  const getDeckId = (deck) => deck?.id || deck?.deck_id || deck?.DeckID || "";

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/getUser.php`, {
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setUser({
          id: data.user?.id || data.user?.user_id || null,
          username: data.user?.username || "",
          year_level: data.user?.year_level || "",
          profile_image:
            data.user?.profile_image || "/images/temporary profile.jpg",
        });
      }
    } catch (err) {
      console.error("fetchUser error:", err);
    }
  };

  const fetchUserDecks = async () => {
    try {
      const res = await fetch(`${API_BASE}/userDecks.php`, {
        credentials: "include",
      });

      const data = await res.json();
      setMyDecks(data.success ? data.decks || [] : []);
    } catch (err) {
      console.error("fetchUserDecks error:", err);
      setMyDecks([]);
    }
  };

  const fetchCourses = async () => {
    try {
      const loadedCourses = await loadStudentEnrolledCourses();
      setCourses(loadedCourses);
    } catch (err) {
      console.error("fetchCourses error:", err);
      setCourses([]);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/getUserNotifications.php`, {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();
      setNotifications(
        mergeManagedNotificationsForRole(
          "student",
          data.success ? data.notifications || [] : [],
        ),
      );
    } catch (err) {
      console.error("Notification fetch error:", err);
      setNotifications(mergeManagedNotificationsForRole("student", []));
    }
  };

  const markNotificationsAsRead = async () => {
    markManagedNotificationsAsReadForRole("student");
    setNotifications((prev) =>
      prev.map((notif) => ({
        ...notif,
        unread: false,
        status: "read",
      })),
    );

    try {
      const res = await fetch(`${API_BASE}/markNotificationsAsRead.php`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setNotifications((prev) =>
          prev.map((notif) => ({
            ...notif,
            unread: false,
            status: "read",
          })),
        );
      }
    } catch (err) {
      console.error("Mark notifications as read error:", err);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchUserDecks();
    fetchCourses();
    fetchNotifications();
  }, []);

  useEffect(() => {
    const refreshNotifications = () => {
      setNotifications((currentNotifications) =>
        mergeManagedNotificationsForRole("student", currentNotifications),
      );
    };

    return subscribeToManagedNotifications(refreshNotifications);
  }, []);

  const getTotalSlides = (lessonData) => {
    return getCourseSlideCount(lessonData);
  };

  useEffect(() => {
    const loadLessonAndProgress = async () => {
      setLoading(true);

      try {
        const finalLesson = await fetchCourseContent(lessonId);

        setLesson(finalLesson);

        const totalSlides = getTotalSlides(finalLesson);

        const homepagePercentRaw =
          currentCourse?.progress_percent ??
          currentCourse?.progress ??
          currentCourse?.study_progress ??
          currentCourse?.percentage ??
          currentCourse?.completion_percent ??
          null;

        const homepageStudied =
          Number(currentCourse?.studied_cards) ||
          Number(currentCourse?.completed_cards) ||
          Number(currentCourse?.progress_count) ||
          0;

        const homepageTotal = Number(currentCourse?.total_cards) || totalSlides;

        if (homepagePercentRaw !== null && homepagePercentRaw !== undefined) {
          const cleanPercent = Number(
            String(homepagePercentRaw).replace("%", ""),
          );

          setProgress({
            total_cards: homepageTotal,
            studied_cards: homepageStudied || homepageTotal,
            progress_percent: Math.min(cleanPercent || 0, 100),
            last_viewed_card: 0,
          });

          return;
        }

        if (homepageStudied > 0 && homepageTotal > 0) {
          const homepagePercent = (homepageStudied / homepageTotal) * 100;

          setProgress({
            total_cards: homepageTotal,
            studied_cards: homepageStudied,
            progress_percent: Math.min(homepagePercent, 100),
            last_viewed_card: 0,
          });

          return;
        }

        if (!user.id) {
          setProgress({
            total_cards: totalSlides,
            studied_cards: 0,
            progress_percent: 0,
            last_viewed_card: 0,
          });

          return;
        }

        const progressRes = await fetch(
          `${API_BASE}/getLessonProgress.php?user_id=${user.id}&lesson_id=${lessonId}`,
          {
            credentials: "include",
            headers: lessonAuthHeaders(),
          },
        );

        const progressData = await progressRes.json();
        const realProgress = progressData?.progress || progressData;

        const studiedCards = Number(realProgress?.studied_cards) || 0;
        const lastViewedCard = Number(realProgress?.last_viewed_card) || 0;
        const safeStudiedCards = Math.min(studiedCards, totalSlides);

        const computedPercent =
          totalSlides > 0 ? (safeStudiedCards / totalSlides) * 100 : 0;

        setProgress({
          total_cards: totalSlides,
          studied_cards: safeStudiedCards,
          progress_percent: Math.min(computedPercent, 100),
          last_viewed_card: lastViewedCard,
        });
      } catch (err) {
        console.error("Error loading lesson/progress:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLessonAndProgress();
  }, [lessonId, user.id, currentCourse]);

  const quizzes = useMemo(() => {
    return getCourseQuizItems(lesson);
  }, [lesson]);

  const addCourseIfNeeded = async () => {
    if (isCourseAdded) return true;

    const cleanLessonId = String(lessonId || "").trim();

    if (!cleanLessonId) {
      Swal.fire({
        title: "Missing Lesson ID",
        text: "This lesson link is missing its lesson ID.",
        imageUrl: "/images/error.png",
        imageWidth: 170,
        imageHeight: 170,
        confirmButtonText: "Okay",
      });

      return false;
    }

    try {
      const addedCourse = await enrollStudentInCourseAsync(
        lesson || {
          id: cleanLessonId,
          title: "Untitled course",
        },
      );

      if (!addedCourse) {
        Swal.fire({
          title: "Could not add course",
          text: "Something went wrong.",
          imageUrl: "/images/error.png",
          imageWidth: 170,
          imageHeight: 170,
          confirmButtonText: "Okay",
        });

        return false;
      }

      await fetchCourses();
      return true;
    } catch (err) {
      console.error("addCourseIfNeeded error:", err);

      Swal.fire({
        title: "Server error",
        text: "Could not add this course.",
        imageUrl: "/images/error.png",
        imageWidth: 170,
        imageHeight: 170,
        confirmButtonText: "Okay",
      });

      return false;
    }
  };

  const handleStudy = () => {
    if (isCourseAdded) {
      navigate(`/introduction/${lessonId}`);
      return;
    }

    Swal.fire({
      customClass: {
        popup: styles.swalPopup,
        title: styles.swalTitle,
        htmlContainer: styles.swalText,
        confirmButton: styles.swalConfirmBtn,
        cancelButton: styles.swalCancelBtn,
        image: styles.swalImage,
        actions: styles.swalActions,
      },
      buttonsStyling: false,
      title: "Add this course?",
      text: "You need to add this course to My Courses before studying.",
      imageUrl: "/images/asking.png",
      imageWidth: 180,
      imageHeight: 180,
      showCancelButton: true,
      confirmButtonText: "Add Course",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      const added = await addCourseIfNeeded();

      if (added) {
        navigate(`/introduction/${lessonId}`);
      }
    });
  };

  const handlePractice = () => {
    if (isCourseAdded) {
      setOpenModes(true);
      return;
    }

    Swal.fire({
      customClass: {
        popup: styles.swalPopup,
        title: styles.swalTitle,
        htmlContainer: styles.swalText,
        confirmButton: styles.swalConfirmBtn,
        cancelButton: styles.swalCancelBtn,
        image: styles.swalImage,
        actions: styles.swalActions,
      },
      buttonsStyling: false,
      title: "Add this course?",
      text: "You need to add this course to My Courses before practicing.",
      imageUrl: "/images/asking.png",
      imageWidth: 180,
      imageHeight: 180,
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: "Add & Practice",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      const added = await addCourseIfNeeded();

      if (added) {
        Swal.fire({
          title: "Course Added!",
          text: "Added to My Courses successfully.",
          imageUrl: "/images/success.png",
          imageWidth: 170,
          imageHeight: 170,
          timer: 1200,
          showConfirmButton: false,
        });

        setOpenModes(true);
      }
    });
  };

  const handleLogout = () => {
    Swal.fire({
      title: "Logout?",
      text: "Are you sure you want to logout?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#8d6cab",
      cancelButtonColor: "#b0b0b0",
      confirmButtonText: "Yes, Logout",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      customClass: {
        popup: styles.logoutPopup,
        title: styles.logoutTitle,
        htmlContainer: styles.logoutText,
        confirmButton: styles.logoutConfirm,
        cancelButton: styles.logoutCancel,
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      try {
        await fetch(`${API_BASE}/logout.php`, {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.error("Logout API error:", err);
      }

      localStorage.removeItem("username");
      localStorage.removeItem("user_email");
      localStorage.removeItem("user_id");
      localStorage.removeItem("profile_image");

      sessionStorage.clear();

      navigate("/login", { replace: true });
    });
  };

  const handleShare = async () => {
    const lessonLink = `${window.location.origin}/introduction/${lessonId}`;

    try {
      await navigator.clipboard.writeText(lessonLink);

      toast.success("Lesson link copied!", {
        className: styles.toastSuccess,
        progressClassName: styles.toastSuccessProgress,
        icon: <i className="bx bx-check-circle"></i>,
      });
    } catch (error) {
      console.error("Failed to copy link:", error);

      toast.error("Unable to copy the lesson link.", {
        className: styles.toastError,
        progressClassName: styles.toastErrorProgress,
        icon: <i className="bx bx-error-circle"></i>,
      });
    }
  };

  const openCourse = (courseId) => {
    navigate(`/introduction/${courseId}`);
  };

  const savedQuizResults =
    JSON.parse(readAccountQuizResult("lessonQuizResults")) || null;

  const correctQuestions =
    savedQuizResults?.lessonId === Number(lessonId)
      ? savedQuizResults.answers.filter((item) => item.isCorrect)
      : [];

  const filteredQuizzes = useMemo(() => {
    const q = search.trim().toLowerCase();

    return quizzes.filter((quiz) => {
      const searchableText = [
        quiz.question,
        quiz.answer,
        quiz.correct_answer,
        quiz.explanation,
        ...(Array.isArray(quiz.options) ? quiz.options : []),
      ]
        .join(" ")
        .toLowerCase();

      return !q || searchableText.includes(q);
    });
  }, [quizzes, search]);

  const memorizedCards = useMemo(() => {
    const q = search.trim().toLowerCase();

    return correctQuestions.filter((item) => {
      const searchableText = [
        item.question,
        item.answer,
        item.correctAnswer,
        item.correct_answer,
      ]
        .join(" ")
        .toLowerCase();

      return !q || searchableText.includes(q);
    });
  }, [correctQuestions, search]);

  const notMemorizedCards = useMemo(() => {
    return filteredQuizzes.filter(
      (quiz) =>
        !correctQuestions.some((item) => item.question === quiz.question),
    );
  }, [filteredQuizzes, correctQuestions]);

  if (loading) {
    return <LoadingState />;
  }
  if (!lesson) {
    return <div style={{ padding: "40px" }}>Lesson not found.</div>;
  }

  return (
    <div
      className={`${styles.container} ${
        isCollapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <UserSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        myDecks={myDecks}
        courses={courses}
        openCourse={openCourse}
        getDeckId={getDeckId}
      />

      <div className={styles.mainArea}>
        <UserHeader
          isCollapsed={isCollapsed}
          searchQuery={search}
          setSearchQuery={setSearch}
          handleSearchSubmit={(e) => e.preventDefault()}
          notificationOpen={notificationOpen}
          setNotificationOpen={setNotificationOpen}
          setDropdownOpen={setProfileDropdownOpen}
          notificationCount={notificationCount}
          notifications={notifications}
          markNotificationsAsRead={markNotificationsAsRead}
          user={user}
          profileDropdownOpen={profileDropdownOpen}
          setProfileDropdownOpen={setProfileDropdownOpen}
          handleLogout={handleLogout}
        />

        <main className={styles.mainContent}>
          <div className={styles.cardsContainer}>
            <div className={styles.leftcont}>
              <div className={styles.courses}>
                <div className={styles.courseHead}></div>

                <div className={styles.innercourse}>
                  <div className={styles.innerhead}>
                    <div className={styles.titleRow}>
                      <h1 className={styles.lessonTitle}>{lesson.title}</h1>

                      <button
                        type="button"
                        className={styles.shareBtn}
                        onClick={handleShare}
                        title="Copy lesson link"
                      >
                        <i className="bx bx-share-alt"></i>
                      </button>
                    </div>

                    <div className={styles.cardCount}>
                      {quizzes.length} Cards
                    </div>
                  </div>

                  <div className={styles.description}>
                    <h3>Description</h3>
                    <p>{lesson.description}</p>
                  </div>

                  <div className={styles.innerfoot}>
                    <h3>
                      Created by Puffybrain
                      <span
                        className={`${styles.statusDot} ${styles.public}`}
                        title="Public"
                      />
                      <span className={styles.statusText}>Public</span>
                    </h3>
                  </div>
                </div>
              </div>

              <div className={styles.studyProgress}>
                <div className={styles.ProgressHead}></div>

                <div className={styles.innerProgress}>
                  <h1>Study Progress</h1>

                  <div className={styles.progressBarContainer}>
                    <div
                      className={styles.progressBar}
                      style={{ width: `${progress.progress_percent}%` }}
                    />
                  </div>

                  <div className={styles.progressPercent}>
                    {Math.round(progress.progress_percent)}%
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.rightcol}>
              <div className={styles.cards}>
                <div className={styles.cardHead}>
                  <div className={styles.cardButtons}>
                    <button
                      className={`${styles.btn} ${styles.studyBtn}`}
                      onClick={handleStudy}
                    >
                      Study
                    </button>

                    <button
                      className={`${styles.btn} ${styles.practiceBtn}`}
                      onClick={handlePractice}
                    >
                      Practice
                    </button>
                  </div>
                </div>

                {openModes && (
                  <QuizModesModal
                    source="lesson"
                    lessonId={lessonId}
                    quizzes={quizzes}
                    onClose={() => setOpenModes(false)}
                  />
                )}

                <div className={styles.innercardHead}>
                  <button
                    className={`${styles.tabBtn} ${
                      activeTab === "tab1" ? styles.activeTab : ""
                    }`}
                    onClick={() => setActiveTab("tab1")}
                  >
                    All Cards
                  </button>

                  <button
                    className={`${styles.tabBtn} ${
                      activeTab === "tab2" ? styles.activeTab : ""
                    }`}
                    onClick={() => setActiveTab("tab2")}
                  >
                    Not Memorized
                  </button>

                  <button
                    className={`${styles.tabBtn} ${
                      activeTab === "tab3" ? styles.activeTab : ""
                    }`}
                    onClick={() => setActiveTab("tab3")}
                  >
                    Memorized
                  </button>
                </div>

                <div className={styles.cardContent}>
                  {activeTab === "tab1" && (
                    <div className={styles.tabBoxes}>
                      {filteredQuizzes.length === 0 ? (
                        <div className={styles.emptyState}>
                          <img
                            src="/images/cute1.png"
                            alt="No cards"
                            className={styles.emptyImage}
                          />
                          <p>
                            {search.trim()
                              ? `No cards found for “${search}”.`
                              : "No cards available yet."}
                          </p>
                        </div>
                      ) : (
                        filteredQuizzes.map((quiz, index) => (
                          <div key={index} className={styles.box}>
                            <p className={styles.question}>{quiz.question}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === "tab2" && (
                    <div className={styles.tabBoxes}>
                      {filteredQuizzes.length === 0 ? (
                        <div className={styles.emptyState}>
                          <img
                            src="/images/cute1.png"
                            alt="No cards"
                            className={styles.emptyImage}
                          />
                          <p>
                            {search.trim()
                              ? `No not memorized cards found for “${search}”.`
                              : "No cards to memorize yet."}
                          </p>
                        </div>
                      ) : notMemorizedCards.length === 0 ? (
                        <div className={styles.emptyState}>
                          <img
                            src="/images/celeb.png"
                            alt="All memorized"
                            className={styles.emptyImage}
                          />
                          <p>Congratulation! You memorized all cards 🎉</p>
                        </div>
                      ) : (
                        notMemorizedCards.map((quiz, index) => (
                          <div key={index} className={styles.box}>
                            <p className={styles.question}>{quiz.question}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === "tab3" && (
                    <div className={styles.tabBoxes}>
                      {memorizedCards.length === 0 ? (
                        <div className={styles.emptyState}>
                          <img
                            src="/images/cute1.png"
                            alt="No memorized cards"
                            className={styles.emptyImage}
                          />
                          <p>
                            {search.trim()
                              ? `No memorized cards found for “${search}”.`
                              : "No memorized cards yet."}
                          </p>
                        </div>
                      ) : (
                        memorizedCards.map((quiz, index) => (
                          <div key={index} className={styles.box}>
                            <p className={styles.question}>{quiz.question}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default LearningModule;
