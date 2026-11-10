export const tutorialCourseExamples = [
  {
    id: "tutorial-course",
    code: "IT 101",
    title: "Introduction to Computing",
    summary: "Learn the basics of computer hardware, software, and digital systems.",
    status: "published",
    students: 32,
    moduleCount: 5,
    lessonPageCount: 18,
    quizCount: 25,
    createdAt: "Sep 3, 2026",
  },
  {
    id: "tutorial-data-structures",
    code: "CS 203",
    title: "Data Structures and Algorithms",
    summary: "Practice organizing data and solving problems with efficient algorithms.",
    status: "published",
    students: 24,
    moduleCount: 6,
    lessonPageCount: 21,
    quizCount: 30,
    createdAt: "Sep 4, 2026",
  },
  {
    id: "tutorial-web",
    code: "IT 204",
    title: "Web Development",
    summary: "Build responsive websites with HTML, CSS, and JavaScript.",
    status: "draft",
    students: 0,
    moduleCount: 4,
    lessonPageCount: 10,
    quizCount: 10,
    createdAt: "Sep 7, 2026",
  },
  {
    id: "tutorial-databases",
    code: "IT 205",
    title: "Database Management Systems",
    summary: "Design relational databases and write SQL queries.",
    status: "draft",
    students: 0,
    moduleCount: 3,
    lessonPageCount: 8,
    quizCount: 5,
    createdAt: "Sep 8, 2026",
  },
];

export const tutorialCourseDraft = {
  id: "tutorial-course",
  code: "PB-IT101-DEMO",
  catalogId: "tutorial-catalog-course",
  catalogCode: "IT 101",
  title: "Introduction to Computing",
  summary: "Learn the basics of computer hardware, software, and digital systems.",
  subject: "Information Technology",
  status: "draft",
  visibility: "private",
  students: 32,
  quizItems: [
    {
      id: "practice-question-1",
      type: "multiple_choice",
      question: "Which component executes instructions in a computer?",
      options: ["CPU", "Monitor", "Keyboard", "Printer"],
      correct_answer: "CPU",
      explanation: "The CPU processes instructions and coordinates computer tasks.",
      topic: "Computer hardware",
      cognitive_level: "Remember",
      thinking_skill: "LOTS",
    },
    {
      id: "practice-question-2",
      type: "multiple_choice",
      question: "Why does an operating system manage memory?",
      options: ["To allocate resources to running programs", "To print documents", "To create a network cable", "To display a web page"],
      correct_answer: "To allocate resources to running programs",
      explanation: "Memory management assigns and releases space for active programs.",
      topic: "Operating systems",
      cognitive_level: "Understand",
      thinking_skill: "LOTS",
    },
    {
      id: "main-question-1",
      type: "multiple_choice",
      question: "A program needs temporary space while it runs. Which component provides it?",
      options: ["RAM", "Monitor", "Keyboard", "Power supply"],
      correct_answer: "RAM",
      explanation: "RAM stores data and instructions that the CPU is using now.",
      topic: "Computer hardware",
      cognitive_level: "Apply",
      thinking_skill: "LOTS",
    },
  ],
  contentModules: [
    {
      id: "tutorial-module",
      title: "Module 1: Computing Basics",
      description: "Explore the core parts of a computer and how they work together.",
      learningObjectives: "Identify common hardware components and describe their roles.",
      topics: ["Computer hardware", "Operating systems"],
      lessonPages: [
        {
          id: "tutorial-page-1",
          title: "Computer Components",
          content: "A computer combines input, processing, storage, and output components. The CPU processes instructions while memory holds information that active programs need.",
        },
      ],
      quizItems: [
        {
          id: "practice-recap-1",
          type: "multiple_choice",
          question: "Which component executes instructions in a computer?",
          options: ["CPU", "Monitor", "Keyboard", "Printer"],
          correct_answer: "CPU",
          explanation: "The CPU processes instructions and coordinates computer tasks.",
        },
      ],
      mainQuizItems: [
        {
          id: "main-question-1",
          type: "multiple_choice",
          question: "A program needs temporary space while it runs. Which component provides it?",
          options: ["RAM", "Monitor", "Keyboard", "Power supply"],
          correct_answer: "RAM",
          explanation: "RAM stores data and instructions that the CPU is using now.",
          topic: "Computer hardware",
          cognitive_level: "Apply",
          thinking_skill: "LOTS",
        },
      ],
      mainQuizSettings: { enabled: true, unlockAt: "", lockAt: "" },
    },
    {
      id: "tutorial-module-2",
      title: "Module 2: Software and Operating Systems",
      description: "Compare system software and application software.",
      learningObjectives: "Explain how an operating system supports applications.",
      topics: ["Operating systems", "Applications"],
      lessonPages: [
        {
          id: "tutorial-page-2",
          title: "What an Operating System Does",
          content: "An operating system manages memory, files, and devices so applications can run and share computer resources.",
        },
      ],
      quizItems: [
        {
          id: "practice-recap-2",
          type: "multiple_choice",
          question: "Why does an operating system manage memory?",
          options: ["To allocate resources to running programs", "To print documents", "To create a network cable", "To display a web page"],
          correct_answer: "To allocate resources to running programs",
          explanation: "Memory management assigns and releases space for active programs.",
        },
      ],
      mainQuizSettings: { enabled: true, unlockAt: "", lockAt: "" },
    },
  ],
};

