import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  requiresPasswordChange,
  requiresProfessorTutorial,
  requiresStudentTutorial,
} from "../utils/passwordPolicy.js";
import {
  getProfessorTutorialStep,
  professorTutorialStepPath,
  professorTutorialSteps,
} from "../pages/professor/tutorial/professorTutorialSteps.js";
import StudentTutorial from "../pages/student/tutorial/StudentTutorial.jsx";
import {
  getStudentSetupRedirect,
  getTutorialStep,
} from "../pages/student/tutorial/studentTutorialSteps.js";
import {
  APP_ROLES,
  getHomePathForRole,
  getUserRole,
  isProfessorApprovalRestricted,
} from "../utils/roles.js";

const studentOnlyPrefixes = [
  "/learning",
  "/introduction",
  "/lesson",
  "/review",
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
];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("puffy-user") || "null");
  } catch {
    return null;
  }
}

function getStoredToken() {
  return (
    localStorage.getItem("puffy-token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function getTokenUser(token) {
  if (!token) {
    return null;
  }

  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );

    return JSON.parse(atob(paddedPayload));
  } catch {
    return null;
  }
}

function isTemporaryExpired(user) {
  const isTemporary =
    user?.isTemporary === true ||
    user?.is_temporary === 1 ||
    user?.is_temporary === true;
  const expiresAt = user?.temporaryExpiresAt || user?.temporary_expires_at;

  if (!isTemporary || !expiresAt) return false;

  const date = new Date(expiresAt);
  return !Number.isNaN(date.getTime()) && date <= new Date();
}

function clearStoredAuth() {
  localStorage.removeItem("puffy-token");
  localStorage.removeItem("token");
  localStorage.removeItem("authToken");
  localStorage.removeItem("puffy-user");
  localStorage.removeItem("user");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("user_id");
  localStorage.removeItem("user_email");
  localStorage.removeItem("email");
  localStorage.removeItem("user_role");
  localStorage.removeItem("username");
  localStorage.removeItem("year_level");
  localStorage.removeItem("section_name");
  localStorage.removeItem("admin");
  localStorage.removeItem("admin_id");
  localStorage.removeItem("admin_email");
  localStorage.removeItem("admin_username");
  localStorage.removeItem("school_name");
}

export default function ProtectedRoute() {
  const { user } = useAuth();
  const token = getStoredToken();
  const tokenUser = getTokenUser(token);
  const storedUser = getStoredUser();
  const currentUser = user || storedUser || tokenUser;
  const location = useLocation();
  const role = getUserRole(tokenUser) || getUserRole(currentUser);
  const pathname = location.pathname;

  if (!token || !currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (tokenUser?.exp && tokenUser.exp * 1000 <= Date.now()) {
    clearStoredAuth();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isTemporaryExpired(currentUser)) {
    clearStoredAuth();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!role) {
    clearStoredAuth();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role === APP_ROLES.PROFESSOR) {
    const professorUser =
      [user, storedUser, tokenUser].find(
        (candidate) => getUserRole(candidate) === APP_ROLES.PROFESSOR,
      ) || currentUser;

    if (isProfessorApprovalRestricted(professorUser)) {
      clearStoredAuth();
      return (
        <Navigate
          to="/login"
          replace
          state={{
            from: location,
            professorApprovalRequired: true,
          }}
        />
      );
    }
  }

  if (pathname.startsWith("/super-admin") && role !== APP_ROLES.SUPER_ADMIN) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  if (pathname.startsWith("/admin") && role !== APP_ROLES.ADMIN) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  if (pathname.startsWith("/professor") && role !== APP_ROLES.PROFESSOR) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  if (pathname.startsWith("/student") && role !== APP_ROLES.STUDENT) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  if (
    studentOnlyPrefixes.some((prefix) => pathname.startsWith(prefix)) &&
    role !== APP_ROLES.STUDENT
  ) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  const professorTutorial =
    role === APP_ROLES.PROFESSOR && requiresProfessorTutorial(currentUser);
  const professorStep =
    role === APP_ROLES.PROFESSOR ? getProfessorTutorialStep(location) : null;
  if (professorTutorial && pathname.startsWith("/professor") && !professorStep) {
    return <Navigate to={professorTutorialStepPath(professorTutorialSteps[0])} replace />;
  }

  if (
    role === APP_ROLES.ADMIN &&
    requiresPasswordChange(currentUser) &&
    !(professorTutorial && professorStep) &&
    pathname.replace(/\/+$/, "").toLowerCase() !== `/${role}/settings`
  ) {
    return <Navigate to={`/${role}/settings`} replace />;
  }
  if (professorStep && !professorTutorial) {
    return <Navigate to={professorStep.path} replace />;
  }

  if (role === APP_ROLES.STUDENT) {
    const setupRedirect = getStudentSetupRedirect(currentUser, location);
    if (setupRedirect) return <Navigate to={setupRedirect} replace />;

    const tutorialStep = getTutorialStep(location);
    if (tutorialStep) {
      return requiresStudentTutorial(currentUser) ? (
        <StudentTutorial step={tutorialStep}><Outlet /></StudentTutorial>
      ) : (
        <Navigate to={tutorialStep.fallbackPath ?? pathname} replace />
      );
    }
  }

  return <Outlet />;
}
