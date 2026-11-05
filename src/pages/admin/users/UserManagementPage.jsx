import UserPagination, { useUserPagination } from "../../../components/UserPagination";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiArchive, FiCheck, FiClock, FiEye, FiFileText, FiMail,
  FiPlus, FiSearch, FiUpload, FiUser, FiUsers, FiX, FiRefreshCw,
} from "react-icons/fi";
import { API_BASE } from "../../../config";
import { formatUserDisplayId } from "../../../utils/userDisplayId.js";
import "./Users.css";
import Swal from "sweetalert2";

const USER_TABS = [
  { id: "all", label: "All Users" },
  { id: "students", label: "Students" },
  { id: "professors", label: "Professors" },
  { id: "archived", label: "Archived Accounts" },
];
const showSuccess = (message, title = "Success") => Swal.fire({ icon: "success", title, text: message });
const showError = (message, title = "Error") => Swal.fire({ icon: "error", title, text: message });

// Shared credential result for Create Student and Reset Credentials.
// Values are inserted as DOM text/value, never interpolated into HTML.
async function showCredentialResult({ title, password, message }) {
  if (!password) {
    return Swal.fire({ icon: "success", title, text: message || "Credentials updated. No temporary password was returned." });
  }
  return Swal.fire({
    icon: "success",
    title,
    html: '<div class="users-credential-result"></div>',
    confirmButtonText: "Done",
    customClass: { popup: "users-credential-popup" },
    didOpen: popup => {
      const root = popup.querySelector(".users-credential-result");
      const addField = (labelText, value, copyLabel) => {
        const label = document.createElement("label");
        label.className = "users-credential-label";
        label.textContent = labelText;
        const row = document.createElement("div");
        row.className = "users-credential-row";
        const input = document.createElement("input");
        input.className = "users-credential-value";
        input.value = String(value);
        input.readOnly = true;
        input.setAttribute("aria-label", labelText);
        input.addEventListener("click", () => input.select());
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "users-credential-copy";
        copy.textContent = copyLabel;
        copy.addEventListener("click", async () => {
          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(String(value));
            } else {
              input.focus(); input.select();
              if (!document.execCommand("copy")) throw new Error("Copy unavailable");
            }
            copy.textContent = "Copied!";
          } catch {
            input.focus(); input.select();
            copy.textContent = "Select and copy";
          }
        });
        row.append(input, copy);
        root.append(label, row);
      };
      addField("Temporary Password", password, "Copy Password");
      const note = document.createElement("p");
      note.className = "users-credential-note";
      note.textContent = message || "Copy this temporary password and share it securely with the account owner.";
      root.append(note);
    },
  });
}

const EMPTY_FORM = { name: "", email: "", studentId: "", gender: "", yearLevel: "", sectionName: "" };
const EMPTY_IMPORT = { state: "idle", fileName: "", fileSize: 0, message: "", detail: "" };
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const API_ORIGIN = (() => {
  try { return new URL(API_BASE, window.location.origin).origin; }
  catch { return window.location.origin; }
})();

