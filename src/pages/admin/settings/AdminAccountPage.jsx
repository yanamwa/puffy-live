import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCamera,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { API_BASE } from "../../../config.js";
import { useAuth } from "../../../context/AuthContext";
import "./AdminAccountPage.css";

const DEFAULT_PROFILE_IMAGE = "/images/temporaryimg.png";

const defaultAdminData = {
  name: "Admin",
  adminId: "Not assigned",
  role: "Administrator",
  department: "Administration",
  email: "Not available",
  accessLevel: "Administrative Access",
  temporaryPassword: "Not available",
};

function getStoredToken() {
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

function getUserRole(user) {
  return user?.role || user?.userRole || user?.user_role || "";
}

function isAdminUser(user) {
  return getUserRole(user) === "admin";
}

function getHomePath(role) {
  if (role === "super_admin") return "/super-admin";
  if (role === "professor") return "/professor";
  if (role === "student") return "/student";
  return "/admin";
}

function formatRole(role) {
  if (!role) return defaultAdminData.role;

  return String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}



function resolveAdminProfileImage(imagePath) {
  if (!imagePath || typeof imagePath !== "string") {
    return DEFAULT_PROFILE_IMAGE;
  }

  const path = imagePath.trim().replace(/\\/g, "/");

  if (
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }

  let fixedPath = path;

  // Convert full localhost:3000 image URLs to backend URLs.
  if (
    fixedPath.startsWith("http://") ||
    fixedPath.startsWith("https://")
  ) {
    const url = new URL(fixedPath);

    if (url.hostname !== "localhost") {
      return fixedPath;
    }

    fixedPath = url.pathname;
  }

  if (fixedPath.startsWith("/api/uploads/")) {
    fixedPath = fixedPath.replace(
      "/api/uploads/",
      "/uploads/"
    );
  }

  if (!fixedPath.startsWith("/")) {
    fixedPath = `/${fixedPath}`;
  }

  return `${API_BASE.replace(/\/api$/, "")}${fixedPath}`;
}



function getAdminProfileData(user) {
  return {
    name:
      user?.displayName ||
      user?.display_name ||
      user?.fullName ||
      user?.full_name ||
      user?.name ||
      defaultAdminData.name,

    adminId:
      user?.adminId ||
      user?.admin_id ||
      user?.employeeId ||
      user?.employee_id ||
      user?.verificationId ||
      user?.verification_id ||
      (user?.userId || user?.id ? `ADM-${user.userId || user.id}` : "") ||
      defaultAdminData.adminId,

    role: formatRole(
      user?.role || user?.userRole || user?.user_role || defaultAdminData.role,
    ),

    department:
      user?.department ||
      user?.assignedDepartment ||
      user?.assigned_department ||
      defaultAdminData.department,

    email: user?.email || defaultAdminData.email,

    accessLevel:
      user?.accessLevel ||
      user?.access_level ||
      user?.permissionLevel ||
      user?.permission_level ||
      defaultAdminData.accessLevel,

    temporaryPassword:
      user?.temporaryPassword ||
      user?.temporary_password ||
      defaultAdminData.temporaryPassword,
  };
}

/* =========================================
   GET USER PROFILE IMAGE
========================================= */

function getAdminProfileImage(user) {
  return resolveAdminProfileImage(
    user?.profileImage ||
      user?.profile_image ||
      user?.profileImageUrl ||
      user?.profile_image_url ||
      user?.profilePicture ||
      user?.profile_picture ||
      user?.avatar ||
      "",
  );
}

function storeUpdatedUser(updatedUser) {
  const serializedUser = JSON.stringify(updatedUser);

  localStorage.setItem("puffy-user", serializedUser);
  localStorage.setItem("user", serializedUser);
  localStorage.setItem("currentUser", serializedUser);
  localStorage.setItem("user_role", updatedUser.role || "admin");
  localStorage.setItem("user_email", updatedUser.email || "");
  localStorage.setItem(
    "username",
    updatedUser.displayName ||
      updatedUser.display_name ||
      updatedUser.name ||
      "",
  );

  window.dispatchEvent(
    new CustomEvent("puffy-user-updated", { detail: updatedUser }),
  );
}

/* =========================================
   ADMIN ACCOUNT PAGE
========================================= */

export default function AdminAccountPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const updateUserRef = useRef(updateUser);

  useEffect(() => {
    updateUserRef.current = updateUser;
  }, [updateUser]);

  const [adminUser, setAdminUser] = useState(() =>
    isAdminUser(user) ? user : null,
  );
  const adminData = useMemo(() => getAdminProfileData(adminUser), [adminUser]);

  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [profileImage, setProfileImage] = useState(() =>
    getAdminProfileImage(isAdminUser(user) ? user : null),
  );

  
useEffect(() => {
  if (!isAdminUser(user)) return;

  setAdminUser(user);

  const savedImage =
    user.profileImage ||
    user.profile_image ||
    user.profileImageUrl ||
    user.profile_image_url;

  // Only replace the displayed photo when the
  // authenticated user actually has an image.
  if (savedImage) {
    setProfileImage(
      resolveAdminProfileImage(savedImage)
    );
  }
}, [user]);

  
useEffect(() => {
  let active = true;
  const controller = new AbortController();

  async function loadAdminProfile() {
    try {
      setProfileLoading(true);
      setProfileError("");

      const token = getStoredToken();

      if (!token) {
        throw new Error(
          "Your login session was not found. Please log in again."
        );
      }

      const response = await fetch(`${API_BASE}/users/me`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load administrator information."
        );
      }

      const loggedInUser =
        data.user || data.data?.user || data.data || data;

      if (!loggedInUser) {
        throw new Error(
          "Administrator account information was not found."
        );
      }

      if (!active) return;

      const loggedInRole = getUserRole(loggedInUser);

      if (loggedInRole && loggedInRole !== "admin") {
        navigate(getHomePath(loggedInRole), {
          replace: true,
        });
        return;
      }

      setAdminUser(loggedInUser);
      setProfileImage(getAdminProfileImage(loggedInUser));

      const syncUser = updateUserRef.current;

      if (typeof syncUser === "function") {
        syncUser(loggedInUser);
      } else {
        storeUpdatedUser(loggedInUser);
      }
    } catch (error) {
      if (!active || error.name === "AbortError") return;

      console.error("Admin profile loading error:", error);

      setProfileError(
        error.message || "Unable to load administrator profile."
      );
    } finally {
      if (active) {
        setProfileLoading(false);
      }
    }
  }

  void loadAdminProfile();

  return () => {
    active = false;
    controller.abort();
  };
}, [navigate]);


  useEffect(() => {
    return () => {
      if (profileImage?.startsWith("blob:")) {
        URL.revokeObjectURL(profileImage);
      }
    };
  }, [profileImage]);

  const changeProfilePicture = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      window.alert("Please select a valid image file.");
      return;
    }

    const maximumFileSize = 5 * 1024 * 1024;

    if (selectedFile.size > maximumFileSize) {
      window.alert(
        "The selected image is too large. Please choose an image smaller than 5 MB.",
      );
      return;
    }

    const token = getStoredToken();

    if (!token) {
      window.alert("Your login session was not found. Please log in again.");
      return;
    }

    const previousImage = profileImage;
    const previewUrl = URL.createObjectURL(selectedFile);

    setProfileImage(previewUrl);
    setProfileImageUploading(true);

    try {
      const formData = new FormData();
      formData.append("profileImage", selectedFile);

      const response = await fetch(`${API_BASE}/users/me/profile-image`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update your profile picture.",
        );
      }

      
        const returnedUser =
          data.user || data.data?.user || data.data || {};

        const returnedImage =
          returnedUser.profileImage ||
          returnedUser.profile_image ||
          data.profileImage ||
          data.profile_image;

        if (!returnedImage || typeof returnedImage !== "string") {
          throw new Error(
            "The server did not return a valid profile image path."
          );
        }

        // Preserve the original authenticated user information.
        const updatedUser = {
          ...(adminUser || {}),
          ...returnedUser,
          role: "admin",
          profileImage: returnedImage,
          profile_image: returnedImage,
        };

        const savedImageUrl =
          resolveAdminProfileImage(returnedImage);

        // Update the profile page without forcing a reload.
        setProfileImage(savedImageUrl);
        setAdminUser(updatedUser);

        // Revoke the temporary preview after replacing it.
        URL.revokeObjectURL(previewUrl);

        // Inform other components that the picture changed.
        window.dispatchEvent(
          new CustomEvent("profile-image-updated", {
            detail: {
              profileImage: savedImageUrl,
              profile_image: savedImageUrl,
            },
          })
        );

    } catch (error) {
      console.error("Admin profile picture update error:", error);
      URL.revokeObjectURL(previewUrl);
      setProfileImage(previousImage);
      window.alert(error.message || "Unable to update your profile picture.");
    } finally {
      setProfileImageUploading(false);
    }
  };

  /* =========================================
     PAGE
  ========================================= */

  return (
    <div className="admin-profile-page">
      {/* =====================================
          PAGE HEADING
      ===================================== */}

      <section className="admin-profile-page-heading">
        <h1>Admin Profile</h1>
      </section>

      {profileLoading && (
        <div className="admin-profile-state">
          Loading administrator information...
        </div>
      )}

      {!profileLoading && profileError && (
        <div className="admin-profile-state">{profileError}</div>
      )}

      {!profileLoading && !profileError && (
        <section className="admin-profile-content">
          <div className="admin-profile-layout">
            {/* =================================
              LEFT: ADMIN ID CARD
          ================================= */}

            <article className="admin-identity-card">
              <div className="admin-identity-card-accent" />

              {/* =================================
                CARD HEADER
            ================================= */}

              <div className="admin-identity-header">
                <div className="admin-identity-brand">
                  <img src="/images/logo_solo.png" alt="PuffyBrain" />

                  <div>
                    <strong>PuffyBrain</strong>

                    <span>Administrator Identification Card</span>
                  </div>
                </div>

                <span className="admin-identity-role">Admin</span>
              </div>

              {/* =================================
                PROFILE PHOTO
            ================================= */}

              <div className="admin-identity-photo-area">
                <div className="admin-id-photo-frame">
                  <img
                    src={profileImage}
                    alt={`${adminData.name}'s profile`}
                    className="admin-id-photo"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                    }}
                  />

                  <label
                    className="admin-photo-change-button"

                    title={
                      profileImageUploading
                        ? "Uploading profile picture..."
                        : "Change profile picture"
                    }

                    aria-label={
                      profileImageUploading
                        ? "Uploading profile picture"
                        : "Change profile picture"
                    }
                  >
                    {profileImageUploading ? (
                      <span className="admin-photo-uploading">...</span>
                    ) : (
                      <FiCamera aria-hidden="true" />
                    )}

                    <input
                      type="file"

                      accept="
                      image/png,
                      image/jpeg,
                      image/jpg,
                      image/webp
                    "

                      className="admin-photo-input"
                      onChange={changeProfilePicture}
                      disabled={profileImageUploading}
                    />
                  </label>
                </div>

                {/* =================================
                  ADMIN MAIN INFO
              ================================= */}

                <div className="admin-identity-main">
                  <span className="admin-identity-overline">
                    Official administrator profile
                  </span>

                  <h2>{adminData.name}</h2>

                  <strong className="admin-identity-number">
                    {adminData.adminId}
                  </strong>

                  <p>{adminData.department}</p>

                  <div className="admin-identity-access-row">
                    <span>{adminData.role}</span>

                    <i aria-hidden="true" />

                    <span>{adminData.accessLevel}</span>
                  </div>
                </div>
              </div>

              {/* =================================
                CARD FOOTER
            ================================= */}

              <div className="admin-identity-footer">
                <div>
                  <span>Issued by</span>

                  <strong>PuffyBrain Learning System</strong>
                </div>

                <div className="admin-id-barcode" aria-hidden="true" />
              </div>
            </article>

            {/* =================================
              RIGHT SIDE
          ================================= */}

            <div className="admin-profile-details">
              {/* =================================
                INFORMATION HEADER
            ================================= */}

              <div className="admin-profile-details-header">
                <div>
                  <span className="admin-profile-eyebrow">
                    Profile overview
                  </span>

                  <h2>Administrator Information</h2>

                  <p>Your personal, administrative, and account information.</p>
                </div>
              </div>

              {/* =================================
                PERSONAL INFORMATION
            ================================= */}

              <section className="admin-info-section">
                <div className="admin-info-section-heading">
                  <span className="admin-info-section-icon">
                    <FiUser aria-hidden="true" />
                  </span>

                  <div>
                    <h3>Personal Information</h3>

                    <p>Basic administrator account details</p>
                  </div>
                </div>

                <div className="admin-info-grid">
                  {/* FULL NAME */}

                  <div className="admin-info-item">
                    <span className="admin-info-label">Full Name</span>

                    <strong>{adminData.name}</strong>
                  </div>

                  {/* ADMIN ID */}

                  <div className="admin-info-item">
                    <span className="admin-info-label">Admin ID</span>

                    <strong>{adminData.adminId}</strong>
                  </div>

                  {/* EMAIL */}

                  <div className="admin-info-item admin-info-item-wide">
                    <span className="admin-info-label">Email Address</span>

                    <div className="admin-info-value-row">
                      <FiMail aria-hidden="true" />

                      <strong>{adminData.email}</strong>
                    </div>
                  </div>
                </div>
              </section>

              {/* =================================
                ADMINISTRATIVE INFORMATION
            ================================= */}

              <section className="admin-info-section">
                <div className="admin-info-section-heading">
                  <span className="admin-info-section-icon">
                    <FiShield aria-hidden="true" />
                  </span>

                  <div>
                    <h3>Administrative Information</h3>

                    <p>Role assignment and administrative privileges</p>
                  </div>
                </div>

                <div className="admin-info-grid">
                  {/* ROLE */}

                  <div className="admin-info-item">
                    <span className="admin-info-label">Role</span>

                    <strong>{adminData.role}</strong>
                  </div>

                  {/* DEPARTMENT */}

                  <div className="admin-info-item">
                    <span className="admin-info-label">Department</span>

                    <div className="admin-info-value-row">
                      <FiUsers aria-hidden="true" />

                      <strong>{adminData.department}</strong>
                    </div>
                  </div>

                  {/* ACCESS LEVEL */}

                  <div className="admin-info-item admin-info-item-wide">
                    <span className="admin-info-label">Access Level</span>

                    <div className="admin-access-level-value">
                      <FiShield aria-hidden="true" />

                      <strong>{adminData.accessLevel}</strong>
                    </div>
                  </div>
                </div>
              </section>

              {/* =================================
                ACCOUNT SECURITY
            ================================= */}

              <section className="admin-info-section admin-security-section">
                <div className="admin-info-section-heading">
                  <span className="admin-info-section-icon">
                    <FiLock aria-hidden="true" />
                  </span>

                  <div>
                    <h3>Account Security</h3>

                    <p>Temporary account credentials</p>
                  </div>
                </div>

                {/* =================================
                  TEMPORARY PASSWORD
              ================================= */}

                <div className="admin-password-card">
                  <div className="admin-password-copy">
                    <span className="admin-info-label">Temporary Password</span>

                    <strong
                      className={
                        showTemporaryPassword
                          ? "admin-password-visible"
                          : "admin-password-hidden"
                      }
                    >
                      {showTemporaryPassword
                        ? adminData.temporaryPassword
                        : "••••••••••••••"}
                    </strong>
                  </div>

                  {/* =================================
                    SHOW/HIDE PASSWORD
                ================================= */}

                  <button
                    type="button"

                    className="admin-password-toggle"

                    onClick={() =>
                      setShowTemporaryPassword((currentValue) => !currentValue)
                    }

                    title={
                      showTemporaryPassword
                        ? "Hide temporary password"
                        : "Show temporary password"
                    }

                    aria-label={
                      showTemporaryPassword
                        ? "Hide temporary password"
                        : "Show temporary password"
                    }

                    aria-pressed={showTemporaryPassword}
                  >
                    {showTemporaryPassword ? (
                      <FiEyeOff aria-hidden="true" />
                    ) : (
                      <FiEye aria-hidden="true" />
                    )}

                    <span>{showTemporaryPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>

                <p className="admin-password-note">
                  Keep this password private. Change it from the Settings page
                  after your first successful login.
                </p>
              </section>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
