const examples = {
  enrolled: [
    ["CS101", "Computing Basics"],
    ["WEB102", "Web Development"],
    ["IT103", "Data Structures"],
    ["MATH104", "Discrete Math"],
    ["NET105", "Networks"],
  ],
  public: [
    ["UX201", "UX Design"],
    ["DATA202", "Data Charts"],
    ["SEC203", "Cyber Defense"],
    ["MOB204", "Mobile Apps"],
    ["AI205", "AI Basics"],
  ],
  archived: [
    ["IT001", "Digital Literacy"],
    ["CS002", "Intro to Coding"],
    ["MATH003", "Algebra"],
    ["DB004", "Database Foundations"],
    ["COM005", "Writing Skills"],
  ],
};

function makeCourses(section) {
  return examples[section].map(([code, title]) => ({
    id: `tutorial-${code}`,
    code,
    title,
    instructor: "Sample Instructor",
    professorName: "Sample Instructor",
    professorDepartment: "Example course",
  }));
}

export const tutorialEnrolledCourses = makeCourses("enrolled");
export const tutorialPublicCourses = makeCourses("public");
export const tutorialArchivedCourses = makeCourses("archived");

export const tutorialEnrolledCourseDetail = {
  ...tutorialEnrolledCourses[0],
  visibility: "private",
  summary:
    "Explore the parts of a computer and how software and networks work.",
  contentModules: [
    {
      id: "tutorial-hardware",
      title: "Computer Hardware",
      readingProgress: 100,
      mainQuizEnabled: true,
    },
    {
      id: "tutorial-software",
      title: "Software Basics",
      readingProgress: 40,
      mainQuizEnabled: true,
    },
    {
      id: "tutorial-networks",
      title: "Connecting Computers",
      readingProgress: 0,
      mainQuizEnabled: true,
    },
  ],
};

export const tutorialQuizResults = [
  {
    result_id: "tutorial-result",
    module_title: "Web Basics",
    course_title: "Web Development",
    score: 9,
    total: 10,
    passed: true,
  },
];