const tutorialQuestions = [
  {
    question: "Which component executes instructions in a computer?",
    options: ["CPU", "Monitor", "Keyboard", "Printer"],
    correct: "CPU",
    topic: "Computer hardware",
    cognitive_level: "Remember",
    thinking_skill: "LOTS",
  },
  {
    question: "Why does an operating system manage memory?",
    options: ["To allocate resources to running programs", "To print documents", "To create a network cable", "To display a web page"],
    correct: "To allocate resources to running programs",
    topic: "Operating systems",
    cognitive_level: "Understand",
    thinking_skill: "LOTS",
  },
];

const tutorialMainQuestion = {
  question: "A program needs temporary space while it runs. Which component provides it?",
  options: ["RAM", "Monitor", "Keyboard", "Power supply"],
  correct: "RAM",
  topic: "Computer hardware",
  cognitive_level: "Apply",
  thinking_skill: "LOTS",
};

export const tutorialAssessmentStudents = [
  { user_id: "demo-1", student_name: "Avery Chen", year_level: "1", section_name: "IT 101-A" },
  { user_id: "demo-2", student_name: "Jordan Lee", year_level: "1", section_name: "IT 101-A" },
  { user_id: "demo-3", student_name: "Sam Rivera", year_level: "1", section_name: "IT 101-B" },
  { user_id: "demo-4", student_name: "Taylor Kim", year_level: "1", section_name: "IT 101-B" },
];

export const tutorialAssessmentAttempts = tutorialAssessmentStudents.flatMap(
  (student, studentIndex) =>
    ["practice", "main"].map((assessmentType, attemptIndex) => {
      const questions = assessmentType === "main" ? [tutorialMainQuestion] : tutorialQuestions;
      const answers = questions.map((question, questionIndex) => {
        const correct = (studentIndex + questionIndex + attemptIndex) % 3 !== 0;
        const correctIndex = question.options.indexOf(question.correct);
        const incorrectIndex =
          (correctIndex + 1 + (studentIndex % (question.options.length - 1))) %
          question.options.length;
        return {
          ...question,
          prompt: question.question,
          selected: correct ? question.correct : question.options[incorrectIndex],
          answer: question.correct,
          isCorrect: correct,
          explanation: `The correct answer is ${question.correct}.`,
        };
      });
      const score = answers.filter((answer) => answer.isCorrect).length;
      return {
        id: `demo-attempt-${assessmentType}-${studentIndex + 1}`,
        user_id: student.user_id,
        student_name: student.student_name,
        assessment_type: assessmentType,
        assessment_id: assessmentType === "practice" ? "practice-1" : "main-1",
        lesson_id: "tutorial-module",
        module_index: 0,
        score,
        total: answers.length,
        answers,
        attempt_number: 1,
      };
    }),
);

export const tutorialMainQuizResponses = tutorialAssessmentAttempts
  .filter((attempt) => attempt.assessment_type === "main")
  .map((attempt, index) => ({
    id: attempt.id,
    name: attempt.student_name,
    email: `${attempt.student_name.toLowerCase().replaceAll(" ", ".")}@example.edu`,
    section: tutorialAssessmentStudents[index].section_name,
    earnedScore: attempt.score,
    total: attempt.total,
    attempt_number: attempt.attempt_number,
    answers: attempt.answers.map((answer) => ({
      question: answer.question,
      options: answer.options,
      selected_answer: answer.selected,
      correct_answer: answer.answer,
      explanation: answer.explanation,
      is_correct: answer.isCorrect,
      cognitive_level: answer.cognitive_level,
      thinking_skill: answer.thinking_skill,
    })),
  }));
