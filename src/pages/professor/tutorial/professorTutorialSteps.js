export const PROFESSOR_SETTINGS_PATH = "/professor/settings";

const tutorialModulePath =
  "/professor/courses/new/modules/tutorial-module/edit";
const tutorialQuizEditorPath =
  "/professor/quizzes/tutorial-course/modules/tutorial-module/main-quiz/edit";
const tutorialAssessmentPath = "/professor/assessment/tutorial-course";

export const professorTutorialSteps = [
  {
    id: "dashboard",
    path: "/professor/dashboard",
    target: ".professor-content .professor-dashboard",
    panelAnchor: ".professor-content .dashboard-welcome",
    preferSidebar: true,
    title: "Professor Dashboard",
    description:
      "See your active courses, student totals, published quizzes, and recent activity. Use Next and Previous to move through the tour.",
  },
  {
    id: "courses",
    path: "/professor/courses",
    target: '[data-tutorial="professor-course-management"]',
    panelAnchor: ".professor-content .professor-section-heading",
    preferSidebar: true,
    allowPreviewScroll: true,
    title: "Course Management",
    description:
      "This full course area includes the Add new course button, course search, Active and Archived views, and sample course cards. Use Add new course to begin building a class.",
  },
  {
    id: "add-course",
    path: "/professor/courses/new",
    target: '[data-tutorial="course-catalog"]',
    allowPreviewScroll: true,
    title: "Choose from the Course Catalog",
    description:
      "The catalog lists available official courses. Choose one to fill in its course details; the class join code is generated automatically.",
  },
  {
    id: "course-modules",
    path: "/professor/courses/new",
    target: '[data-tutorial="course-builder-modules"]',
    allowPreviewScroll: true,
    title: "Add Course Modules",
    description:
      "Modules divide a course into teachable units. Each module can have objectives, lesson pages, a practice quiz, and a Main Quiz. The sample modules show how pages and quiz items are counted.",
  },
  {
    id: "generate-module",
    path: tutorialModulePath,
    target: '[data-tutorial="generate-module-button"]',
    title: "Generate a Module",
    description:
      "Generate Module opens the material organizer. Add reference files and PuffyBrain can draft a module with lesson pages for you to review. You can also enter the module details yourself.",
  },
  {
    id: "add-page",
    path: tutorialModulePath,
    target: '[data-tutorial="module-lesson-pages"]',
    allowPreviewScroll: true,
    title: "Add Lesson Pages",
    description:
      "Add Page creates a page inside this module. Give it a title and lesson content; use the page tabs to review each page. The example page shows how a finished lesson appears.",
  },
  {
    id: "quiz-management",
    path: "/professor/quizzes",
    target: '[data-tutorial="quiz-management-courses"]',
    title: "Quiz Management",
    description:
      "Choose a course to see its modules and edit each module’s Main Quiz. Practice quizzes are created for students from lesson content; the Main Quiz is the assessment you manage here.",
  },
  {
    id: "quiz-module",
    path: "/professor/quizzes",
    query: "course=tutorial-course",
    target: '[data-tutorial="quiz-management-main-quiz"]',
    title: "Open a Module Main Quiz",
    description:
      "Choose Module 1’s Main Quiz folder or Edit Main Quiz button. Both open the Main Quiz Editor directly, where you can manage questions and student access.",
  },
  {
    id: "quiz-settings",
    path: tutorialQuizEditorPath,
    target: '[data-tutorial="main-quiz-access-controls"]',
    popupTarget: "#main-quiz-settings-tutorial",
    title: "Main Quiz Settings",
    description:
      "Lock Main Quiz blocks student access; unlock it when the class is ready. Set an optional opening time and closing time, or clear either date to remove the schedule. Students can take the Main Quiz after finishing the module.",
  },
  {
    id: "quiz-add-question",
    path: tutorialQuizEditorPath,
    target: '[data-tutorial="add-main-quiz-question"]',
    title: "Add a Question",
    description:
      "Add Question creates a blank item. Write the prompt, choose multiple choice, identification, or true/false, enter the answer and explanation, then save the quiz.",
  },
  {
    id: "quiz-auto-generate-total",
    path: tutorialQuizEditorPath,
    target: "#main-total",
    popupTarget: "#main-quiz-generation-tutorial",
    title: "Total Questions",
    description:
      "Set how many questions the Main Quiz will contain. The total can be from 1 to 100. Changing it updates the question distribution and required passing count. This tutorial preview is read-only.",
  },
  {
    id: "quiz-auto-generate-distribution",
    path: tutorialQuizEditorPath,
    target: "#main-quiz-question-distribution",
    popupTarget: "#main-quiz-generation-tutorial",
    title: "Question Distribution",
    description:
      "Choose how many Multiple Choice, Identification, and True/False questions to include. The counts must add up to Total Questions; the assigned counter shows the sum. Questions come from saved lesson pages, and completed Practice Quiz results can personalize them when available.",
  },
  {
    id: "quiz-auto-generate-passing-grade",
    path: tutorialQuizEditorPath,
    target: "#main-quiz-passing-grade",
    popupTarget: "#main-quiz-generation-tutorial",
    title: "Passing Grade",
    description:
      "The Main Quiz passing grade is 70%. Required correct answers are calculated from the total and rounded up—for example, 14 correct answers out of 20. This value updates automatically.",
  },
  {
    id: "analysis",
    path: "/professor/students",
    target: ".professor-content header.professor-section-heading",
    title: "Assessment Analysis",
    description:
      "Review the course overview, student enrollments, module totals, and quiz question counts. Open a course’s analysis to compare assessment results.",
  },
  {
    id: "analysis-practice",
    path: tutorialAssessmentPath,
    target: '[data-tutorial="analysis-practice-tab"]',
    title: "Practice Quiz Analysis",
    description:
      "Practice Quiz analysis summarizes students’ attempts, average scores, topic strengths, thinking skills, and question accuracy. Use it to spot material that needs more teaching or practice.",
  },
  {
    id: "analysis-main",
    path: tutorialAssessmentPath,
    target: '[data-tutorial="analysis-main-tab"]',
    title: "Main Quiz Analysis",
    description:
      "Main Quiz analysis shows performance on the graded course assessment. Compare scores and question results to see whether students can apply the module’s learning objectives.",
  },
  {
    id: "analysis-responses",
    path: tutorialAssessmentPath,
    target: '[data-tutorial="analysis-responses-tab"]',
    title: "Student Responses",
    description:
      "Responses lists each student’s Main Quiz result. Open a response to review their answers, correct answers, explanations, and score; the response tools can also print or share results.",
  },
  {
    id: "profile",
    path: "/professor/profile",
    target: ".professor-content .professor-profile-page-heading",
    title: "Professor Profile",
    description:
      "Review your professor information and update your profile photo here.",
  },
  {
    id: "settings",
    path: PROFESSOR_SETTINGS_PATH,
    target: ".professor-content .professor-password-card-header",
    title: "Professor Settings",
    description:
      "Settings lets you update your password whenever you need to. Professors who created their own accounts can finish the tutorial without changing it.",
  },
];

export function professorTutorialStepPath(step) {
  const query = new URLSearchParams({ tutorial: step.id });
  if (step.query) {
    new URLSearchParams(step.query).forEach((value, key) => query.set(key, value));
  }
  return `${step.path}?${query}`;
}

export function getProfessorTutorialStep({ pathname, search }) {
  const id = new URLSearchParams(search).get("tutorial");
  return professorTutorialSteps.find(
    (step) => step.path === pathname && step.id === id,
  );
}
