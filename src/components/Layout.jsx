import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getStudentSetupRedirect } from "../pages/student/tutorial/studentTutorialSteps.js";
import LoadingState from "./LoadingState.jsx";

export default function Layout() {
  const location = useLocation();
  const { user, checkingStudentSession } = useAuth();

  if (checkingStudentSession) {
    return <LoadingState message="Checking your session…" />;
  }

  const setupRedirect = getStudentSetupRedirect(user, location);
  if (setupRedirect) return <Navigate to={setupRedirect} replace />;

  const isAuthPage = [
    "/",
    "/about",
    "/faq",
    "/contact",
    "/login",
    "/signup",
    "/forgot",
    "/change-password",
    "/forgot-username",
    "/cant-signin",
    "/otp",
    "/recover-account",
  ].includes(location.pathname);

  const isStudentDashboard = location.pathname.startsWith("/student");

  const isSuperAdminArea = location.pathname.startsWith("/super-admin");

  const isAdminArea = location.pathname.startsWith("/admin");

  const isProfessorArea = location.pathname.startsWith("/professor");

  const isCourseArea = [
    "/learning",
    "/introduction",
    "/lesson",
    "/review",
  ].some((path) => location.pathname.startsWith(path));

  const isQuizArea = [
    "/flashcards-tutorial",
    "/QandA-tutorial",
    "/qna-tutorial",
    "/multipleChoice-tutorial",
    "/multiple-choice-tutorial",
    "/Matching-tutorial",
    "/matching-tutorial",
    "/timedquiz-tutorial",
    "/random-modes-tutorial",
    "/mixed-mode-tutorial",
    "/flashcard",
    "/qna",
    "/multiple-choice",
    "/matching-type",
    "/timedquiz",
    "/mixed-mode",
    "/random-modes",
    "/survival",
  ].some((path) => location.pathname.startsWith(path));

  if (
    isAuthPage ||
    isStudentDashboard ||
    isSuperAdminArea ||
    isAdminArea ||
    isProfessorArea ||
    isCourseArea ||
    isQuizArea
  ) {
    return <Outlet />;
  }

  return (
    <div className="app-shell">
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
