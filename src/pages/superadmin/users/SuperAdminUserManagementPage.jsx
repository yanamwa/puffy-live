import UserPagination, { useUserPagination } from "../../../components/UserPagination";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiArchive,
  FiCheck,
  FiClock,
  FiEye,
  FiFileText,
  FiKey,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUpload,
  FiUser,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { API_BASE } from "../../../config";
import "./SuperAdminUserManagementPage.css";
import Swal from "sweetalert2";

const USER_TABS = [
  { id: "all", label: "All Users" },
  { id: "approvals", label: "Professor Approvals" },
  { id: "students", label: "Students" },
  { id: "professors", label: "Professors" },
  { id: "admins", label: "Administrators" },
  { id: "archived", label: "Archived Accounts" },
];

const VALID_USER_TAB_IDS = USER_TABS.map((tab) => tab.id);

const ACCOUNT_TYPE_OPTIONS = [
  { value: "temporary", label: "Temporary account" },
  { value: "permanent", label: "Permanent account" },
];

const TEMPORARY_DURATION_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
];

const initialStudentForm = {
  name: "",
  email: "",
  studentId: "",
  gender: "",
  yearLevel: "",
  sectionName: "",
};

const initialAdminForm = {
  name: "",
  email: "",
  accountType: "temporary",
  temporaryDurationDays: "30",
};

const initialProfessorForm = {
  name: "",
  email: "",
  facultyId: "",
  department: "",
  employmentProof: null,
};

const STUDENT_IMPORT_ACCEPT = ".csv,.xlsx";
const PROFESSOR_PROOF_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const initialStudentImportStatus = {
  state: "idle",
  fileName: "",
  fileSize: 0,
  message: "",
  detail: "",
};

function getRoleGroup(role) {
  const value = String(role || "").toLowerCase();
  return value === "super_admin" || value === "admin" ? "admin" : value;
}

function isTemporaryExpired(user) {
  const isTemporary =
    user.isTemporary === true ||
    user.is_temporary === 1 ||
    user.is_temporary === true;
  const expiresAt =
    user.temporaryExpiresAt ||
    user.temporary_expires_at ||
    user.expiresAt ||
    user.expires_at;

  if (!isTemporary || !expiresAt) return false;

  const date = new Date(expiresAt);
  return !Number.isNaN(date.getTime()) && date <= new Date();
}

function getStatusFromUser(user) {
  const role = user.role || "student";
  const archived =
    user.isArchived === true ||
    user.is_archived === 1 ||
    user.is_archived === true ||
    user.status === "Archived";

  if (archived) return "Archived";
  if (isTemporaryExpired(user)) return "Expired";

  const verificationStatus = String(
    user.verificationStatus || user.verification_status || "",
  ).toLowerCase();
  const currentStatus = String(user.status || "").toLowerCase();

  if (
    role === "professor" &&
    (verificationStatus === "pending" || currentStatus === "pending")
  ) {
    return "Approving";
  }
  if (verificationStatus === "declined") return "Declined";

  return user.status || "Active";
}

function normalizeUser(user) {
  const displayName =
    user.name ||
    user.displayName ||
    user.display_name ||
    user.username ||
    "Unnamed User";
  const role = user.role || "student";
  const verificationStatus =
    user.verificationStatus ||
    user.verification_status ||
    (role === "professor" ? "pending" : "approved");
  const isTemporary =
    user.isTemporary === true ||
    user.is_temporary === 1 ||
    user.is_temporary === true;
  const temporaryExpiresAt =
    user.temporaryExpiresAt ||
    user.temporary_expires_at ||
    user.expiresAt ||
    user.expires_at ||
    "";
  const temporaryExpired =
    user.temporaryExpired === true ||
    user.temporary_expired === 1 ||
    user.temporary_expired === true ||
    isTemporaryExpired(user);

  return {
    id: user.id || user.userId || user.user_id || user.UserID || displayName,
    name: displayName,
    email: user.email || "No email found",
    role,
    status: getStatusFromUser(user),
    verificationStatus,
    joined: user.joined || user.created_at || user.createdAt || "",
    studentId: user.studentId || user.student_id || "",
    professorId: user.professorId || user.professor_id || "",
    professorFacultyId:
      user.professorFacultyId || user.professor_faculty_id || "",
    professorDepartment:
      user.professorDepartment || user.professor_department || "",

    professorPosition: user.professorPosition || user.professor_position || "",

    professorSpecialization:
      user.professorSpecialization || user.professor_specialization || "",

    professorEmploymentProof:
      user.professorEmploymentProof || user.professor_employment_proof || "",
    verified:
      user.verified === true ||
      user.is_verified === 1 ||
      user.is_verified === true ||
      user.isVerified === true,
    isArchived:
      user.isArchived === true ||
      user.is_archived === 1 ||
      user.is_archived === true ||
      user.status === "Archived",
    mustChangePassword:
      user.mustChangePassword === true ||
      user.must_change_password === 1 ||
      user.must_change_password === true,
    isTemporary,
    temporaryExpiresAt,
    temporaryExpired,
  };
}

