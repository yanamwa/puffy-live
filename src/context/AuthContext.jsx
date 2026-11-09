import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../config.js";
import {
  APP_ROLES,
  getUserRole,
  isProfessorApprovalRestricted,
  withNormalizedRole,
} from "../utils/roles.js";

const AuthContext = createContext(null);

const sessionStorageKeys = [
  "puffy-token",
  "token",
  "authToken",
  "puffy-user",
  "user",
  "currentUser",
  "user_id",
  "user_email",
  "email",
  "user_role",
  "username",
  "year_level",
  "section_name",
  "admin",
  "admin_id",
  "admin_email",
  "admin_username",
  "school_name",
];

function readStoredUser() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("puffy-user") || "null");
    return storedUser ? withNormalizedRole(storedUser) : null;
  } catch {
    localStorage.removeItem("puffy-user");
    return null;
  }
}

function readStoredToken() {
  return (
    localStorage.getItem("puffy-token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function getSessionToken(data) {
  return data.token || data.accessToken || data.access_token || "";
}

function clearStoredSession() {
  sessionStorageKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function writeUserSession(sessionUser, token = readStoredToken()) {
  const normalizedUser = withNormalizedRole(sessionUser);

  if (token) {
    localStorage.setItem("puffy-token", token);
    localStorage.setItem("token", token);
    localStorage.setItem("authToken", token);
  }

  localStorage.setItem("puffy-user", JSON.stringify(normalizedUser));
  localStorage.setItem("user", JSON.stringify(normalizedUser));
  localStorage.setItem("currentUser", JSON.stringify(normalizedUser));
  localStorage.setItem(
    "user_id",
    String(normalizedUser.userId || normalizedUser.id || ""),
  );
  localStorage.setItem("user_email", normalizedUser.email || "");
  localStorage.setItem("email", normalizedUser.email || "");
  localStorage.setItem("user_role", getUserRole(normalizedUser));
  localStorage.setItem(
    "username",
    normalizedUser.displayName ||
      normalizedUser.display_name ||
      normalizedUser.name ||
      "",
  );
  localStorage.setItem(
    "year_level",
    normalizedUser.yearLevel || normalizedUser.year_level || "",
  );
  localStorage.setItem(
    "section_name",
    normalizedUser.sectionName || normalizedUser.section_name || "",
  );

  return normalizedUser;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [checkingStudentSession, setCheckingStudentSession] = useState(
    () => Boolean(readStoredToken()) && (!user || getUserRole(user) === APP_ROLES.STUDENT),
  );
  const sessionRevision = useRef(0);

  const saveSession = (data) => {
    const sessionUser = withNormalizedRole(
      data.user || {
        email: data.email,
        name: data.username,
        role: data.role,
        verificationStatus: data.verificationStatus || data.verification_status,
      },
    );
    const token = getSessionToken(data);

    if (isProfessorApprovalRestricted(sessionUser)) {
      clearStoredSession();
      setUser(null);
      throw new Error(
        "Your professor registration is pending Super Admin approval.",
      );
    }

    clearStoredSession();
    const normalizedUser = writeUserSession(sessionUser, token);
    setUser(normalizedUser);

    return normalizedUser;
  };

  const updateUser = (nextUser) => {
    if (!nextUser) {
      return null;
    }

    const storedUser = readStoredUser() || {};
    const normalizedNextUser = withNormalizedRole(nextUser);
    const storedRole = getUserRole(storedUser);
    const nextRole = getUserRole(normalizedNextUser);
    const baseUser =
      storedRole && nextRole && storedRole !== nextRole ? {} : storedUser;
    const updatedUser = writeUserSession({
      ...baseUser,
      ...normalizedNextUser,
    });
    sessionRevision.current += 1;
    setUser(updatedUser);

    window.dispatchEvent(
      new CustomEvent("puffy-user-updated", { detail: updatedUser }),
    );

    return updatedUser;
  };

  useEffect(() => {
    const token = readStoredToken();

    if (!token) {
      if (readStoredUser()) {
        clearStoredSession();
        setUser(null);
      }

      setCheckingStudentSession(false);
      return undefined;
    }

    let isMounted = true;
    const revision = sessionRevision.current;
    const verifyStudentSession = checkingStudentSession;

    async function refreshCurrentUser() {
      try {
        const response = await fetch(`${API_BASE}/users/me`, {
          credentials: "include",
          signal: verifyStudentSession ? AbortSignal.timeout(10000) : undefined,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!isMounted || readStoredToken() !== token || sessionRevision.current !== revision) {
          return;
        }

        if (!response.ok || !data.success || !data.user) {
          clearStoredSession();
          setUser(null);
          return;
        }

        if (isProfessorApprovalRestricted(data.user)) {
          clearStoredSession();
          setUser(null);
          return;
        }

        const normalizedUser = writeUserSession(data.user, token);
        setUser(normalizedUser);
      } catch (error) {
        if (
          verifyStudentSession &&
          isMounted &&
          readStoredToken() === token &&
          sessionRevision.current === revision
        ) {
          clearStoredSession();
          setUser(null);
        }
        console.warn("Unable to refresh current user session.", error);
      } finally {
        if (isMounted && verifyStudentSession) setCheckingStudentSession(false);
      }
    }

    refreshCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUserUpdated = (event) => {
      if (event.detail) {
        setUser(withNormalizedRole(event.detail));
      }
    };
    const handleStoredUserUpdated = (event) => {
      if (event.key === "puffy-user") setUser(readStoredUser());
    };

    window.addEventListener("puffy-user-updated", handleUserUpdated);
    window.addEventListener("storage", handleStoredUserUpdated);

    return () => {
      window.removeEventListener("puffy-user-updated", handleUserUpdated);
      window.removeEventListener("storage", handleStoredUserUpdated);
    };
  }, []);

  const login = async (email, password) => {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Invalid credentials.");
    }

    return saveSession(data);
  };

  const switchRole = async (role) => {
    const token = readStoredToken();
    if (!token) throw new Error("Please sign in again.");

    const response = await fetch(`${API_BASE}/switch-role`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.token || !data.user) {
      throw new Error(data.message || "Could not switch roles. Please try again.");
    }
    if (readStoredToken() !== token) throw new Error("Your session changed. Please try again.");
    return saveSession(data);
  };

  const logout = async () => {
    const token = readStoredToken();
    clearStoredSession();
    setUser(null);

    try {
      if (token) {
        await fetch(`${API_BASE}/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.warn("Unable to record logout.", error);
    }
  };

  const value = useMemo(
    () => ({ user, checkingStudentSession, login, logout, saveSession, switchRole, updateUser }),
    [user, checkingStudentSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
