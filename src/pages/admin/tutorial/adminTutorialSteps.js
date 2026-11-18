import {
  requiresAdminTutorial,
  requiresPasswordChange,
} from "../../../utils/passwordPolicy.js";

export const ADMIN_DASHBOARD_PATH = "/admin/dashboard";
export const ADMIN_SETTINGS_PATH = "/admin/settings";

export const adminTutorialSteps = [
  {
    id: "dashboard",
    path: ADMIN_DASHBOARD_PATH,
    title: "Admin Dashboard",
    description:
      "Get an overview of PuffyBrain activity and use the sidebar to open the Admin tools.",
  },
  {
    id: "academic-calendar",
    path: "/admin/academic-calendar",
    title: "Academic Calendar",
    description:
      "Review academic dates and manage calendar events from this page.",
  },
  {
    id: "users",
    path: "/admin/users",
    title: "User Management",
    description:
      "Manage student and professor accounts, import student rosters, and manage archived accounts.",
  },
  {
    id: "courses",
    path: "/admin/courses",
    title: "Course Management",
    description:
      "View the course catalog, professor classes, enrolled students, and archived courses. Use Syllabus Management to upload syllabi and track their approval.",
  },
  {
    id: "reports",
    path: "/admin/reports",
    title: "Reports",
    description:
      "Review course participation, academic activity, and student performance. Use the report filters to focus on the records you need.",
  },
  {
    id: "notifications",
    path: "/admin/notification",
    title: "Announcements & Notifications",
    description:
      "Create and send announcements to students, professors, and the Super Admin. You can also review previously posted announcements.",
  },
  {
    id: "profile",
    path: "/admin/profile",
    title: "Admin Profile",
    description:
      "View your account information and update your profile photo here.",
  },
  {
    id: "settings",
    path: ADMIN_SETTINGS_PATH,
    target: ".admin-password-card-header",
    title: "Admin Settings",
    description:
      "Use Settings to change your password. Finish the tutorial to return to the Admin Dashboard.",
  },
].map((step) => ({
  target: ".admin-content h1",
  ...step,
}));

export function adminTutorialStepPath(step) {
  return `${step.path}?${new URLSearchParams({ tutorial: step.id })}`;
}

export function getAdminTutorialStep({ pathname, search }) {
  const id = new URLSearchParams(search).get("tutorial");
  return adminTutorialSteps.find(
    (step) => step.path === pathname && step.id === id,
  );
}

export function getAdminSetupRedirect(user, location) {
  const step = getAdminTutorialStep(location);
  if (requiresPasswordChange(user)) {
    const path = location.pathname.replace(/\/+$/, "").toLowerCase();
    return path === ADMIN_SETTINGS_PATH && !step ? null : ADMIN_SETTINGS_PATH;
  }
  if (requiresAdminTutorial(user)) {
    return step ? null : adminTutorialStepPath(adminTutorialSteps[0]);
  }
  return step?.path ?? null;
}