function formatDate(value) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name) {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAuthToken() {
  return (
    localStorage.getItem("puffy-token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function getAuthHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getMultipartAuthHeaders() {
  const token = getAuthToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getTemporaryPayload(form) {
  const isTemporary = form.accountType === "temporary";

  return {
    isTemporary,
    temporaryDurationDays: isTemporary
      ? form.temporaryDurationDays || "30"
      : "",
  };
}

function withTemporaryAccountFields(payload) {
  return {
    ...payload,
    ...getTemporaryPayload(payload),
  };
}

function getAccountSecurityLabel(user) {
  if (user.temporaryExpired) return "Temporary expired";
  if (user.isTemporary)
    return `Temporary until ${formatDate(user.temporaryExpiresAt)}`;
  if (user.mustChangePassword) return "Temporary password";
  return user.verified ? "Email verified" : "Email pending";
}

function isUrl(value) {
  return /^(https?:\/\/|\/)/i.test(String(value || "").trim());
}

const IMAGE_PROOF_PATTERN = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

function getProofSource(value) {
  const proof = String(value || "").trim();

  if (!proof) return "";
  if (/^https?:\/\//i.test(proof) || proof.startsWith("/")) return proof;
  if (/^api\//i.test(proof)) return `/${proof}`;
  if (/^uploads\//i.test(proof)) return `${API_BASE}/${proof}`;

  return proof;
}

function isImageProof(value) {
  const proof = String(value || "").trim();

  return IMAGE_PROOF_PATTERN.test(proof) || /\/api\/uploads\//i.test(proof);
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function validateProfessorProofFile(file) {
  if (!file)
    return "Please upload a clear photo of the faculty or employee ID.";

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "The uploaded ID photo must not exceed 5 MB.";
  }

  return "";
}

function UserAvatar({ user, large = false }) {
  const initials = getInitials(user.name) || "?";
  return (
    <span className={large ? "users-modal-avatar" : "users-avatar"}>
      {initials}
    </span>
  );
}

function showSuccess(message, title = "Success") {
  return Swal.fire({
    icon: "success",
    title,
    text: message,
    confirmButtonText: "OK",
  });
}

function showError(message, title = "Error") {
  return Swal.fire({
    icon: "error",
    title,
    text: message,
    confirmButtonText: "OK",
  });
}

function showWarning(message, title = "Warning") {
  return Swal.fire({
    icon: "warning",
    title,
    text: message,
    confirmButtonText: "OK",
  });
}

function showInfo(message, title = "Information") {
  return Swal.fire({
    icon: "info",
    title,
    text: message,
    confirmButtonText: "OK",
  });
}

export default function SuperAdminUserManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get("tab");
    return VALID_USER_TAB_IDS.includes(requestedTab) ? requestedTab : "all";
  });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState(initialAdminForm);
  const [professorModalOpen, setProfessorModalOpen] = useState(false);
  const [professorForm, setProfessorForm] = useState(initialProfessorForm);
  const [professorProofPreview, setProfessorProofPreview] = useState("");
  const [creatingProfessor, setCreatingProfessor] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [studentImportStatus, setStudentImportStatus] = useState(
    initialStudentImportStatus,
  );
  const [credentialResults, setCredentialResults] = useState([]);
  const [busyUserId, setBusyUserId] = useState("");
  const studentImportBusy =
    studentImportStatus.state === "reading" ||
    studentImportStatus.state === "importing";

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/users`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("User API unavailable.");
      }

      const data = await response.json();
      const nextUsers = Array.isArray(data.users) ? data.users : [];

      setUsers(nextUsers.map(normalizeUser));
    } catch (error) {
      setUsers([]);
      showError(
        error.message ||
          "Could not load users from the database. Please make sure MySQL and the backend server are running.",
        "Could Not Load Users",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (studentModalOpen) {
      setStudentImportStatus(initialStudentImportStatus);
    }
  }, [studentModalOpen]);

  useEffect(() => {
    return () => {
      if (professorProofPreview) {
        URL.revokeObjectURL(professorProofPreview);
      }
    };
  }, [professorProofPreview]);

  useEffect(() => {
    if (
      studentImportStatus.state !== "success" &&
      studentImportStatus.state !== "partial"
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setStudentImportStatus(initialStudentImportStatus);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [studentImportStatus.state]);

  useEffect(() => {
    const requestedAction = searchParams.get("action");

    if (
      requestedAction !== "add-student" &&
      requestedAction !== "add-professor" &&
      requestedAction !== "add-admin"
    )
      return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");

    if (requestedAction === "add-student") {
      nextParams.set("tab", "students");
      setActiveTab("students");
      setStudentModalOpen(true);
    }

    if (requestedAction === "add-admin") {
      nextParams.set("tab", "admins");
      setActiveTab("admins");
      setAdminModalOpen(true);
    }

    if (requestedAction === "add-professor") {
      nextParams.set("tab", "professors");
      setActiveTab("professors");
      setProfessorModalOpen(true);
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const userGroups = useMemo(() => {
    const all = users;

    const approvals = users.filter(
      (user) =>
        user.role === "professor" &&
        String(user.verificationStatus).toLowerCase() === "pending" &&
        !user.isArchived,
    );

    const students = users.filter(
      (user) => user.role === "student" && !user.isArchived,
    );

    const professors = users.filter(
      (user) =>
        user.role === "professor" &&
        String(user.verificationStatus).toLowerCase() === "approved" &&
        !user.isArchived,
    );

    const admins = users.filter(
      (user) => user.role === "admin" && !user.isArchived,
    );

    const archived = users.filter((user) => user.isArchived);

    return {
      all,
      approvals,
      students,
      professors,
      admins,
      archived,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    const tabUsers = userGroups[activeTab] || userGroups.all;

    return tabUsers.filter((user) => {
      if (!search) return true;

      return [
        user.name,
        user.email,
        user.id,
        user.studentId,
        user.professorFacultyId,
        user.professorDepartment,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(search));
    });
  }, [activeTab, query, userGroups]);
  const pagination = useUserPagination(filteredUsers, activeTab, query);
  const visibleUsers = pagination.rows;

  const stats = useMemo(
    () => [
      { label: "All Users", value: users.length, icon: FiUsers },
      {
        label: "Temporary Accounts",
        value: users.filter((user) => user.isTemporary).length,
        icon: FiClock,
      },
      { label: "Students", value: userGroups.students.length, icon: FiUser },
      {
        label: "Administrators",
        value: userGroups.admins.length,
        icon: FiShield,
      },
    ],
    [userGroups, users.length],
  );

  const updateUserInList = (nextUser) => {
    const normalized = normalizeUser(nextUser);
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === normalized.id ? normalized : user,
      ),
    );
    setSelectedUser((currentUser) =>
      currentUser && currentUser.id === normalized.id
        ? normalized
        : currentUser,
    );
  };

  const removeUserFromList = (userId) => {
    setUsers((currentUsers) =>
      currentUsers.filter((user) => Number(user.id) !== Number(userId)),
    );
    setSelectedUser(null);
  };

  const resetProfessorForm = () => {
    setProfessorForm(initialProfessorForm);
    setProfessorProofPreview("");
  };

  const closeProfessorModal = () => {
    if (creatingProfessor) return;
    setProfessorModalOpen(false);
    resetProfessorForm();
  };

  const handleProfessorFieldChange = (fieldName) => (event) => {
    setProfessorForm((currentForm) => ({
      ...currentForm,
      [fieldName]: event.target.value,
    }));
  };

  const handleProfessorProofUpload = (event) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setProfessorForm((currentForm) => ({
        ...currentForm,
        employmentProof: null,
      }));
      setProfessorProofPreview("");
      return;
    }

    const fileError = validateProfessorProofFile(file);

    if (fileError) {
      event.target.value = "";
      setProfessorForm((currentForm) => ({
        ...currentForm,
        employmentProof: null,
      }));
      setProfessorProofPreview("");
      showWarning(fileError);
      return;
    }

    setProfessorForm((currentForm) => ({
      ...currentForm,
      employmentProof: file,
    }));
    setProfessorProofPreview(URL.createObjectURL(file));
  };

  const removeProfessorProofImage = () => {
    setProfessorForm((currentForm) => ({
      ...currentForm,
      employmentProof: null,
    }));
    setProfessorProofPreview("");
  };

  const renderAccountTypeFields = (form, setForm) => (
    <>
      <label>
        Account Type
        <select
          value={form.accountType}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              accountType: event.target.value,
            }))
          }
          required
        >
          {ACCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {form.accountType === "temporary" && (
        <label>
          Expires After
          <select
            value={form.temporaryDurationDays}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                temporaryDurationDays: event.target.value,
              }))
            }
          >
            {TEMPORARY_DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );

  const handleProfessorDecision = async (user, status) => {
    try {
      setBusyUserId(`${user.id}-${status}`);
      const response = await fetch(
        `${API_BASE}/users/${user.id}/registration`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update registration.");
      }

      updateUserInList(data.user);
      showSuccess(data.message);
    } catch (error) {
      showError(error.message || "Could not update registration.");
    } finally {
      setBusyUserId("");
    }
  };

  const handleArchiveToggle = async (user) => {
    const archive = !user.isArchived;

    try {
      setBusyUserId(`${user.id}-archive`);
      const response = await fetch(`${API_BASE}/users/${user.id}/archive`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ archive }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update account.");
      }

      updateUserInList(data.user);
      showSuccess(data.message);
    } catch (error) {
      showError(error.message || "Could not update account.");
    } finally {
      setBusyUserId("");
    }
  };

  const handleResetCredentials = async (user) => {
    try {
      setBusyUserId(`${user.id}-credentials`);
      const response = await fetch(
        `${API_BASE}/users/${user.id}/reset-credentials`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not generate credentials.");
      }

      setCredentialResults([
        {
          name: user.name,
          email: data.email || user.email,
          temporaryPassword: data.temporaryPassword,
          temporaryExpiresAt: user.temporaryExpiresAt,
        },
      ]);
      showSuccess("Temporary credentials generated.");
    } catch (error) {
      showError(error.message || "Could not generate credentials.");
    } finally {
      setBusyUserId("");
    }
  };

  const handlePermanentRemove = async (user) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Permanently Delete Account?",
      text: `${user.name} will be permanently removed. This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) return;

    try {
      setBusyUserId(`${user.id}-delete`);

      const response = await fetch(`${API_BASE}/users/${user.id}/archived`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not remove account.");
      }

      removeUserFromList(user.id);
      showSuccess(
        data.message || "The account was permanently removed.",
        "Account Deleted",
      );
    } catch (error) {
      showError(error.message || "Could not remove account.", "Delete Failed");
    } finally {
      setBusyUserId("");
    }
  };

  const createStudent = async (payload) => {
    const response = await fetch(`${API_BASE}/users/student`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(withTemporaryAccountFields(payload)),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not create student account.");
    }

    return data;
  };

  const handleCreateStudent = async (event) => {
    event.preventDefault();

    try {
      const data = await createStudent(studentForm);
      setUsers((currentUsers) => [normalizeUser(data.user), ...currentUsers]);
      setCredentialResults([
        {
          name: data.user.name,
          email: data.user.email,
          temporaryPassword: data.temporaryPassword,
          temporaryExpiresAt: data.user.temporaryExpiresAt,
        },
      ]);
      setStudentForm(initialStudentForm);
      setStudentModalOpen(false);
      showSuccess(data.message);
    } catch (error) {
      showError(error.message || "Could not create student account.");
    }
  };

  const handleCreateAdmin = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/users/admin`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(withTemporaryAccountFields(adminForm)),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not create admin account.");
      }

      setUsers((currentUsers) => [normalizeUser(data.user), ...currentUsers]);
      setCredentialResults([
        {
          name: data.user.name,
          email: data.user.email,
          temporaryPassword: data.temporaryPassword,
          temporaryExpiresAt: data.user.temporaryExpiresAt,
        },
      ]);
      setAdminForm(initialAdminForm);
      setAdminModalOpen(false);
      showSuccess(data.message);
    } catch (error) {
      showError(error.message || "Could not create admin account.");
    }
  };

  const handleCreateProfessor = async (event) => {
    event.preventDefault();

    if (creatingProfessor) return;

    const cleanName = professorForm.name.trim();
    const cleanEmail = professorForm.email.trim().toLowerCase();
    const cleanFacultyId = professorForm.facultyId.trim();
    const cleanDepartment = professorForm.department.trim();
    const proofError = validateProfessorProofFile(
      professorForm.employmentProof,
    );

    if (!cleanName) {
      showWarning("Professor full name is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showWarning("Please enter a valid professor email address.");
      return;
    }

    if (!cleanFacultyId) {
      showWarning("Employee or faculty ID is required.");
      return;
    }

    if (cleanFacultyId.length > 100) {
      showWarning("Employee or faculty ID must be 100 characters or fewer.");
      return;
    }

    if (!cleanDepartment) {
      showWarning("Department is required.");
      return;
    }

    if (proofError) {
      showWarning(proofError);
      return;
    }

    const formData = new FormData();
    formData.append("name", cleanName);
    formData.append("email", cleanEmail);
    formData.append("facultyId", cleanFacultyId);
    formData.append("department", cleanDepartment);
    formData.append("employmentProof", professorForm.employmentProof);

    try {
      setCreatingProfessor(true);

      const response = await fetch(`${API_BASE}/users/professor`, {
        method: "POST",
        headers: getMultipartAuthHeaders(),
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not create professor account.");
      }

      setUsers((currentUsers) => [normalizeUser(data.user), ...currentUsers]);
      setCredentialResults([
        {
          name: data.user.name,
          email: data.user.email,
          temporaryPassword: data.temporaryPassword,
          temporaryExpiresAt: data.user.temporaryExpiresAt,
        },
      ]);
      resetProfessorForm();
      setProfessorModalOpen(false);
      showSuccess("Professor account created.");
    } catch (error) {
      showError(error.message || "Could not create professor account.");
    } finally {
      setCreatingProfessor(false);
    }
  };

  /* =====================================================
     STUDENT BULK IMPORT
     Supports: CSV + XLSX

     Required columns:
     Name
     Email
     Student ID
     Gender
     Year Level
     Section
  ===================================================== */

  const normalizeImportHeader = (value) =>
    String(value || "")
      .replace(/^\ufeff/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  /* =====================================================
     CSV PARSER
  ===================================================== */

  const parseCsvRows = (text) => {
    const rows = [];

    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const nextCharacter = text[index + 1];

      if (character === '"') {
        if (inQuotes && nextCharacter === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }

        continue;
      }

      if (character === "," && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }

      if ((character === "\n" || character === "\r") && !inQuotes) {
        row.push(cell);
        rows.push(row);

        row = [];
        cell = "";

        if (character === "\r" && nextCharacter === "\n") {
          index += 1;
        }

        continue;
      }

      cell += character;
    }

    row.push(cell);
    rows.push(row);

    return rows;
  };

  /* =====================================================
     NORMALIZE GENDER
  ===================================================== */

  const normalizeImportedGender = (value) => {
    const gender = String(value || "")
      .trim()
      .toLowerCase();

    if (gender === "male") {
      return "Male";
    }

    if (gender === "female") {
      return "Female";
    }

    return "";
  };

  /* =====================================================
     NORMALIZE YEAR LEVEL
  ===================================================== */

  const normalizeImportedYearLevel = (value) => {
    const year = String(value || "")
      .trim()
      .toLowerCase();

    const yearMap = {
      1: "1st Year",
      "1st": "1st Year",
      "1styear": "1st Year",
      "1st year": "1st Year",
      first: "1st Year",
      firstyear: "1st Year",
      "first year": "1st Year",

      2: "2nd Year",
      "2nd": "2nd Year",
      "2ndyear": "2nd Year",
      "2nd year": "2nd Year",
      second: "2nd Year",
      secondyear: "2nd Year",
      "second year": "2nd Year",

      3: "3rd Year",
      "3rd": "3rd Year",
      "3rdyear": "3rd Year",
      "3rd year": "3rd Year",
      third: "3rd Year",
      thirdyear: "3rd Year",
      "third year": "3rd Year",

      4: "4th Year",
      "4th": "4th Year",
      "4thyear": "4th Year",
      "4th year": "4th Year",
      fourth: "4th Year",
      fourthyear: "4th Year",
      "fourth year": "4th Year",
    };

    return yearMap[year] || "";
  };

  /* =====================================================
     NORMALIZE SECTION
  ===================================================== */

  const normalizeImportedSection = (value) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

  /* =====================================================
     GET EXPECTED YEAR NUMBER

     1st Year -> 1
     2nd Year -> 2
     etc.
  ===================================================== */

  const getImportedYearNumber = (yearLevel) => {
    const match = String(yearLevel || "").match(/^([1-4])/);

    return match ? match[1] : "";
  };

  /* =====================================================
     NORMALIZE IMPORTED ROWS
  ===================================================== */

  const normalizeStudentImportRows = (rows) => {
    const sourceRows = Array.isArray(rows) ? rows : [];

    const cleanedRows = sourceRows
      .map((row) => {
        if (Array.isArray(row)) {
          return row;
        }

        if (row && typeof row === "object") {
          return Object.values(row);
        }

        return [row];
      })
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some(Boolean));

    if (cleanedRows.length === 0) {
      return [];
    }

    const header = cleanedRows[0].map(normalizeImportHeader);

    const headerAliases = [
      "email",
      "emailaddress",
      "studentemail",

      "name",
      "fullname",
      "studentname",

      "studentid",
      "studentnumber",
      "studentno",

      "gender",
      "sex",

      "year",
      "yearlevel",

      "section",
      "sectionname",
    ];

    const hasHeader = header.some((cell) => headerAliases.includes(cell));

    const dataRows = hasHeader ? cleanedRows.slice(1) : cleanedRows;

    const headerCells = hasHeader ? header : [];

    const indexOf = (names, fallback) => {
      if (!hasHeader) {
        return fallback;
      }

      const normalizedNames = names.map((name) => normalizeImportHeader(name));

      const index = headerCells.findIndex((cell) =>
        normalizedNames.includes(normalizeImportHeader(cell)),
      );

      return index >= 0 ? index : fallback;
    };

    return dataRows
      .map((row, rowIndex) => {
        const rawGender = row[indexOf(["gender", "sex"], 3)] || "";

        const rawYearLevel =
          row[
            indexOf(
              ["year", "yearlevel", "studentyear", "grade", "gradelevel"],
              4,
            )
          ] || "";

        const rawSection =
          row[
            indexOf(["section", "sectionname", "studentsection", "block"], 5)
          ] || "";

        return {
          sourceRow: rowIndex + (hasHeader ? 2 : 1),

          name: row[indexOf(["name", "fullname", "studentname"], 0)] || "",

          email:
            row[indexOf(["email", "emailaddress", "studentemail"], 1)] || "",

          studentId: String(
            row[
              indexOf(
                [
                  "studentid",
                  "student id",
                  "student_id",
                  "studentnumber",
                  "student number",
                  "studentno",
                  "student no",
                  "id",
                  "idnumber",
                  "id number",
                  "schoolid",
                  "school id",
                ],
                2,
              )
            ] ?? "",
          ).trim(),

          gender: normalizeImportedGender(rawGender),

          rawGender,

          yearLevel: normalizeImportedYearLevel(rawYearLevel),

          rawYearLevel,

          sectionName: normalizeImportedSection(rawSection),

          rawSection,
        };
      })
      .filter(
        (student) =>
          student.name ||
          student.email ||
          student.studentId ||
          student.rawGender ||
          student.rawYearLevel ||
          student.rawSection,
      );
  };

  /* =====================================================
     PARSE CSV
  ===================================================== */

  const parseStudentCsv = (text) => {
    return normalizeStudentImportRows(parseCsvRows(text));
  };

  /* =====================================================
     PARSE CSV / XLSX FILE
  ===================================================== */

  const parseStudentImportFile = async (file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "xlsx") {
      const readXlsxFile = (await import("read-excel-file/browser")).default;

      const result = await readXlsxFile(file);

      console.log("===== RAW EXCEL RESULT =====", result);

      /*
        Some versions/configurations return:

        [
          {
            sheet: 'Students',
            data: [...]
          }
        ]

        while others return the rows directly.
      */

      let rows = result;

      if (
        Array.isArray(result) &&
        result.length > 0 &&
        result[0] &&
        typeof result[0] === "object" &&
        !Array.isArray(result[0]) &&
        Array.isArray(result[0].data)
      ) {
        rows = result[0].data;
      }

      console.log("===== EXTRACTED EXCEL ROWS =====", rows);

      const normalizedStudents = normalizeStudentImportRows(rows);

      console.log("===== NORMALIZED STUDENTS =====", normalizedStudents);

      return normalizedStudents;
    }

    const text = await file.text();

    return parseStudentCsv(text);
  };

  /* =====================================================
     SUPPORTED FILE CHECK
  ===================================================== */

  const isSupportedStudentImportFile = (file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    return extension === "csv" || extension === "xlsx";
  };

  /* =====================================================
     FORMAT BACKEND FAILURE
  ===================================================== */

  const formatStudentImportFailure = (student, fallbackMessage) => {
    const email = String(student.email || "").trim();

    const message = String(fallbackMessage || "").trim();

    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("email is already registered")) {
      return `- Row ${student.sourceRow}: Email "${email}" is already registered.`;
    }

    if (normalizedMessage.includes("student id is already registered")) {
      return `- Row ${student.sourceRow}: Student ID "${student.studentId}" is already registered.`;
    }

    return (
      `- Row ${student.sourceRow}: ` +
      (message || "This student could not be imported.")
    );
  };

  /* =====================================================
     VALIDATE ONE IMPORTED STUDENT
  ===================================================== */

  const validateImportedStudent = (student) => {
    const name = String(student.name || "").trim();

    const email = String(student.email || "")
      .trim()
      .toLowerCase();

    const studentId = String(student.studentId || "").trim();

    const rawGender = String(student.rawGender || "").trim();

    const rawYearLevel = String(student.rawYearLevel || "").trim();

    const rawSection = String(student.rawSection || "").trim();

    const gender = normalizeImportedGender(rawGender);

    const yearLevel = normalizeImportedYearLevel(rawYearLevel);

    const sectionName = normalizeImportedSection(rawSection);

    /* -------------------------
       REQUIRED FIELDS
    ------------------------- */

    if (!name) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Student name is required.`,
      };
    }

    if (!email) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Student email is required.`,
      };
    }

    if (!studentId) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Student ID is required.`,
      };
    }

    if (!rawGender) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Gender is required.`,
      };
    }

    if (!rawYearLevel) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Year level is required.`,
      };
    }

    if (!rawSection) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Section is required.`,
      };
    }

    /* -------------------------
       EMAIL
    ------------------------- */

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: "${email}" is not a valid email address.`,
      };
    }

    /* -------------------------
       GENDER
    ------------------------- */

    if (!gender) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Gender must be Male or Female.`,
      };
    }

    /* -------------------------
       YEAR LEVEL
    ------------------------- */

    if (!yearLevel) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Year level must be 1st Year, 2nd Year, 3rd Year, or 4th Year.`,
      };
    }

    /* -------------------------
       SECTION
    ------------------------- */

    const yearNumber = getImportedYearNumber(yearLevel);

    const allowedSections = [
      `${yearNumber}A`,
      `${yearNumber}B`,
      `${yearNumber}C`,
      `${yearNumber}D`,
      `${yearNumber}E`,
      `${yearNumber}F`,
    ];

    if (!allowedSections.includes(sectionName)) {
      return {
        valid: false,
        message: `Row ${student.sourceRow}: Section must be ${yearNumber}A-${yearNumber}F for ${yearLevel}.`,
      };
    }

    /* -------------------------
       NORMALIZED STUDENT
    ------------------------- */

    return {
      valid: true,

      student: {
        name,
        email,
        studentId,
        gender,
        yearLevel,
        sectionName,

        /*
          Bulk-created students use the
          same account behavior as the
          Add Student form.
        */
        accountType: "permanent",
        temporaryDurationDays: "",
      },
    };
  };

  /* =====================================================
     IMPORT BUTTON
  ===================================================== */

  const handleImportStudentsClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (studentImportBusy) {
      return;
    }

    fileInputRef.current?.click();
  };

  /* =====================================================
     CLOSE STUDENT MODAL
  ===================================================== */

  const closeStudentModal = () => {
    if (studentImportBusy) {
      return;
    }

    setStudentModalOpen(false);
  };

  /* =====================================================
     DISMISS IMPORT STATUS
  ===================================================== */

  const dismissStudentImportPopup = () => {
    if (studentImportBusy) {
      return;
    }

    setStudentImportStatus(initialStudentImportStatus);
  };

  /* =====================================================
     BULK IMPORT
  ===================================================== */
  const logBulkStudentImport = async ({
    fileName,
    importedCount,
    failedCount,
    totalCount,
  }) => {
    try {
      const response = await fetch(
        `${API_BASE}/users/student/bulk-import-audit`,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            fileName,
            importedCount,
            failedCount,
            totalCount,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not record bulk import audit.");
      }
    } catch (error) {
      /*
      Audit failure should NOT make the actual
      student import appear to have failed.
    */
      console.error("Bulk import audit error:", error);
    }
  };
  const handleBulkImport = async (event) => {
    const file = event.target.files?.[0];

    /*
      Allow selecting the same file again
      after an import.
    */
    event.target.value = "";

    if (!file) {
      return;
    }

    /* -------------------------
       FILE TYPE
    ------------------------- */

    if (!isSupportedStudentImportFile(file)) {
      setStudentImportStatus({
        state: "error",
        fileName: file.name,
        fileSize: file.size,
        message: "This file type is not supported.",
        detail: "- Only .csv and .xlsx Excel files can be imported.",
      });

      showError("Only CSV and XLSX files can be imported.", "Unsupported File");

      return;
    }

    /* -------------------------
       READING
    ------------------------- */

    setStudentImportStatus({
      state: "reading",
      fileName: file.name,
      fileSize: file.size,
      message: "Reading student file...",
      detail: "",
    });

    try {
      const students = await parseStudentImportFile(file);

      /* -------------------------
         EMPTY FILE
      ------------------------- */

      if (students.length === 0) {
        setStudentImportStatus({
          state: "error",
          fileName: file.name,
          fileSize: file.size,
          message: "No student records found in this file.",
          detail:
            "Required columns: Name, Email, Student ID, Gender, Year Level, Section.",
        });

        showError("Import file has no student records.", "Import Failed");

        return;
      }

      /* -------------------------
         RESULTS
      ------------------------- */

      const createdUsers = [];
      const credentials = [];
      const failures = [];

      /*
        Used to catch duplicates inside
        the uploaded file itself.
      */
      const seenEmails = new Set();
      const seenStudentIds = new Set();

      /* =================================================
         PROCESS EACH STUDENT
      ================================================= */

      for (let index = 0; index < students.length; index += 1) {
        const student = students[index];

        setStudentImportStatus({
          state: "importing",
          fileName: file.name,
          fileSize: file.size,

          message: `Importing ${index + 1} of ${students.length} student records...`,

          detail:
            `${createdUsers.length} imported, ` +
            `${failures.length} failed so far.`,
        });

        /* -------------------------
           VALIDATION
        ------------------------- */

        const validation = validateImportedStudent(student);

        if (!validation.valid) {
          failures.push(`- ${validation.message}`);

          continue;
        }

        const normalizedStudent = validation.student;

        /* -------------------------
           DUPLICATE EMAIL IN FILE
        ------------------------- */

        const emailKey = normalizedStudent.email.toLowerCase();

        if (seenEmails.has(emailKey)) {
          failures.push(
            `- Row ${student.sourceRow}: Email "${normalizedStudent.email}" appears more than once in the file.`,
          );

          continue;
        }

        /* -------------------------
           DUPLICATE STUDENT ID
           IN FILE
        ------------------------- */

        const studentIdKey = normalizedStudent.studentId.toLowerCase();

        if (seenStudentIds.has(studentIdKey)) {
          failures.push(
            `- Row ${student.sourceRow}: Student ID "${normalizedStudent.studentId}" appears more than once in the file.`,
          );

          continue;
        }

        seenEmails.add(emailKey);
        seenStudentIds.add(studentIdKey);

        /* -------------------------
           CREATE ACCOUNT
        ------------------------- */

        try {
          const data = await createStudent(normalizedStudent);

          createdUsers.push(normalizeUser(data.user));

          credentials.push({
            name: data.user.name,
            email: data.user.email,
            temporaryPassword: data.temporaryPassword,
            temporaryExpiresAt: data.user.temporaryExpiresAt,
          });
        } catch (error) {
          failures.push(
            formatStudentImportFailure(
              {
                ...student,
                ...normalizedStudent,
              },
              error.message || "Could not create student.",
            ),
          );
        }
      }

      /* =================================================
         NOTHING IMPORTED
      ================================================= */

      if (createdUsers.length === 0) {
        const detail = failures.slice(0, 5).join("\n");

        setStudentImportStatus({
          state: "error",
          fileName: file.name,
          fileSize: file.size,
          message: "No student accounts were imported.",
          detail: detail || "Please check the student records and try again.",
        });

        showError(
          detail || "No student accounts were imported.",
          "Import Failed",
        );

        return;
      }

      /* =================================================
         SUCCESS / PARTIAL SUCCESS
      ================================================= */

      const importMessage =
        failures.length > 0
          ? `${createdUsers.length} imported, ${failures.length} failed.`
          : `${createdUsers.length} student account${
              createdUsers.length === 1 ? "" : "s"
            } imported successfully.`;

      setStudentImportStatus({
        state: failures.length > 0 ? "partial" : "success",

        fileName: file.name,
        fileSize: file.size,
        message: importMessage,

        detail:
          failures.length > 0
            ? failures.slice(0, 5).join("\n")
            : `${createdUsers.length} student account${
                createdUsers.length === 1 ? "" : "s"
              } created.`,
      });

      /* -------------------------
         UPDATE USER TABLE
      ------------------------- */

      setUsers((currentUsers) => [...createdUsers, ...currentUsers]);

      /* -------------------------
         TEMPORARY CREDENTIALS
      ------------------------- */

      setCredentialResults(credentials);

      /* -------------------------
          BULK IMPORT AUDIT
        ------------------------- */

      await logBulkStudentImport({
        fileName: file.name,
        importedCount: createdUsers.length,
        failedCount: failures.length,
        totalCount: students.length,
      });

      /* -------------------------
         CLOSE ADD STUDENT MODAL
      ------------------------- */

      setStudentModalOpen(false);

      /* -------------------------
         PAGE NOTICE
      ------------------------- */

      if (failures.length === 0) {
        showSuccess(
          `${createdUsers.length} student account${
            createdUsers.length === 1 ? "" : "s"
          } successfully imported.`,
          "Import Complete",
        );
      }
    } catch (error) {
      console.error("Bulk student import error:", error);

      setStudentImportStatus({
        state: "error",
        fileName: file.name,
        fileSize: file.size,
        message: "Could not import this file.",
        detail:
          error.message || "Please check the CSV or Excel file and try again.",
      });

      showError(error.message || "Could not import students.", "Import Failed");
    }
  };

  const copyCredentials = async () => {
    const text = credentialResults
      .map((item) => {
        const expiry = item.temporaryExpiresAt
          ? `expires ${formatDate(item.temporaryExpiresAt)}`
          : "permanent account";

        return `${item.name}, ${item.email}, ${item.temporaryPassword}, ${expiry}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);

      await Swal.fire({
        icon: "success",
        title: "Credentials Copied",
        text: "Temporary credentials were copied to the clipboard.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch {
      showError("Could not copy temporary credentials.", "Copy Failed");
    }
  };

  const renderProof = (user, { compact = false } = {}) => {
    const proof = user.professorEmploymentProof;
    const proofSrc = getProofSource(proof);

    if (!proofSrc) return "Not submitted";

    if (isUrl(proofSrc) && isImageProof(proofSrc)) {
      if (compact) {
        return (
          <a
            className="users-proof-cell"
            href={proofSrc}
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="users-proof-thumb"
              src={proofSrc}
              alt={`${user.name || "Professor"} proof thumbnail`}
              loading="lazy"
            />
            <span>View proof</span>
          </a>
        );
      }

      return (
        <a
          className="users-proof-preview"
          href={proofSrc}
          target="_blank"
          rel="noreferrer"
        >
          <img
            className="users-proof-image"
            src={proofSrc}
            alt={`${user.name || "Professor"} employment proof`}
            loading="lazy"
          />
        </a>
      );
    }

    if (isUrl(proofSrc)) {
      return (
        <a href={proofSrc} target="_blank" rel="noreferrer">
          View proof
        </a>
      );
    }

    return proof;
  };

  const renderApprovalActions = (user) => (
    <div className="users-action-group">
      <button
        className="users-icon-btn users-view-btn"
        type="button"
        onClick={() => setSelectedUser(user)}
        title="Review account"
      >
        <FiEye />
        <span>View</span>
      </button>

      {user.role !== "super_admin" && (
        <>
          <button
            className="users-icon-btn users-reset-btn"
            type="button"
            onClick={() => handleResetCredentials(user)}
            disabled={busyUserId === `${user.id}-credentials`}
            title="Reset account credentials"
          >
            <FiRefreshCw />
            <span>
              {busyUserId === `${user.id}-credentials`
                ? "Resetting..."
                : "Reset"}
            </span>
          </button>

          <button
            className="users-icon-btn users-archive-btn"
            type="button"
            onClick={() => handleArchiveToggle(user)}
            disabled={busyUserId === `${user.id}-archive`}
            title={user.isArchived ? "Restore account" : "Archive account"}
          >
            <FiArchive />
            <span>{user.isArchived ? "Restore" : "Archive"}</span>
          </button>
        </>
      )}
    </div>
  );

  const renderApprovalStatus = (user) => {
    const verificationStatus = String(
      user.verificationStatus || "",
    ).toLowerCase();

    let label = "Pending";

    if (verificationStatus === "approved") {
      label = "Approved";
    } else if (verificationStatus === "declined") {
      label = "Declined";
    } else if (verificationStatus === "pending") {
      label = "Pending";
    }

    return (
      <span className={`users-status is-${label.toLowerCase()}`}>{label}</span>
    );
  };

  const renderGenericRows = (rows) =>
    rows.map((user) => {
      const status = String(user.status).toLowerCase();

      return (
        <tr key={user.id}>
          <td>
            <div className="users-person">
              <UserAvatar user={user} />
              <div>
                <strong>{user.name}</strong>
                <small>ID: {user.id}</small>
              </div>
            </div>
          </td>
          <td>{user.email}</td>
          <td>
            <span className="users-role">{titleCase(user.role)}</span>
          </td>
          <td>
            <span className={`users-status is-${status}`}>
              {titleCase(user.status)}
            </span>
          </td>
          <td>{formatDate(user.joined)}</td>
          <td>{getAccountSecurityLabel(user)}</td>
          <td>
            <div className="users-action-group">
              <button
                className="users-icon-btn users-view-btn"
                type="button"
                onClick={() => setSelectedUser(user)}
                title="Review account"
              >
                <FiEye />
                <span>View</span>
              </button>
              {user.role !== "super_admin" && (
                <button
                  className="users-icon-btn users-archive-btn"
                  type="button"
                  onClick={() => handleArchiveToggle(user)}
                  disabled={busyUserId === `${user.id}-archive`}
                  title={
                    user.isArchived ? "Restore account" : "Archive account"
                  }
                >
                  <FiArchive />
                  <span>{user.isArchived ? "Restore" : "Archive"}</span>
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    });

  const renderUserTable = () => {
    if (loading) {
      return (
        <tbody>
          <tr>
            <td className="users-empty" colSpan="8">
              Loading users...
            </td>
          </tr>
        </tbody>
      );
    }

    if (visibleUsers.length === 0) {
      return (
        <tbody>
          <tr>
            <td className="users-empty" colSpan="8">
              No records found.
            </td>
          </tr>
        </tbody>
      );
    }

    if (activeTab === "approvals") {
      return (
        <tbody>
          {visibleUsers.map((user) => (
            <tr key={user.id}>
              <td>
                <strong>{user.name}</strong>
              </td>
              <td>{user.email}</td>
              <td>{user.professorFacultyId || "Not submitted"}</td>
              <td>{user.professorDepartment || "Not submitted"}</td>
              <td>{renderProof(user, { compact: true })}</td>
              <td>{formatDate(user.joined)}</td>
              <td>{renderApprovalStatus(user)}</td>
              <td>{renderApprovalActions(user)}</td>
            </tr>
          ))}
        </tbody>
      );
    }

    if (activeTab === "students") {
      return (
        <tbody>
          {visibleUsers.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="users-person">
                  <UserAvatar user={user} />
                  <div>
                    <strong>{user.name}</strong>
                    <small>{user.studentId || "No student ID"}</small>
                  </div>
                </div>
              </td>
              <td>{user.email}</td>
              <td>{getAccountSecurityLabel(user)}</td>
              <td>
                <span
                  className={`users-status is-${String(user.status).toLowerCase()}`}
                >
                  {titleCase(user.status)}
                </span>
              </td>
              <td>{formatDate(user.joined)}</td>
              <td>
                <div className="users-action-group">
                  <button
                    className="users-icon-btn users-view-btn"
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    title="Review student"
                  >
                    <FiEye />
                    <span>View</span>
                  </button>
                  <button
                    className="users-icon-btn users-reset-btn"
                    type="button"
                    onClick={() => handleResetCredentials(user)}
                    disabled={busyUserId === `${user.id}-credentials`}
                    title="Resend account credentials"
                  >
                    <FiRefreshCw />
                    <span>Reset</span>
                  </button>
                  <button
                    className="users-icon-btn users-archive-btn"
                    type="button"
                    onClick={() => handleArchiveToggle(user)}
                    disabled={busyUserId === `${user.id}-archive`}
                    title={
                      user.isArchived ? "Restore account" : "Archive account"
                    }
                  >
                    <FiArchive />
                    <span>{user.isArchived ? "Restore" : "Archive"}</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      );
    }

    if (activeTab === "archived") {
      return (
        <tbody>
          {visibleUsers.map((user) => (
            <tr key={user.id}>
              <td>
                <strong>{user.name}</strong>
              </td>
              <td>{user.email}</td>
              <td>{titleCase(user.role)}</td>
              <td>{formatDate(user.joined)}</td>
              <td>
                <div className="users-action-group">
                  <button
                    className="users-icon-btn users-archive-btn"
                    type="button"
                    onClick={() => handleArchiveToggle(user)}
                    title="Restore account"
                  >
                    <FiArchive />
                    <span>Restore</span>
                  </button>
                  <button
                    className="users-icon-btn users-decline-btn"
                    type="button"
                    onClick={() => handlePermanentRemove(user)}
                    title="Permanently remove"
                  >
                    <FiTrash2 />
                    <span>Delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      );
    }

    return <tbody>{renderGenericRows(visibleUsers)}</tbody>;
  };

  const tableHeaders =
    activeTab === "approvals"
      ? [
          "Full Name",
          "Email Address",
          "Employee or Faculty ID",
          "Department",
          "Submitted Proof",
          "Registration Date",
          "Status",
          "Actions",
        ]
      : activeTab === "students"
        ? ["Student", "Email", "Credentials", "Status", "Registered", "Actions"]
        : activeTab === "archived"
          ? ["Account", "Email", "Role", "Registration Date", "Actions"]
          : ["User", "Email", "Role", "Status", "Joined", "Security", "Action"];

  const studentImportPopupTitle =
    studentImportStatus.state === "reading"
      ? "Uploading file"
      : studentImportStatus.state === "importing"
        ? "Importing students"
        : studentImportStatus.state === "success" ||
            studentImportStatus.state === "partial"
          ? "Done"
          : studentImportStatus.state === "error"
            ? "Import failed"
            : "";

  return (
    <div className="users-page">
      {studentImportStatus.state !== "idle" && (
        <aside
          className={`student-import-popup is-${studentImportStatus.state}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="student-import-popup-icon">
            {studentImportStatus.state === "success" ? (
              <FiCheck />
            ) : studentImportStatus.state === "error" ? (
              <FiX />
            ) : studentImportStatus.state === "partial" ? (
              <FiFileText />
            ) : (
              <FiClock />
            )}
          </span>
          <div className="student-import-popup-copy">
            <strong>{studentImportPopupTitle}</strong>
            <p>{studentImportStatus.message}</p>
            {studentImportStatus.fileName && (
              <span>
                {studentImportStatus.fileName} -{" "}
                {formatFileSize(studentImportStatus.fileSize)}
              </span>
            )}
            {studentImportStatus.detail && (
              <small>{studentImportStatus.detail}</small>
            )}
          </div>
          {!studentImportBusy && (
            <button
              className="student-import-popup-dismiss"
              type="button"
              onClick={dismissStudentImportPopup}
              aria-label="Dismiss import status"
            >
              <FiX />
            </button>
          )}
        </aside>
      )}

      <div className="users-page-header super-page-heading">
        <div>
          <h1>User Management</h1>
          <p>
            Manage accounts, professor approvals, student credentials, and
            archived users.
          </p>
        </div>

        <div className="users-header-actions">
          <button
            className="users-create-btn"
            type="button"
            onClick={() => setAdminModalOpen(true)}
          >
            <FiShield />
            Add Admin
          </button>
          <button
            className="users-create-btn"
            type="button"
            onClick={() => setProfessorModalOpen(true)}
          >
            <FiUserPlus />
            Add Professor
          </button>
          <button
            className="users-create-btn"
            type="button"
            onClick={() => setStudentModalOpen(true)}
          >
            <FiPlus />
            Add Student
          </button>
        </div>
      </div>

      <div className="users-stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="users-stat-card" key={stat.label}>
              <div className="users-stat-icon">
                <Icon />
              </div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          );
        })}
      </div>

      <>
        <div
          className="user-management-tabs"
          aria-label="User management sections"
        >
          {USER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="users-panel">
        <div className="users-panel-top">
          <div>
            <h2>{USER_TABS.find((tab) => tab.id === activeTab)?.label}</h2>
            <p>
              {pagination.range} records shown
            </p>
          </div>

          <label className="users-search">
            <FiSearch />
            <input
              type="text"
              placeholder="Search users..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                {tableHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            {renderUserTable()}
          </table>
        </div>
        <UserPagination pagination={pagination} loading={loading} />
      </section>
      </>

      {credentialResults.length > 0 && (
        <div
          className="users-modal-backdrop"
          onClick={() => setCredentialResults([])}
        >
          <section
            className="users-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="users-modal-close"
              type="button"
              onClick={() => setCredentialResults([])}
              aria-label="Close credentials"
            >
              x
            </button>
            <div className="users-modal-profile">
              <span className="users-modal-avatar">
                <FiKey />
              </span>
              <div>
                <h2>Temporary Credentials</h2>
                <p>
                  Share these with users. Temporary accounts stop working after
                  their expiry date.
                </p>
              </div>
            </div>

            <div className="credential-result-list">
              {credentialResults.map((item) => (
                <div
                  className="users-temp-box"
                  key={`${item.email}-${item.temporaryPassword}`}
                >
                  <span>
                    {item.name} - {item.email}
                  </span>
                  <code>{item.temporaryPassword}</code>
                  <span>
                    {item.temporaryExpiresAt
                      ? `Temporary account expires ${formatDate(item.temporaryExpiresAt)}`
                      : "Permanent account"}
                  </span>
                </div>
              ))}
            </div>

            <button
              className="users-submit-btn"
              type="button"
              onClick={copyCredentials}
            >
              Copy Credentials
            </button>
          </section>
        </div>
      )}

      {adminModalOpen && (
        <div
          className="users-modal-backdrop"
          onClick={() => setAdminModalOpen(false)}
        >
          <section
            className="users-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="users-modal-close"
              type="button"
              onClick={() => setAdminModalOpen(false)}
              aria-label="Close admin form"
            >
              x
            </button>
            <div className="users-modal-profile">
              <span className="users-modal-avatar">
                <FiShield />
              </span>
              <div>
                <h2>Add Administrator</h2>
                <p>
                  Create an admin account with generated credentials and
                  optional expiry.
                </p>
              </div>
            </div>
            <form className="users-student-form" onSubmit={handleCreateAdmin}>
              <label>
                Admin Name
                <input
                  type="text"
                  value={adminForm.name}
                  onChange={(event) =>
                    setAdminForm((form) => ({
                      ...form,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Admin Email
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(event) =>
                    setAdminForm((form) => ({
                      ...form,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              {renderAccountTypeFields(adminForm, setAdminForm)}
              <button className="users-submit-btn" type="submit">
                Create Admin Account
              </button>
            </form>
          </section>
        </div>
      )}

      {professorModalOpen && (
        <div className="users-modal-backdrop" onClick={closeProfessorModal}>
          <section
            className="users-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="users-modal-close"
              type="button"
              onClick={closeProfessorModal}
              disabled={creatingProfessor}
              aria-label="Close professor form"
            >
              x
            </button>
            <div className="users-modal-profile">
              <span className="users-modal-avatar">
                <FiFileText />
              </span>
              <div>
                <h2>Add Professor</h2>
                <p>
                  Fill in the same professor registration details and upload
                  their school ID.
                </p>
              </div>
            </div>
            <form
              className="users-student-form professor-registration-form"
              onSubmit={handleCreateProfessor}
            >
              <label>
                Full Name
                <input
                  type="text"
                  value={professorForm.name}
                  onChange={handleProfessorFieldChange("name")}
                  placeholder="Enter professor full name"
                  disabled={creatingProfessor}
                  autoComplete="name"
                  required
                />
              </label>

              <label>
                Email Address
                <input
                  type="email"
                  value={professorForm.email}
                  onChange={handleProfessorFieldChange("email")}
                  placeholder="Enter professor email"
                  disabled={creatingProfessor}
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Employee or Faculty ID
                <input
                  type="text"
                  value={professorForm.facultyId}
                  onChange={handleProfessorFieldChange("facultyId")}
                  placeholder="Enter employee or faculty ID"
                  disabled={creatingProfessor}
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Department
                <select
                  value={professorForm.department}
                  onChange={handleProfessorFieldChange("department")}
                  disabled={creatingProfessor}
                  required
                >
                  <option value="">Select professor department</option>
                  <option value="Computer Science Department">
                    Computer Science Department
                  </option>
                  <option value="Information Technology Department">
                    Information Technology Department
                  </option>
                </select>
              </label>

              <div className="users-form-field professor-proof-field">
                <label
                  className="users-form-label"
                  htmlFor="superadmin-professor-proof"
                >
                  Upload Faculty or Employee ID
                </label>

                <p className="professor-proof-description">
                  Upload a clear photo of the front of their valid school
                  faculty or employee ID. Accepted formats are JPG, PNG, and
                  WEBP, up to 5 MB.
                </p>

                <div className="professor-proof-upload-area">
                  <input
                    id="superadmin-professor-proof"
                    type="file"
                    accept={PROFESSOR_PROOF_ACCEPT}
                    className="professor-proof-file-input"
                    disabled={creatingProfessor}
                    onChange={handleProfessorProofUpload}
                    required
                  />

                  <label
                    className="users-secondary-btn professor-proof-upload-btn"
                    htmlFor="superadmin-professor-proof"
                  >
                    <FiUpload />
                    {professorForm.employmentProof
                      ? "Change ID Photo"
                      : "Choose ID Photo"}
                  </label>

                  {professorForm.employmentProof && (
                    <span className="professor-proof-file-name">
                      {professorForm.employmentProof.name}
                    </span>
                  )}
                </div>

                {professorProofPreview && (
                  <div className="professor-proof-preview">
                    <img
                      src={professorProofPreview}
                      alt="Uploaded faculty or employee ID preview"
                    />

                    <button
                      type="button"
                      disabled={creatingProfessor}
                      onClick={removeProfessorProofImage}
                    >
                      <FiX />
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              <button
                className="users-submit-btn"
                type="submit"
                disabled={creatingProfessor}
              >
                {creatingProfessor
                  ? "Creating Professor..."
                  : "Create Professor Account"}
              </button>
            </form>
          </section>
        </div>
      )}

      {studentModalOpen && (
        <div className="users-modal-backdrop" onClick={closeStudentModal}>
          <section
            className="users-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="users-modal-close"
              type="button"
              onClick={closeStudentModal}
              disabled={studentImportBusy}
              aria-label="Close student form"
            >
              x
            </button>
            <div className="users-modal-profile">
              <span className="users-modal-avatar">
                <FiUser />
              </span>
              <div>
                <h2>Add Student</h2>
                <p>
                  Create a permanent student account with generated credentials.
                </p>
              </div>
            </div>
            <div className="student-import-panel">
              <div>
                <strong>Bulk Import Students</strong>
                <p>
                  Upload a CSV or Excel file with name, email, student ID, year
                  level, and section columns.
                </p>
              </div>
              <button
                className="users-secondary-btn"
                type="button"
                formNoValidate
                disabled={studentImportBusy}
                onClick={handleImportStudentsClick}
              >
                <FiUpload />
                Import CSV or Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={STUDENT_IMPORT_ACCEPT}
                hidden
                onChange={handleBulkImport}
              />
            </div>
            <form className="users-student-form" onSubmit={handleCreateStudent}>
              <label>
                Student Name
                <input
                  type="text"
                  value={studentForm.name}
                  onChange={(event) =>
                    setStudentForm((form) => ({
                      ...form,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Student Email
                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(event) =>
                    setStudentForm((form) => ({
                      ...form,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Student ID
                <input
                  type="text"
                  value={studentForm.studentId}
                  onChange={(event) =>
                    setStudentForm((form) => ({
                      ...form,
                      studentId: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Gender
                <select
                  value={studentForm.gender}
                  onChange={(event) =>
                    setStudentForm((form) => ({
                      ...form,
                      gender: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>

              <label>
                Year Level
                <select
                  value={studentForm.yearLevel}
                  onChange={(event) =>
                    setStudentForm((form) => ({
                      ...form,
                      yearLevel: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </label>

              <label>
                Section
                <input
                  type="text"
                  value={studentForm.sectionName}
                  onChange={(event) =>
                    setStudentForm((form) => ({
                      ...form,
                      sectionName: event.target.value,
                    }))
                  }
                  placeholder="Example: 1A"
                  required
                />
              </label>

              <button className="users-submit-btn" type="submit">
                Create Student Account
              </button>
            </form>
          </section>
        </div>
      )}

      {selectedUser && (
        <div
          className="users-modal-backdrop"
          onClick={() => setSelectedUser(null)}
        >
          <section
            className="users-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="users-modal-close"
              type="button"
              onClick={() => setSelectedUser(null)}
              aria-label="Close user details"
            >
              x
            </button>
            <div className="users-modal-profile">
              <UserAvatar user={selectedUser} large />
              <div>
                <h2>{selectedUser.name}</h2>
                <p>{selectedUser.email}</p>
              </div>
            </div>
            <dl className="users-detail-grid">
              <div>
                <dt>User ID</dt>
                <dd>{selectedUser.id}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{titleCase(selectedUser.role)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{titleCase(selectedUser.status)}</dd>
              </div>
              <div>
                <dt>Registered</dt>
                <dd>{formatDate(selectedUser.joined)}</dd>
              </div>
              <div>
                <dt>Faculty ID</dt>
                <dd>{selectedUser.professorFacultyId || "None"}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{selectedUser.professorDepartment || "None"}</dd>
              </div>
              <div className="users-proof-detail">
                <dt>Proof</dt>
                <dd>{renderProof(selectedUser)}</dd>
              </div>
              <div>
                <dt>Account Type</dt>
                <dd>{selectedUser.isTemporary ? "Temporary" : "Permanent"}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>
                  {selectedUser.isTemporary
                    ? formatDate(selectedUser.temporaryExpiresAt)
                    : "Never"}
                </dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>
                  {selectedUser.mustChangePassword
                    ? "Temporary"
                    : "User managed"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}

