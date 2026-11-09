import { APP_ROLES, getUserRole } from "./roles.js";

export function requiresPasswordChange(user) {
  const flag = user?.mustChangePassword ?? user?.must_change_password;
  return [true, 1, "1", "true"].includes(flag);
}

export function requiresStudentPasswordChange(user) {
  return getUserRole(user) === APP_ROLES.STUDENT && requiresPasswordChange(user);
}

export function requiresStudentTutorial(user) {
  if (getUserRole(user) !== APP_ROLES.STUDENT) return false;
  if (typeof user.studentTutorialPending === "boolean") {
    return user.studentTutorialPending;
  }

  const completed = user?.onboardingCompleted ?? user?.onboarding_completed;
  return (
    requiresStudentPasswordChange(user) &&
    [false, 0, "0", "false"].includes(completed)
  );
}