function authHeaders() {
  const token = localStorage.getItem("puffy-token") || localStorage.getItem("token") || localStorage.getItem("authToken");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || (response.status === 401 ? "Session expired. Please log in again." : `Request failed (${response.status}).`));
  }
  return data;
}
function normalizeUser(user = {}) {
  const archived = user.isArchived === true || user.is_archived === 1 || user.is_archived === true || user.status === "Archived";
  const id = user.id ?? user.userId ?? user.user_id;
  const role = String(user.role || "").toLowerCase();
  const joined = user.joined || user.created_at || user.createdAt || "";
  return {
    id,
    name: user.displayName || user.display_name || user.name || "Unnamed User",
    email: user.email || "",
    role,
    status: archived ? "Archived" : user.status || "Active",
    verificationStatus: String(user.verificationStatus || user.verification_status || "").toLowerCase(),
    joined,
    studentId: user.studentId || user.student_id || "",
    gender: user.gender || "",
    yearLevel: user.yearLevel || user.year_level || "",
    sectionName: user.sectionName || user.section_name || "",
    professorId: user.professorId || user.professor_id || "",
    professorDepartment: user.professorDepartment || user.professor_department || "",
    verified: user.verified === true || user.is_verified === 1 || user.is_verified === true,
    isArchived: archived,
    profileImage: user.profileImage || user.profile_image || "",
    isTemporary: user.isTemporary === true || user.is_temporary === 1 || user.is_temporary === true,
    temporaryExpiresAt: user.temporaryExpiresAt || user.temporary_expires_at || "",
    mustChangePassword: user.mustChangePassword === true || user.must_change_password === 1 || user.must_change_password === true,
    decks: user.decks ?? user.deck_count ?? null,
    modules: user.modules ?? user.module_count ?? null,
  };
}
function managedUser(user) {
  return user.role === "student" || (user.role === "professor" && user.verificationStatus === "approved");
}
function imageUrl(value) {
  const image = String(value || "").trim().replace(/\\/g, "/");
  if (!image || ["null", "undefined"].includes(image.toLowerCase())) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  if (image.startsWith("/images/")) return image;
  if (image.startsWith("/api/")) return `${API_ORIGIN}${image}`;
  if (image.startsWith("/uploads/")) return `${API_ORIGIN}${image}`;
  const clean = image.replace(/^\/+/, "");
  return `${API_ORIGIN}/${clean}`;
}
function initials(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "?";
}
function UserAvatar({ user, large = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [user.profileImage]);
  const url = failed ? "" : imageUrl(user.profileImage);
  return <span className={large ? "users-modal-avatar" : "users-avatar"}>
    {url ? <img src={url} alt="" onError={() => setFailed(true)} /> : initials(user.name)}
  </span>;
}
function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function titleCase(value) { return String(value || "").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function fileSize(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }
function normalizeHeader(value) { return String(value || "").replace(/^\ufeff/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""); }
function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      row.push(cell); rows.push(row); row = []; cell = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unclosed quotation mark.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function normalizeImportRows(rows) {
  const cleaned = rows.map(row => Array.isArray(row) ? row : Object.values(row || {}))
    .map(row => row.map(cell => String(cell ?? "").trim())).filter(row => row.some(Boolean));
  if (!cleaned.length) return [];
  const headers = cleaned[0].map(normalizeHeader);
  const hasHeader = headers.some(h => ["email", "emailaddress", "studentemail", "name", "fullname", "studentname"].includes(h));
  const index = (names, fallback) => { const found = hasHeader ? headers.findIndex(h => names.includes(h)) : -1; return found < 0 ? fallback : found; };
  // Headerless files use: Name, Email, Student ID, Gender, Year Level, Section.
  return (hasHeader ? cleaned.slice(1) : cleaned).map((row, i) => ({
    sourceRow: i + (hasHeader ? 2 : 1),
    name: row[index(["name", "fullname", "studentname"], 0)] || "",
    email: row[index(["email", "emailaddress", "studentemail"], 1)] || "",
    studentId: row[index(["studentid", "studentnumber", "studentno", "id", "idnumber", "schoolid"], 2)] || "",
    gender: row[index(["gender", "sex"], 3)] || "",
    yearLevel: row[index(["year", "yearlevel", "studentyear", "grade", "gradelevel"], hasHeader ? 4 : 4)] || "",
    sectionName: row[index(["section", "sectionname", "studentsection", "block"], 5)] || "",
  })).filter(s => s.name || s.email || s.studentId);
}
async function parseImportFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx") {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    return normalizeImportRows(await readXlsxFile(file));
  }
  if (extension === "csv") return normalizeImportRows(parseCsv(await file.text()));
  throw new Error("Only CSV and XLSX files are supported.");
}
function validateStudent(student) {
  const name = String(student.name || "").trim();
  const email = String(student.email || "").trim();
  const studentId = String(student.studentId || "").trim();
  const gender = String(student.gender || "").trim();
  const yearLevel = String(student.yearLevel || "").trim();
  const sectionName = String(student.sectionName || "").replace(/\s+/g, "").toUpperCase();
  if (!name || !email || !studentId || !gender || !yearLevel || !sectionName) return "Name, email, student ID, gender, year level, and section are required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email address.";
  if (!["male", "female"].includes(gender.toLowerCase())) return "Gender must be Male or Female.";
  const year = YEARS.findIndex(y => y.toLowerCase() === yearLevel.toLowerCase()) + 1;
  if (!year) return "Year level must be 1st Year, 2nd Year, 3rd Year, or 4th Year.";
  if (!/^[1-4][A-F]$/.test(sectionName) || Number(sectionName[0]) !== year) return `Section must be ${year}A through ${year}F for ${yearLevel}.`;
  return "";
}

