import { useEffect, useState } from "react";
import { API_BASE } from "../../../config.js";

export const DEFAULT_STUDENT_PROFILE_IMAGE = "/images/temporary profile.jpg";

export function cleanStudentProfileText(value) {
  return String(value || "").trim();
}

function valueOrFallback(value, fallback) {
  const cleaned = cleanStudentProfileText(value);
  return cleaned || fallback;
}

function getUserRole(user) {
  return user?.role || user?.userRole || user?.user_role || "";
}

function isStudentUser(user) {
  return getUserRole(user) === "student";
}

export function normalizeStudentProfileImage(image) {
  const cleaned = cleanStudentProfileText(image);

  if (!cleaned || cleaned.includes("temporary profile.jpg")) {
    return DEFAULT_STUDENT_PROFILE_IMAGE;
  }

  if (
    cleaned.startsWith("blob:") ||
    cleaned.startsWith("http://") ||
    cleaned.startsWith("https://") ||
    cleaned.startsWith("/images/")
  ) {
    return cleaned;
  }

  const serverOrigin = API_BASE.replace(/\/api\/?$/, "");
  const normalizedPath = cleaned.replace(/^\/+/, "");

  if (
    normalizedPath.startsWith("uploads/") ||
    normalizedPath.startsWith("api/uploads/")
  ) {
    return `${serverOrigin}/${normalizedPath}`;
  }

  if (cleaned.startsWith("/")) {
    return cleaned;
  }

  return `${serverOrigin}/${normalizedPath}`;
}

export function getStoredStudentToken() {
  return (
    localStorage.getItem("puffy-token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

export function getStoredStudentUser() {
  const storageKeys = ["puffy-user", "user", "currentUser"];

  for (const key of storageKeys) {
    const rawUser = localStorage.getItem(key) || sessionStorage.getItem(key);

    if (!rawUser) continue;

    try {
      const storedUser = JSON.parse(rawUser);

      if (isStudentUser(storedUser)) {
        return storedUser;
      }
    } catch (error) {
      console.error("Unable to read stored student profile:", error);
    }
  }

  const storedRole = localStorage.getItem("user_role") || "";

  if (storedRole !== "student") {
    return {};
  }

  return {
    displayName: localStorage.getItem("username") || "",
    email: localStorage.getItem("user_email") || "",
    role: localStorage.getItem("user_role") || "student",
    yearLevel: localStorage.getItem("year_level") || "",
    sectionName: localStorage.getItem("section_name") || "",
  };
}

export function buildStudentProfile(user = {}) {
  const displayName =
    user.displayName || user.display_name || user.name || user.username;

  return {
    name: valueOrFallback(displayName, "Student"),
    studentNumber: valueOrFallback(
      user.studentId ||
        user.student_id ||
        user.verificationId ||
        user.verification_id,
      "Student number not set",
    ),
    year: valueOrFallback(
      user.yearLevel || user.year_level,
      "Year level not set",
    ),
    section: valueOrFallback(
      user.sectionName || user.section_name,
      "Section not set",
    ),
    email: valueOrFallback(user.email, "Email not set"),
    course: valueOrFallback(
      user.program ||
        user.programName ||
        user.program_name ||
        user.course ||
        user.courseName ||
        user.course_name,
      "Program not set",
    ),
    temporaryPassword: cleanStudentProfileText(
      user.temporaryPassword || user.temporary_password,
    ),
    profileImage: normalizeStudentProfileImage(
      user.profileImage || user.profile_image,
    ),
  };
}

export function getStudentProfileHandle(profile) {
  const name = typeof profile === "string" ? profile : profile?.name;
  const cleanedName = cleanStudentProfileText(name);

  return cleanedName ? `@${cleanedName.replace(/^@/, "")}` : "@student";
}

export function getStudentAccountLabel(profile) {
  return profile?.email && profile.email !== "Email not set"
    ? profile.email
    : "Student account";
}

export function storeStudentUserProfile(user = {}) {
  if (!isStudentUser(user)) {
    return;
  }

  localStorage.setItem("puffy-user", JSON.stringify(user));
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("currentUser", JSON.stringify(user));
  localStorage.setItem("user_role", user.role || "student");
  localStorage.setItem("user_email", cleanStudentProfileText(user.email));
  localStorage.setItem(
    "username",
    cleanStudentProfileText(user.displayName || user.display_name || user.name),
  );
  localStorage.setItem(
    "year_level",
    cleanStudentProfileText(user.yearLevel || user.year_level),
  );
  localStorage.setItem(
    "section_name",
    cleanStudentProfileText(user.sectionName || user.section_name),
  );
}

export async function fetchCurrentStudentUser() {
  const token = getStoredStudentToken();

  if (!token) {
    return null;
  }

  const response = await fetch(`${API_BASE}/users/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Could not load your profile.");
  }

  const loadedUser = data.user || data.data || null;

  if (!loadedUser || !isStudentUser(loadedUser)) {
    return null;
  }

  return loadedUser;
}

export function useStudentProfile({ enabled = true } = {}) {
  const [studentProfile, setStudentProfile] = useState(() =>
    buildStudentProfile(getStoredStudentUser()),
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function loadStudentProfile() {
      try {
        const loadedUser = await fetchCurrentStudentUser();

        if (!active || !loadedUser) {
          return;
        }

        storeStudentUserProfile(loadedUser);
        setStudentProfile(buildStudentProfile(loadedUser));
      } catch (error) {
        console.error("Student profile loading error:", error);
      }
    }

    loadStudentProfile();

    return () => {
      active = false;
    };
  }, [enabled]);

  return studentProfile;
}

export function clearStudentSession() {
  [
    "puffy-token",
    "puffy-user",
    "token",
    "authToken",
    "user",
    "currentUser",
    "user_email",
    "user_role",
    "username",
    "year_level",
    "section_name",
    "school_name",
    "admin",
    "admin_id",
    "admin_email",
    "admin_username",
  ].forEach((key) => localStorage.removeItem(key));

  sessionStorage.clear();
}
