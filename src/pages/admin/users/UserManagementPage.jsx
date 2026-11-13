import UserPagination, { useUserPagination } from "../../../components/UserPagination";
import StudentImportPanel from "../../../components/StudentImportPanel.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArchive, FiCheck, FiClock, FiEye, FiFileText, FiMail,
  FiPlus, FiSearch, FiUser, FiUsers, FiX, FiRefreshCw,
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
    course: user.course || user.program || "",
    department: user.department || "",
    professorFacultyId:
      user.professorFacultyId || user.professor_faculty_id || "",
    professorPosition:
      user.professorPosition || user.professor_position || "",
    professorSpecialization:
      user.professorSpecialization || user.professor_specialization || "",
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
  return <span
    className={large ? "users-modal-avatar" : "users-avatar users-role-avatar"}
    data-role={user.role}
  >
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
      await showCredentialResult({ title: "Student Created", password: data.temporaryPassword, message: data.credentialsEmailed === true ? "The email includes the temporary password and a verification code. The student must verify their email before signing in and starting the tutorial." : "Email delivery is not confirmed. Share the temporary password securely. The student can request a new verification code after attempting to sign in." });
    } catch (error) { showError(error.message || "Could not create student account.", "Create Failed"); }
    finally { setCreatingStudent(false); }
  };
  const handleBulkImport = async (file, prepareStudents) => {
    const base = { fileName: file.name, fileSize: file.size };
    setStudentImportStatus({ ...EMPTY_IMPORT, ...base, state: "reading", message: "Reading student file..." });
    try {
      const students = await prepareStudents();
      if (students === null) {
        setStudentImportStatus({ ...EMPTY_IMPORT });
        return;
      }
      if (!students.length) throw new Error("No student records found in this file.");
      setStudentModalOpen(false);
      const created = []; const failures = [];
      const unconfirmedEmails = [];
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
          if (data.user) {
            created.push(normalizeUser(data.user));
            if (data.credentialsEmailed !== true) {
              unconfirmedEmails.push(`Row ${student.sourceRow}: Email to ${student.email} was not confirmed.`);
            }
          } else failures.push(`Row ${student.sourceRow}: Server did not return the created user.`);
        } catch (err) { failures.push(`Row ${student.sourceRow} (${student.email}): ${err.message}`); }
      }
      if (created.length) {
        setUsers(current => [...created, ...current]);
        setActiveTab("students"); setQuery("");
      }
      const emailSummary = created.length ? ` Mail server accepted ${created.length - unconfirmedEmails.length} of ${created.length} credential emails, each with the temporary password and verification code.` : "";
      const message = `${created.length} imported, ${failures.length} failed.${emailSummary}`;
      const issues = [...failures, ...unconfirmedEmails].slice(0, 5);
      setStudentImportStatus({ ...EMPTY_IMPORT, ...base, state: issues.length ? (created.length ? "partial" : "error") : "success", message, detail: issues.join("\n") });
      if (!issues.length) showSuccess(message, "Import Complete");
      else Swal.fire({ icon: created.length ? "warning" : "error", title: "Import Results", text: `${message} ${issues.join(" | ")}` });
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
    const confirmation = await Swal.fire({
      icon: "warning",
      title: `${archive ? "Archive" : "Restore"} account?`,
      text: `Are you sure you want to ${archive ? "archive" : "restore"} ${user.name}'s account?`,
      showCancelButton: true,
      confirmButtonText: archive ? "Yes, archive" : "Yes, restore",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });
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
    
    if (!user.mustChangePassword) {
      await Swal.fire({
        icon: "info",
        title: "Password Managed by User",
        text: "This user has already taken control of their password. Administrators can no longer reset their credentials.",
        confirmButtonText: "Understood",
        confirmButtonColor: "#7fa8d6",
      });
      return;
    }


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
    {!studentModalOpen && studentImportStatus.state !== "idle" && <aside className={`student-import-popup is-${studentImportStatus.state}`} role="status" aria-live="polite">
      <span className="student-import-popup-icon">{studentImportStatus.state === "success" ? <FiCheck /> : studentImportStatus.state === "error" ? <FiX /> : studentImportStatus.state === "partial" ? <FiFileText /> : <FiClock />}</span>
      <div className="student-import-popup-copy"><strong>{importTitle}</strong><p>{studentImportStatus.message}</p>
        <span>{studentImportStatus.fileName} - {fileSize(studentImportStatus.fileSize)}</span>
        {studentImportStatus.detail && <small style={{ whiteSpace: "pre-line" }}>{studentImportStatus.detail}</small>}
      </div>
      {!importBusy && <button className="student-import-popup-dismiss" type="button" onClick={() => setStudentImportStatus({ ...EMPTY_IMPORT })} aria-label="Dismiss import status"><FiX /></button>}
    </aside>}
    <div className="users-page-header"><div><h1>Admin User Management</h1><p>Manage registered students, approved professors, and archived accounts.</p></div>
      <div className="users-header-actions"><button className="users-create-btn" type="button" disabled={importBusy} onClick={() => { setNotice(""); setStudentModalOpen(true); }}><FiPlus /> Add Student</button></div>
    </div>
    <div className="users-stat-grid">{stats.map(stat => { const Icon = stat.icon; return <div className="users-stat-card" key={stat.label}><div className="users-stat-icon"><Icon /></div><span>{stat.label}</span><strong>{stat.value}</strong></div>; })}</div>
    <nav className="user-management-tabs" aria-label="User management sections">
      {USER_TABS.map(tab => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </nav>
    <section className="users-panel">
      <div className="users-panel-top">
        <div>
          <h2>{USER_TABS.find(tab => tab.id === activeTab)?.label}</h2>
          <p>{pagination.range} user records shown</p>
        </div>
        <label className="users-search">
          <FiSearch />
          <input type="text" placeholder="Search users..." value={query} onChange={event => setQuery(event.target.value)} />
        </label>
      </div>
      {notice && <div className="users-notice" role="status">{notice}</div>}
      {loadError && <div className="users-notice" role="alert">{loadError} <button type="button" onClick={loadUsers}>Retry</button></div>}
      <div className="users-table-wrap"><table className="users-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Security</th><th>Action</th></tr></thead>
        <tbody>{loading ? <tr><td className="users-empty" colSpan={7}>Loading users...</td></tr> : filteredUsers.length === 0 ? <tr><td className="users-empty" colSpan={7}>{loadError ? "Unable to load users." : "No users match your filters."}</td></tr> : pagination.rows.map(user => <tr key={user.id}>
          <td><div className="users-person"><UserAvatar user={user} /><div><strong>{user.name}</strong><small>User ID: {formatUserDisplayId(user)}</small></div></div></td>
          <td>{user.email}</td><td><span className="users-role" data-role={user.role}>{titleCase(user.role)}</span></td>
          <td><span className={`users-status is-${String(user.status).toLowerCase()}`}>{titleCase(user.status)}</span></td>
          <td>{formatDate(user.joined)}</td><td>{securityLabel(user)}</td>
          <td><div className="users-action-group"><button className="users-icon-btn users-view-btn" type="button" onClick={() => setSelectedUser(user)} title="View user"><FiEye /><span>View</span></button>
            <button className="users-icon-btn users-archive-btn" type="button" onClick={() => handleArchiveToggle(user)} disabled={busyUserId !== null} title={user.isArchived ? "Restore account" : "Archive account"}><FiArchive /><span>{busyUserId === user.id ? "Saving..." : user.isArchived ? "Restore" : "Archive"}</span></button></div></td>
        </tr>)}</tbody></table></div><UserPagination pagination={pagination} loading={loading} />
    </section>
          {selectedUser && (
          <div
            className="users-modal-backdrop"
            onClick={() => setSelectedUser(null)}
          >
            <section
              className="users-modal user-profile-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-profile-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="user-profile-close"
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Close user details"
              >
                <FiX />
              </button>

              {/* LEFT: IDENTIFICATION CARD */}
              <aside className="user-profile-card">
                <header className="user-profile-brand">
                  <div>
                    <strong>PuffyBrain</strong>
                    <span>{titleCase(selectedUser.role)} Identification Card</span>
                  </div>

                  <span className="user-profile-role">
                    {titleCase(selectedUser.role)}
                  </span>
                </header>

                <div className="user-profile-identity">
                  <div className="user-profile-photo">
                    <UserAvatar user={selectedUser} large />
                  </div>

                  <p className="user-profile-eyebrow">
                    Official {titleCase(selectedUser.role)} Profile
                  </p>

                  <h2>{selectedUser.name}</h2>

                  <strong className="user-profile-number">
                    {formatUserDisplayId(selectedUser)}
                  </strong>

                  <p className="user-profile-affiliation">
                    {selectedUser.role === "student"
                      ? selectedUser.course || "Student"
                      : selectedUser.role === "professor"
                        ? selectedUser.professorDepartment || "Faculty"
                        : selectedUser.department || "Administration"}
                  </p>

                  <span className="user-profile-status">
                    {titleCase(selectedUser.role)}
                    <span aria-hidden="true"> · </span>
                    {titleCase(selectedUser.status)}
                  </span>
                </div>

                <footer className="user-profile-issued">
                  <span>Issued by</span>
                  <strong>PuffyBrain Learning System</strong>
                </footer>
              </aside>

              {/* RIGHT: COMPLETE USER INFORMATION */}
              <div className="user-profile-information">
                <header className="user-profile-heading">
                  <p className="user-profile-eyebrow">Profile Overview</p>
                  <h2 id="user-profile-title">
                    {titleCase(selectedUser.role)} Information
                  </h2>
                  <p>Personal, role, and account information.</p>
                </header>

                <section className="user-profile-section">
                  <h3>Personal Information</h3>
                  <p>Basic account details</p>

                  <dl className="user-profile-fields">
                    {[
                      ["Full Name", selectedUser.name],
                      ["User ID", formatUserDisplayId(selectedUser)],
                      ["Gender", selectedUser.gender],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value || "Not provided"}</dd>
                      </div>
                    ))}

                    <div className="user-profile-wide">
                      <dt>Email Address</dt>
                      <dd>{selectedUser.email || "Not provided"}</dd>
                    </div>
                  </dl>
                </section>

                {selectedUser.role === "student" && (
                  <section className="user-profile-section">
                    <h3>Student Information</h3>
                    <p>Academic and enrollment details</p>

                    <dl className="user-profile-fields">
                      {[
                        ["Student ID", selectedUser.studentId],
                        ["Course / Program", selectedUser.course],
                        ["Year Level", selectedUser.yearLevel],
                        ["Section", selectedUser.sectionName],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value || "Not provided"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {selectedUser.role === "professor" && (
                  <section className="user-profile-section">
                    <h3>Faculty Information</h3>
                    <p>Professional and department details</p>

                    <dl className="user-profile-fields">
                      {[
                        ["Professor ID", selectedUser.professorId],
                        ["Faculty ID", selectedUser.professorFacultyId],
                        ["Department", selectedUser.professorDepartment],
                        ["Position", selectedUser.professorPosition],
                        ["Specialization", selectedUser.professorSpecialization],
                        [
                          "Approval Status",
                          titleCase(selectedUser.verificationStatus || ""),
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value || "Not provided"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {["admin", "super_admin", "superadmin"].includes(
                  selectedUser.role
                ) && (
                  <section className="user-profile-section">
                    <h3>Administrative Information</h3>
                    <p>Administrative account details</p>

                    <dl className="user-profile-fields">
                      <div>
                        <dt>Admin ID</dt>
                        <dd>{formatUserDisplayId(selectedUser)}</dd>
                      </div>

                      <div>
                        <dt>Role</dt>
                        <dd>{titleCase(selectedUser.role)}</dd>
                      </div>

                      <div className="user-profile-wide">
                        <dt>Department</dt>
                        <dd>{selectedUser.department || "Not provided"}</dd>
                      </div>
                    </dl>
                  </section>
                )}

                <section className="user-profile-section">
                  <h3>Account Information</h3>
                  <p>Account status and security</p>

                  <dl className="user-profile-fields">
                    {[
                      ["Status", titleCase(selectedUser.status)],
                      [
                        "Email Verification",
                        selectedUser.verified ? "Verified" : "Not verified",
                      ],
                      ["Registered", formatDate(selectedUser.joined)],
                      [
                        "Account Type",
                        selectedUser.isTemporary ? "Temporary" : "Permanent",
                      ],
                      [
                        "Password Status",
                        selectedUser.mustChangePassword
                          ? "Password change required"
                          : "User managed",
                      ],
                      [
                        "Archived",
                        selectedUser.isArchived ? "Yes" : "No",
                      ],
                      ...(selectedUser.isTemporary
                        ? [
                            [
                              "Expiration Date",
                              formatDate(selectedUser.temporaryExpiresAt),
                            ],
                          ]
                        : []),
                      [
                        "Activity",
                        selectedUser.decks == null &&
                        selectedUser.modules == null
                          ? "Not available"
                          : `${selectedUser.decks ?? 0} decks / ${
                              selectedUser.modules ?? 0
                            } modules`,
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value || "Not provided"}</dd>
                      </div>
                    ))}
                  </dl>

                      <div className="user-profile-actions">
                        <div className="users-reset-section">
                          <button
                            type="button"
                            disabled={
                              busyUserId !== null ||
                              !selectedUser.mustChangePassword
                            }
                            onClick={() => handleResetCredentials(selectedUser)}
                          >
                            <FiRefreshCw aria-hidden="true" />
                            Reset Credentials
                          </button>

                          {!selectedUser.mustChangePassword && (
                            
                                <small
                                  style={{
                                    display: "block",
                                    fontSize: "5px",
                                    fontWeight: 400,
                                    lineHeight: 1.3,
                                    color: "#98a2b3",
                                    textAlign: "right",
                                    marginTop: "4px",
                                  }}
                                >
                                  Password is already managed by the user.
                                </small>

                          )}
                        </div>
                      </div>


                </section>
              </div>
            </section>
          </div>
        )}
    {studentModalOpen && <div className="users-modal-backdrop" onClick={closeModal}><section className="users-modal" role="dialog" aria-modal="true" aria-label="Add student" onClick={event => event.stopPropagation()}>
      <button className="users-modal-close" type="button" onClick={closeModal} disabled={creatingStudent || importBusy} aria-label="Close student form"><FiX /></button>
      <div className="users-modal-profile"><span className="users-modal-avatar"><FiUser /></span><div><h2>Add Student</h2><p>Create or import student accounts with generated credentials.</p></div></div>
      <StudentImportPanel
        busy={importBusy}
        disabled={creatingStudent}
        onImport={handleBulkImport}
      />
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
