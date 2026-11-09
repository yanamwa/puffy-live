import { createContext, useContext } from "react";

export const StudentTutorialContext = createContext(false);

export function useStudentTutorial() {
  return useContext(StudentTutorialContext);
}
