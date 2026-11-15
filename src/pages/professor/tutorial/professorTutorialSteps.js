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
    title: "Edit a Module",
    description:
      "Select Edit Module to open a module. From there, you can add lesson pages or update existing ones.",
  },
  {
    id: "generate-module",
    path: tutorialModulePath,
    target: '[data-tutorial="generate-module-button"]',
    title: "Organize a Module",
    description:
      "Organize Module opens the material organizer. Add PDF files and PuffyBrain can organize them into a module with lesson pages for you to review.",
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
      "Select a course to view its learning modules. Here, you can create, edit, and manage Main Quizzes to assess students’ understanding of the learning materials and their performance in Practice Quizzes.",
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
      "Lock the Main Quiz to prevent student access and unlock it when the class is ready. Set an optional opening and closing time to control quiz availability, or clear either date to remove the schedule. Students can only take the Main Quiz once the professor enables it and within the designated availability period, if a schedule is set.",
  },
  {
    id: "quiz-add-question",
    path: tutorialQuizEditorPath,
    target: '[data-tutorial="add-main-quiz-question"]',
    title: "Add a Question",
    description:
      "Select Add Question to create a new item. Enter the question, choose a question type (Multiple Choice, Identification, or True/False), provide the correct answer and explanation, then save the quiz.",
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
      "Choose the number of Multiple Choice, Identification, and True/False questions. Make sure they add up to the total number of questions. Questions are generated from lesson content and adapted based on available Practice Quiz results.",
  },
  {
    id: "quiz-auto-generate-passing-grade",
    path: tutorialQuizEditorPath,
    target: "#main-quiz-passing-grade",
    popupTarget: "#main-quiz-generation-tutorial",
    title: "Passing Grade",
    description:
      "The Main Quiz requires a passing score of 70%. The number of correct answers needed to pass updates automatically based on the total number of questions.",
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
      "Main Quiz Analysis shows students’ overall assessment performance. View scores and question results to identify their strengths and areas for improvement.",
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
      "Update your password anytime in Settings. Professors who registered their own accounts can complete the tutorial without changing their password.",
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