export default function UserManagementPage() {
  const fileInputRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [busyUserId, setBusyUserId] = useState(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({ ...EMPTY_FORM });
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [studentImportStatus, setStudentImportStatus] = useState({ ...EMPTY_IMPORT });
  const importBusy = ["reading", "importing"].includes(studentImportStatus.state);

  const loadUsers = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const data = await apiRequest("/users");
      if (!Array.isArray(data.users)) throw new Error("Invalid users response from server.");
      setUsers(data.users.map(normalizeUser).filter(managedUser));
    } catch (error) {
      setUsers([]);
      setLoadError(error.message || "Could not load users.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  const updateUser = user => {
    const normalized = normalizeUser(user);
    setUsers(current => current.map(item => String(item.id) === String(normalized.id) ? normalized : item).filter(managedUser));
    setSelectedUser(current => current && String(current.id) === String(normalized.id) ? normalized : current);
  };
  const closeModal = () => {
    if (creatingStudent || importBusy) return;
    setStudentModalOpen(false); setStudentForm({ ...EMPTY_FORM });
  };
  const createStudent = payload => apiRequest("/users/student", { method: "POST", body: JSON.stringify(payload) });
  const handleCreateStudent = async event => {
    event.preventDefault();
    const validationError = validateStudent(studentForm);
    if (validationError) { showError(validationError, "Invalid Student Details"); return; }
    setCreatingStudent(true); setNotice("");
    try {
      const data = await createStudent({ ...studentForm, sectionName: studentForm.sectionName.trim().toUpperCase() });
      if (!data.user) throw new Error("Account created, but the server did not return the new user. Refresh the list.");
      setUsers(current => [normalizeUser(data.user), ...current]);
      setActiveTab("students"); setQuery("");
      closeModal(); setStudentModalOpen(false); setStudentForm({ ...EMPTY_FORM });
      await showCredentialResult({ title: "Student Created", password: data.temporaryPassword, message: data.credentialsEmailed === true ? "Credentials email sent. You can also copy the temporary password below." : "Email delivery is not confirmed. Copy the temporary password and share it securely." });
    } catch (error) { showError(error.message || "Could not create student account.", "Create Failed"); }
    finally { setCreatingStudent(false); }
  };
  const handleBulkImport = async event => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    const base = { fileName: file.name, fileSize: file.size };
    setStudentImportStatus({ ...EMPTY_IMPORT, ...base, state: "reading", message: "Reading student file..." });
    try {
      const students = await parseImportFile(file);
      if (!students.length) throw new Error("No student records found. Include Name, Email, Student ID, Gender, Year Level, and Section columns.");
      const created = []; const failures = [];
      const seenEmails = new Set(); const seenIds = new Set();
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        setStudentImportStatus({ ...EMPTY_IMPORT, ...base, state: "importing", message: `Importing ${i + 1} of ${students.length} students...` });
        const error = validateStudent(student);
        if (error) { failures.push(`Row ${student.sourceRow}: ${error}`); continue; }
        const emailKey = student.email.trim().toLowerCase();
        const idKey = student.studentId.trim().toLowerCase();
        if (seenEmails.has(emailKey) || seenIds.has(idKey)) {
          failures.push(`Row ${student.sourceRow}: Duplicate email or student ID in this file.`); continue;
        }
        seenEmails.add(emailKey); seenIds.add(idKey);
        try {
          const data = await createStudent(student);
          if (data.user) created.push(normalizeUser(data.user));
          else failures.push(`Row ${student.sourceRow}: Server did not return the created user.`);
        } catch (err) { failures.push(`Row ${student.sourceRow} (${student.email}): ${err.message}`); }
      }
      if (created.length) {
        setUsers(current => [...created, ...current]);
        setActiveTab("students"); setQuery("");
      }
      const message = `${created.length} imported, ${failures.length} failed.`;
      setStudentImportStatus({ ...EMPTY_IMPORT, ...base, state: failures.length ? (created.length ? "partial" : "error") : "success", message, detail: failures.slice(0, 5).join("\n") });
      if (created.length && !failures.length) showSuccess(message, "Import Complete");
      else if (failures.length) Swal.fire({ icon: created.length ? "warning" : "error", title: "Import Results", text: `${message} ${failures.slice(0, 5).join(" | ")}` });
      try {
        await apiRequest("/users/student/bulk-import-audit", { method: "POST", body: JSON.stringify({ fileName: file.name, importedCount: created.length, failedCount: failures.length, totalCount: students.length }) });
      } catch (auditError) { setNotice(`${message} Audit log could not be saved: ${auditError.message}`); }
    } catch (error) {
      setStudentImportStatus({ ...EMPTY_IMPORT, ...base, state: "error", message: "Could not import students.", detail: error.message });
      showError(error.message, "Import Failed");
    }
  };
  const handleArchiveToggle = async user => {
    const archive = !user.isArchived;
    const confirmation = await Swal.fire({ icon: "warning", title: `${archive ? "Archive" : "Restore"} Account?`, text: `${archive ? "Archive" : "Restore"} ${user.name}?`, showCancelButton: true, confirmButtonText: archive ? "Archive" : "Restore", reverseButtons: true });
    if (!confirmation.isConfirmed) return;
    setBusyUserId(user.id); setNotice("");
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(user.id)}/archive`, { method: "PATCH", body: JSON.stringify({ archive }) });
      if (data.user) updateUser(data.user);
      else await loadUsers();
      showSuccess(data.message || (archive ? "Account archived." : "Account restored."));
    } catch (error) { showError(error.message || "Could not update account."); }
    finally { setBusyUserId(null); }
  };
  const handleResetCredentials = async user => {
    const confirmation = await Swal.fire({
      icon: "warning", title: "Reset Credentials?",
      text: `Generate a new temporary password for ${user.name}? Their previous password will stop working.`,
      showCancelButton: true, confirmButtonText: "Reset Password", reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    setBusyUserId(user.id);
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(user.id)}/reset-credentials`, { method: "POST" });
      await showCredentialResult({
        title: "Credentials Reset",
        password: data.temporaryPassword,
        message: "The previous password is no longer valid. Copy the new password and share it securely with the account owner.",
      });
    } catch (error) { showError(error.message || "Could not reset credentials."); }
    finally { setBusyUserId(null); }
  };
  const userGroups = useMemo(() => ({
    all: users.filter(user => !user.isArchived),
    students: users.filter(user => user.role === "student" && !user.isArchived),
    professors: users.filter(user => user.role === "professor" && !user.isArchived),
    archived: users.filter(user => user.isArchived),
  }), [users]);
  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (userGroups[activeTab] || userGroups.all).filter(user =>
      !search || [user.name, user.email, user.id, formatUserDisplayId(user), user.studentId, user.professorDepartment]
        .some(value => String(value ?? "").toLowerCase().includes(search)));
  }, [userGroups, activeTab, query]);
  const pagination = useUserPagination(filteredUsers, activeTab, query);
  const securityLabel = user => user.isTemporary ? `Temporary until ${formatDate(user.temporaryExpiresAt)}` : user.mustChangePassword ? "Temporary password" : user.verified ? "Email verified" : "Email pending";
  const stats = [
    { label: "Managed Users", value: users.length, icon: FiUsers },
    { label: "Students", value: users.filter(u => u.role === "student").length, icon: FiUser },
    { label: "Approved Professors", value: users.filter(u => u.role === "professor").length, icon: FiMail },
    { label: "Archived", value: users.filter(u => u.isArchived).length, icon: FiArchive },
  ];
  const importTitle = ({ reading: "Reading file", importing: "Importing students", success: "Students imported", partial: "Import completed with errors", error: "Import failed" })[studentImportStatus.state] || "Student import";
  return <div className="users-page">
    {studentImportStatus.state !== "idle" && <aside className={`student-import-popup is-${studentImportStatus.state}`} role="status" aria-live="polite">
      <span className="student-import-popup-icon">{studentImportStatus.state === "success" ? <FiCheck /> : studentImportStatus.state === "error" ? <FiX /> : studentImportStatus.state === "partial" ? <FiFileText /> : <FiClock />}</span>
      <div className="student-import-popup-copy"><strong>{importTitle}</strong><p>{studentImportStatus.message}</p>
        <span>{studentImportStatus.fileName} - {fileSize(studentImportStatus.fileSize)}</span>
        {studentImportStatus.detail && <small style={{ whiteSpace: "pre-line" }}>{studentImportStatus.detail}</small>}
      </div>
      {!importBusy && <button className="student-import-popup-dismiss" type="button" onClick={() => setStudentImportStatus({ ...EMPTY_IMPORT })} aria-label="Dismiss import status"><FiX /></button>}
    </aside>}
    <div className="users-page-header"><div><h1>Admin User Management</h1><p>Manage registered students, approved professors, and archived accounts.</p></div>
      <div className="users-header-actions"><button className="users-create-btn" type="button" onClick={() => { setNotice(""); setStudentModalOpen(true); }}><FiPlus /> Add Student</button></div>
    </div>
    <div className="users-stat-grid">{stats.map(stat => { const Icon = stat.icon; return <div className="users-stat-card" key={stat.label}><div className="users-stat-icon"><Icon /></div><span>{stat.label}</span><strong>{stat.value}</strong></div>; })}</div>
    <section className="users-panel">
      <nav className="user-management-tabs" aria-label="User management sections">
        {USER_TABS.map(tab => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </nav><div className="users-panel-top"><div><h2>{USER_TABS.find(tab => tab.id === activeTab)?.label}</h2><p>{pagination.range} user records shown</p></div>
      <div className="users-controls"><label className="users-search"><FiSearch /><input type="text" placeholder="Search users..." value={query} onChange={event => setQuery(event.target.value)} /></label>
      </div></div>
      {notice && <div className="users-notice" role="status">{notice}</div>}
      {loadError && <div className="users-notice" role="alert">{loadError} <button type="button" onClick={loadUsers}>Retry</button></div>}
      <div className="users-table-wrap"><table className="users-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Security</th><th>Action</th></tr></thead>
        <tbody>{loading ? <tr><td className="users-empty" colSpan={7}>Loading users...</td></tr> : filteredUsers.length === 0 ? <tr><td className="users-empty" colSpan={7}>{loadError ? "Unable to load users." : "No users match your filters."}</td></tr> : pagination.rows.map(user => <tr key={user.id}>
          <td><div className="users-person"><UserAvatar user={user} /><div><strong>{user.name}</strong><small>User ID: {formatUserDisplayId(user)}</small></div></div></td>
          <td>{user.email}</td><td><span className="users-role">{titleCase(user.role)}</span></td>
          <td><span className={`users-status is-${String(user.status).toLowerCase()}`}>{titleCase(user.status)}</span></td>
          <td>{formatDate(user.joined)}</td><td>{securityLabel(user)}</td>
          <td><div className="users-action-group"><button className="users-icon-btn users-view-btn" type="button" onClick={() => setSelectedUser(user)} title="View user"><FiEye /><span>View</span></button>
            <button className="users-icon-btn users-archive-btn" type="button" onClick={() => handleArchiveToggle(user)} disabled={busyUserId !== null} title={user.isArchived ? "Restore account" : "Archive account"}><FiArchive /><span>{busyUserId === user.id ? "Saving..." : user.isArchived ? "Restore" : "Archive"}</span></button></div></td>
        </tr>)}</tbody></table></div><UserPagination pagination={pagination} loading={loading} />
    </section>
    {selectedUser && <div className="users-modal-backdrop" onClick={() => setSelectedUser(null)}><section className="users-modal" role="dialog" aria-modal="true" aria-label="User details" onClick={event => event.stopPropagation()}>
      <button className="users-modal-close" type="button" onClick={() => setSelectedUser(null)} aria-label="Close user details"><FiX /></button>
      <div className="users-modal-profile"><UserAvatar user={selectedUser} large /><div><h2>{selectedUser.name}</h2><p>{selectedUser.email}</p></div></div>
      <dl className="users-detail-grid">{[
        ["User ID", formatUserDisplayId(selectedUser)], ["Role", titleCase(selectedUser.role)], ["Status", titleCase(selectedUser.status)],
        ["Email Verification", selectedUser.verified ? "Verified" : "Not verified"], ["Gender", selectedUser.gender || "Not provided"],
        ["Student ID", selectedUser.studentId || "None"], ["Year Level", selectedUser.yearLevel || "None"], ["Section", selectedUser.sectionName || "None"],
        ["Professor ID", selectedUser.professorId || "None"], ["Department", selectedUser.professorDepartment || "None"],
        ["Joined", formatDate(selectedUser.joined)], ["Activity", selectedUser.decks === null && selectedUser.modules === null ? "Not available" : `${selectedUser.decks ?? 0} decks / ${selectedUser.modules ?? 0} modules`],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="users-modal-actions"><button className="users-icon-btn users-reset-btn" type="button" disabled={busyUserId !== null} onClick={() => handleResetCredentials(selectedUser)}><FiRefreshCw /> Reset Credentials</button></div>
    </section></div>}
    {studentModalOpen && <div className="users-modal-backdrop" onClick={closeModal}><section className="users-modal" role="dialog" aria-modal="true" aria-label="Add student" onClick={event => event.stopPropagation()}>
      <button className="users-modal-close" type="button" onClick={closeModal} disabled={creatingStudent || importBusy} aria-label="Close student form"><FiX /></button>
      <div className="users-modal-profile"><span className="users-modal-avatar"><FiUser /></span><div><h2>Add Student</h2><p>Create or import student accounts with generated credentials.</p></div></div>
      <div className="student-import-panel"><div><strong>Bulk Import Students</strong><p>CSV or Excel columns: Name, Email, Student ID, Gender, Year Level, Section.</p></div>
        <button className="users-secondary-btn" type="button" disabled={importBusy || creatingStudent} onClick={() => fileInputRef.current?.click()}><FiUpload /> Import CSV or Excel</button>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx" hidden onChange={handleBulkImport} />
      </div>
      <form className="users-student-form" onSubmit={handleCreateStudent}>
        <label>Student Name<input type="text" value={studentForm.name} onChange={e => setStudentForm(s => ({ ...s, name: e.target.value }))} disabled={creatingStudent || importBusy} required /></label>
        <label>Student Email<input type="email" value={studentForm.email} onChange={e => setStudentForm(s => ({ ...s, email: e.target.value }))} disabled={creatingStudent || importBusy} required /></label>
        <label>Student ID<input type="text" value={studentForm.studentId} onChange={e => setStudentForm(s => ({ ...s, studentId: e.target.value }))} disabled={creatingStudent || importBusy} required /></label>
        <label>Gender<select value={studentForm.gender} onChange={e => setStudentForm(s => ({ ...s, gender: e.target.value }))} disabled={creatingStudent || importBusy} required><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
        <label>Year Level<select value={studentForm.yearLevel} onChange={e => setStudentForm(s => ({ ...s, yearLevel: e.target.value, sectionName: "" }))} disabled={creatingStudent || importBusy} required><option value="">Select year</option>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
        <label>Section<select value={studentForm.sectionName} onChange={e => setStudentForm(s => ({ ...s, sectionName: e.target.value }))} disabled={creatingStudent || importBusy || !studentForm.yearLevel} required><option value="">Select section</option>{studentForm.yearLevel && "ABCDEF".split("").map(letter => { const value = `${YEARS.indexOf(studentForm.yearLevel) + 1}${letter}`; return <option key={value} value={value}>{value}</option>; })}</select></label>
        <button className="users-submit-btn" type="submit" disabled={creatingStudent || importBusy}>{creatingStudent ? "Creating Student..." : "Create Student Account"}</button>
      </form>
    </section></div>}
  </div>;
}
