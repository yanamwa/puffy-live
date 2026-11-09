export function searchSystemPages(role, query) {
  const superAdmin = role === "super_admin";
  const base = superAdmin ? "/super-admin" : "/admin";
  const pages = [
    ["Dashboard", "dashboard", "home overview"],
    ["User Management", "users", "students professors administrators accounts"],
    ["Course Management", "courses", "syllabus modules"],
    ["Academic Calendar", "academic-calendar", "events dates activities"],
    ["Announcements & Notifications", superAdmin ? "announcements" : "notification", "messages announcements notifications"],
    ["Profile", "profile", "account identity"],
    [superAdmin ? "System Settings" : "Settings", "settings", "preferences"],
    ...(superAdmin ? [
      ["Modes Management", "modes", "practice flashcards quizzes"],
      ["System Analytics", "analytics", "reports statistics"],
      ["Audit Logs", "audit-logs", "history activity logs"],
      ["Backup and Restore", "backup", "backup restore"],
    ] : [["Reports", "reports", "analytics statistics"]]),
  ];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return pages.filter(([label, , keywords]) => terms.every(term => `${label} ${keywords}`.toLowerCase().includes(term)))
    .map(([label, path]) => ({ label, path: `${base}/${path}` }));
}
