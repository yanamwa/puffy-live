import AcademicCalendarPage from "../pages/admin/AcademicCalendarPage.jsx";
import QuizManagement from "../pages/professor/quizmanagement/QuizManagement.jsx";
import AboutUs from "../pages/unauth/about/Aboutus.jsx";
import FAQ from "../pages/unauth/faq/faq.jsx";
import ContactUs from "../pages/unauth/ContactUs/ContactUs.jsx";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import LandingPage from "../LandingPage";

import LoginPage from "../pages/auth/LoginPage";
import SignupPage from "../pages/auth/SignupPage";
import ForgotPasswordPage from "../pages/auth/Forgotpassword";
import ChangePasswordPage from "../pages/auth/Changepassword";
import OtpPage from "../pages/auth/Otp";
import RecoverAccountPage from "../pages/auth/RecoverAccount";

import AdminLayout from "../pages/admin/shared/AdminLayout";
import DashboardPage from "../pages/admin/dashboard/DashboardPage";
import UserManagementPage from "../pages/admin/users/UserManagementPage";
import CourseManagementPage from "../pages/admin/modules/CourseManagementPage.jsx";
import NotificationPage from "../pages/admin/notification/NotificationPage";
import DecksPage from "../pages/admin/decks/DecksPage";
import ReportsPage from "../pages/admin/reports/ReportsPage";
import AdminAccountPage from "../pages/admin/settings/AdminAccountPage";
import SettingsPage from "../pages/admin/settings/SettingsPage";

import SuperAdminHome from "../pages/superadmin/SuperAdminHome";
import SuperAdminLayout from "../pages/superadmin/shared/SuperAdminLayout";
import SuperAdminUserManagementPage from "../pages/superadmin/users/SuperAdminUserManagementPage";
import SuperAdminBackupPage from "../pages/superadmin/backup/SuperAdminBackupPage";
import SuperAdminSystemAnalytics from "../pages/superadmin/analytics/SuperAdminSystemAnalytics";
import SuperAdminAuditLogs from "../pages/superadmin/audit/SuperAdminAuditLogs";
import SuperAdminSystemSettings from "../pages/superadmin/settings/SuperAdminSystemSettings";
import SuperAdminProfile from "../pages/superadmin/profile/SuperAdminProfile";
import SuperAdminModesManagement from "../pages/superadmin/modes/SuperAdminModesManagement";

import ProfessorHome from "../pages/professor/home/ProfessorHome.jsx";
import ProfessorLayout from "../pages/professor/layout/ProfessorLayout.jsx";
import ProfessorFeaturePage from "../pages/professor/ProfessorFeaturePage";
import ModuleManagement from "../pages/professor/coursemanagement/modulemanagement";
import AddModule from "../pages/professor/coursemanagement/AddModule";
import CourseModuleEditor from "../pages/professor/coursemanagement/CourseModuleEditor";
import ProfessorNotifications from "../pages/professor/settings/ProfessorNotifications.jsx";
import ProfessorProfile from "../pages/professor/settings/ProfessorProfile.jsx";
import ProfessorSetting from "../pages/professor/settings/ProfessorSetting.jsx";
import CourseView from "../pages/professor/coursemanagement/courseview";
import AssessmentAnalysis from "../pages/professor/analysis/AssessmentAnalysis.jsx";
import AssessmentDetail from "../pages/professor/analysis/AssessmentDetail.jsx";

import StudentHome from "../pages/student/home/StudentHome.jsx";
import EnrolledCourses from "../pages/student/enrolled/EnrolledCourses.jsx";
import PublicCourses from "../pages/student/public/PublicCourses.jsx";
import ArchivedCourses from "../pages/student/archived/ArchivedCourses.jsx";
import StudentSettings from "../pages/student/settings/StudentSettings.jsx";
import StudentCourseDetail from "../pages/student/courses/StudentCourseDetail.jsx";
import StudentModuleQuizPage from "../pages/student/courses/StudentModuleQuizPage.jsx";
import StudentJoinCourse from "../pages/student/courses/StudentJoinCourse.jsx";
import StudentProfile from "../pages/student/settings/StudentProfile.jsx";
import StudentNotifications from "../pages/student/home/StudentNotifications.jsx";

import Introduction from "../pages/course/Introduction";
import Lesson from "../pages/course/Lesson";
import LessonResult from "../pages/course/LessonResult";

