import {
  requiresStudentPasswordChange,
  requiresStudentTutorial,
} from "../../../utils/passwordPolicy.js";
import { tutorialEnrolledCourseDetail } from "./studentTutorialExamples.js";

const home = "/student";
const enrolledCoursesPath = "/student/enrolled-courses";
const exampleCoursePath = `${enrolledCoursesPath}/${tutorialEnrolledCourseDetail.id}`;
export const STUDENT_SETTINGS_PATH = "/student/settings";

export const tutorialSteps = [
  {
    id: "welcome",
    path: home,
    target: '[data-tutorial="welcome"]',
    title: "Welcome to PuffyBrain!",
    description:
      "Take a quick tour of your student dashboard. Use Next and Previous to move through the tour. You can skip to account setup at any time.",
  },
  {
    id: "quizzes",
    path: home,
    target: '[data-tutorial="quizzes"]',
    title: "Continue your quizzes",
    description:
      "Pick a course here to return to its learning modules and continue practicing.",
  },
  {
    id: "results",
    path: home,
    target: ".home-recent-quiz-results",
    title: "Recent Main Quiz results",
    description:
      "Check scores and see whether you passed your most recent Main Quizzes.",
  },
  {
    id: "calendar",
    path: home,
    target: ".home-mini-calendar",
    title: "Academic calendar",
    description:
      "Select a day to see events and deadlines from the academic calendar.",
  },
  {
    id: "enrolled",
    path: enrolledCoursesPath,
    target: `[data-tutorial="enrolled"] a[href="${exampleCoursePath}"]`,
    title: "Enrolled Courses",
    description:
      "Your enrolled courses appear here. Select Next to see the lessons and quizzes inside the highlighted course.",
  },
  {
    id: "enrolled-course",
    numberedStep: "enrolled",
    path: exampleCoursePath,
    fallbackPath: enrolledCoursesPath,
    target: '[data-tutorial="course-modules"] .student-module-row',
    title: `Inside ${tutorialEnrolledCourseDetail.title}`,
    description:
      "Use Continue to read, Practice to review, and Main Quiz to take the assessment. Finish reading to unlock the next module.",
  },
  {
    id: "public",
    path: "/student/public-courses",
    target: '[data-tutorial="public"] > :first-child',
    title: "Public Courses",
    description:
      "Browse courses and select Enroll to send a request to the professor. These cards are examples for the tour.",
  },
  {
    id: "archived",
    path: "/student/archived-courses",
    target: '[data-tutorial="archived"] > :first-child',
    title: "Archived Classes",
    description:
      "Find past classes here. The View only label shows that an archived class is read-only.",
  },
  {
    id: "settings",
    path: STUDENT_SETTINGS_PATH,
    target: '[data-tutorial="password"]',
    title: "Account Settings",
    description:
      "Use Settings to manage your password. Finish the tutorial to open your account settings.",
  },
];

export function tutorialStepPath(step) {
  return `${step.path}?tutorial=${step.id}`;
}

export function getTutorialStep({ pathname, search }) {
  const stepId = new URLSearchParams(search).get("tutorial");
  return tutorialSteps.find(
    (step) => step.id === stepId && step.path === pathname,
  );
}

export function getStudentSetupPath(user) {
  if (requiresStudentTutorial(user)) return tutorialStepPath(tutorialSteps[0]);
  if (requiresStudentPasswordChange(user)) return STUDENT_SETTINGS_PATH;
  return null;
}

export function getStudentSetupRedirect(user, location) {
  const path = getStudentSetupPath(user);
  if (!path) return null;
  if (requiresStudentTutorial(user))
    return getTutorialStep(location) ? null : path;
  return location.pathname === path ? null : path;
}