import FlashcardsTutorial from "../pages/quizzes/inQuiz/tutorials/flashcards-tutorial";
import MatchingTutorial from "../pages/quizzes/inQuiz/tutorials/matching-tutorial";
import MultipleChoiceTutorial from "../pages/quizzes/inQuiz/tutorials/multipleChoice-Tutorial";
import QandATutorial from "../pages/quizzes/inQuiz/tutorials/QandA-tutorial";
import RandomModesTutorial from "../pages/quizzes/inQuiz/tutorials/randommodes";
import TimedQuizTutorial from "../pages/quizzes/inQuiz/tutorials/timedquiz-tutorial";
import FlashcardQuiz from "../pages/quizzes/inQuiz/inQuiz/realFlashcard";
import MatchingQuiz from "../pages/quizzes/inQuiz/inQuiz/matching";
import MultipleChoiceQuiz from "../pages/quizzes/inQuiz/inQuiz/multiplechoice";
import QandAQuiz from "../pages/quizzes/inQuiz/inQuiz/qanda";
import MixedModeQuiz from "../pages/quizzes/inQuiz/inQuiz/randommodes";
import TimedQuiz from "../pages/quizzes/inQuiz/inQuiz/timedinquiz";

function LearningRedirect() {
  const { lessonId } = useParams();
  return <Navigate to={`/introduction/${lessonId}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        {/* ==========================
            PUBLIC ROUTES (Guest)
        ========================== */}
        <Route path="/about" element={<AboutUs />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/otp" element={<OtpPage />} />
        <Route path="/recover-account" element={<RecoverAccountPage />} />

        {/* ==========================
            APP ROUTES
        ========================== */}
        <Route element={<ProtectedRoute />}>
          {/* ==========================
            SUPER ADMIN
        ========================== */}
          <Route
            path="/super-admin"
            element={
              <SuperAdminLayout>
                <SuperAdminHome />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/dashboard"
            element={
              <SuperAdminLayout>
                <SuperAdminHome />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/users"
            element={
              <SuperAdminLayout>
                <SuperAdminUserManagementPage />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/analytics"
            element={
              <SuperAdminLayout>
                <SuperAdminSystemAnalytics />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/academic-calendar"
            element={
              <SuperAdminLayout>
                <AcademicCalendarPage />
              </SuperAdminLayout>
            }
          />
          <Route
            path="/admin/academic-calendar"
            element={
              <AdminLayout>
                <AcademicCalendarPage />
              </AdminLayout>
            }
          />
          <Route
            path="/super-admin/courses"
            element={
              <SuperAdminLayout>
                <CourseManagementPage />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/announcements"
            element={
              <SuperAdminLayout>
                <NotificationPage variant="announcement" />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/audit-logs"
            element={
              <SuperAdminLayout>
                <SuperAdminAuditLogs />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/archives"
            element={<Navigate to="/super-admin/users" replace />}
          />

          <Route
            path="/super-admin/profile"
            element={
              <SuperAdminLayout>
                <SuperAdminProfile />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/backup"
            element={
              <SuperAdminLayout>
                <SuperAdminBackupPage />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/security"
            element={<Navigate to="/super-admin/settings" replace />}
          />

          <Route
            path="/super-admin/settings"
            element={
              <SuperAdminLayout>
                <SuperAdminSystemSettings />
              </SuperAdminLayout>
            }
          />

          <Route
            path="/super-admin/modes"
            element={
              <SuperAdminLayout>
                <SuperAdminModesManagement />
              </SuperAdminLayout>
            }
          />

          {/* ==========================
              ADMIN
          ========================== */}
          <Route
            path="/admin"
            element={<Navigate to="/admin/dashboard" replace />}
          />

          <Route
            path="/admin/dashboard"
            element={
              <AdminLayout>
                <DashboardPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/users"
            element={
              <AdminLayout>
                <UserManagementPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/courses"
            element={
              <AdminLayout>
                <CourseManagementPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/reports"
            element={
              <AdminLayout>
                <ReportsPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/modules"
            element={<Navigate to="/admin/courses" replace />}
          />

          <Route
            path="/admin/profile"
            element={
              <AdminLayout>
                <AdminAccountPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/settings"
            element={
              <AdminLayout>
                <SettingsPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/notification"
            element={
              <AdminLayout>
                <NotificationPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/mode"
            element={<Navigate to="/admin/dashboard" replace />}
          />

          <Route
            path="/admin/modes"
            element={<Navigate to="/admin/dashboard" replace />}
          />

          <Route
            path="/admin/decks"
            element={
              <AdminLayout>
                <DecksPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/backup"
            element={<Navigate to="/admin/dashboard" replace />}
          />

          {/* ==========================
              PROFESSOR
          ========================== */}
          <Route path="/professor" element={<ProfessorLayout />}>
            <Route
              index
              element={<Navigate to="/professor/dashboard" replace />}
            />
            <Route path="dashboard" element={<ProfessorHome />} />
            <Route path="courses" element={<ModuleManagement />} />
            <Route path="quizzes" element={<QuizManagement />} />
            <Route
              path="quizzes/:id/modules/:moduleId"
              element={<CourseModuleEditor quizManagement />}
            />
            <Route
              path="quizzes/:id/modules/:moduleId/:assessmentType/edit"
              element={<CourseModuleEditor quizManagement />}
            />
            <Route path="courses/new" element={<AddModule />} />
            <Route
              path="courses/new/modules/:moduleId/edit"
              element={<CourseModuleEditor />}
            />
            <Route
              path="courses/new/modules/:moduleId/:assessmentType/edit"
              element={<CourseModuleEditor />}
            />
            <Route path="courses/edit/:id" element={<AddModule />} />
            <Route
              path="courses/edit/:id/modules/:moduleId/edit"
              element={<CourseModuleEditor />}
            />
            <Route
              path="courses/edit/:id/modules/:moduleId/:assessmentType/edit"
              element={<CourseModuleEditor />}
            />
            <Route path="students" element={<AssessmentAnalysis />} />
            <Route path="assessment/:courseId" element={<AssessmentDetail />} />
            <Route path="notifications" element={<ProfessorNotifications />} />
            <Route path="profile" element={<ProfessorProfile />} />
            <Route
              path="change-password"
              element={
                <ProfessorFeaturePage path="/professor/change-password" />
              }
            />
            <Route path="settings" element={<ProfessorSetting />} />
            <Route path="courses/view/:courseId" element={<CourseView />} />
          </Route>

          {/* ==========================
              STUDENT
          ========================== */}
          <Route path="/student" element={<StudentHome />} />

          <Route
            path="/student/enrolled-courses"
            element={<EnrolledCourses />}
          />

          <Route
            path="/student/enrolled-courses/:courseId"
            element={<StudentCourseDetail />}
          />

          <Route
            path="/student/enrolled-courses/:courseId/quiz/:quizType/:moduleId"
            element={<StudentModuleQuizPage />}
          />

          <Route path="/student/join" element={<StudentJoinCourse />} />

          <Route path="/student/public-courses" element={<PublicCourses />} />

          <Route
            path="/student/archived-courses"
            element={<ArchivedCourses />}
          />

          <Route path="/student/settings" element={<StudentSettings />} />

          <Route path="/student/profile" element={<StudentProfile />} />

          <Route
            path="/student/notifications"
            element={<StudentNotifications />}
          />

          {/* ==========================
              COURSE STUDY FLOW
          ========================== */}
          <Route path="/learning/:lessonId" element={<LearningRedirect />} />
          <Route path="/introduction/:lessonId" element={<Introduction />} />
          <Route path="/lesson/:lessonId" element={<Lesson />} />
          <Route path="/review/deck/:deckId" element={<LessonResult />} />
          <Route path="/review/:lessonId" element={<LessonResult />} />

          {/* ==========================
              QUIZ MODE TUTORIALS
          ========================== */}
          <Route path="/flashcards-tutorial" element={<FlashcardsTutorial />} />
          <Route
            path="/flashcards-tutorial/lesson/:lessonId"
            element={<FlashcardsTutorial />}
          />
          <Route
            path="/flashcards-tutorial/deck/:deckId"
            element={<FlashcardsTutorial />}
          />
          <Route path="/QandA-tutorial" element={<QandATutorial />} />
          <Route
            path="/QandA-tutorial/lesson/:lessonId"
            element={<QandATutorial />}
          />
          <Route
            path="/QandA-tutorial/deck/:deckId"
            element={<QandATutorial />}
          />
          <Route path="/qna-tutorial" element={<QandATutorial />} />
          <Route
            path="/qna-tutorial/lesson/:lessonId"
            element={<QandATutorial />}
          />
          <Route
            path="/qna-tutorial/deck/:deckId"
            element={<QandATutorial />}
          />
          <Route
            path="/multipleChoice-tutorial"
            element={<MultipleChoiceTutorial />}
          />
          <Route
            path="/multipleChoice-tutorial/lesson/:lessonId"
            element={<MultipleChoiceTutorial />}
          />
          <Route
            path="/multipleChoice-tutorial/deck/:deckId"
            element={<MultipleChoiceTutorial />}
          />
          <Route
            path="/multiple-choice-tutorial"
            element={<MultipleChoiceTutorial />}
          />
          <Route
            path="/multiple-choice-tutorial/lesson/:lessonId"
            element={<MultipleChoiceTutorial />}
          />
          <Route
            path="/multiple-choice-tutorial/deck/:deckId"
            element={<MultipleChoiceTutorial />}
          />
          <Route path="/Matching-tutorial" element={<MatchingTutorial />} />
          <Route
            path="/Matching-tutorial/lesson/:lessonId"
            element={<MatchingTutorial />}
          />
          <Route
            path="/Matching-tutorial/deck/:deckId"
            element={<MatchingTutorial />}
          />
          <Route path="/matching-tutorial" element={<MatchingTutorial />} />
          <Route
            path="/matching-tutorial/lesson/:lessonId"
            element={<MatchingTutorial />}
          />
          <Route
            path="/matching-tutorial/deck/:deckId"
            element={<MatchingTutorial />}
          />
          <Route path="/timedquiz-tutorial" element={<TimedQuizTutorial />} />
          <Route
            path="/timedquiz-tutorial/lesson/:lessonId"
            element={<TimedQuizTutorial />}
          />
          <Route
            path="/timedquiz-tutorial/deck/:deckId"
            element={<TimedQuizTutorial />}
          />
          <Route
            path="/random-modes-tutorial"
            element={<RandomModesTutorial />}
          />
          <Route
            path="/random-modes-tutorial/lesson/:lessonId"
            element={<RandomModesTutorial />}
          />
          <Route
            path="/random-modes-tutorial/deck/:deckId"
            element={<RandomModesTutorial />}
          />
          <Route
            path="/mixed-mode-tutorial"
            element={<RandomModesTutorial />}
          />
          <Route
            path="/mixed-mode-tutorial/lesson/:lessonId"
            element={<RandomModesTutorial />}
          />
          <Route
            path="/mixed-mode-tutorial/deck/:deckId"
            element={<RandomModesTutorial />}
          />

          {/* ==========================
              QUIZ MODE PLAYERS
          ========================== */}
          <Route
            path="/flashcard/lesson/:lessonId"
            element={<FlashcardQuiz />}
          />
          <Route path="/flashcard/deck/:deckId" element={<FlashcardQuiz />} />
          <Route path="/qna/lesson/:lessonId" element={<QandAQuiz />} />
          <Route path="/qna/deck/:deckId" element={<QandAQuiz />} />
          <Route
            path="/multiple-choice/lesson/:lessonId"
            element={<MultipleChoiceQuiz />}
          />
          <Route
            path="/multiple-choice/deck/:deckId"
            element={<MultipleChoiceQuiz />}
          />
          <Route
            path="/matching-type/lesson/:lessonId"
            element={<MatchingQuiz />}
          />
          <Route
            path="/matching-type/deck/:deckId"
            element={<MatchingQuiz />}
          />
          <Route path="/timedquiz/lesson/:lessonId" element={<TimedQuiz />} />
          <Route path="/timedquiz/deck/:deckId" element={<TimedQuiz />} />
          <Route
            path="/mixed-mode/lesson/:lessonId"
            element={<MixedModeQuiz />}
          />
          <Route path="/mixed-mode/deck/:deckId" element={<MixedModeQuiz />} />
          <Route
            path="/random-modes/lesson/:lessonId"
            element={<MixedModeQuiz />}
          />
          <Route
            path="/random-modes/deck/:deckId"
            element={<MixedModeQuiz />}
          />
          <Route
            path="/survival/lesson/:lessonId"
            element={<MixedModeQuiz />}
          />
          <Route path="/survival/deck/:deckId" element={<MixedModeQuiz />} />
        </Route>

        {/* ==========================
            DEFAULT ROUTE
        ========================== */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
