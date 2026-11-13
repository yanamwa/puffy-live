import { useEffect, useState } from "react";
import {
  FiBookOpen,
  FiBriefcase,
  FiCamera,
  FiMail,
  FiUser,
} from "react-icons/fi";
import { API_BASE } from "../../../config.js";
import Swal from "sweetalert2";
import "./ProfessorProfile.css";

/* =====================================================
   API CONFIG
===================================================== */

const API_BASE_URL = API_BASE;

const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const DEFAULT_PROFILE_IMAGE = "/images/temporaryimg.png";

/* =====================================================
   PROFILE IMAGE
===================================================== */

function resolveProfessorImage(imagePath) {
  if (!imagePath) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  let fixedPath = imagePath;

  // Fix older stored image paths
  if (fixedPath.startsWith("/api/uploads/profile-images/")) {
    fixedPath = fixedPath.replace(
      "/api/uploads/profile-images/",
      "/uploads/profile-images/",
    );
  }

  if (!fixedPath.startsWith("/")) {
    fixedPath = `/${fixedPath}`;
  }

  return `${SERVER_ORIGIN}${fixedPath}`;
}

/* =====================================================
   NORMALIZE PROFESSOR DATA
===================================================== */

function getProfileValue(...values) {
  const value = values.find((candidate) => {
    if (candidate == null) return false;

    const normalized = String(candidate).trim();
    return normalized && normalized.toLowerCase() !== "not set";
  });

  return value == null ? "" : String(value).trim();
}

function getProfessorProfileData(user) {
  return {
    name:
      getProfileValue(user?.displayName, user?.display_name, user?.name) ||
      "Professor",

    employeeId: getProfileValue(
      user?.professorFacultyId,
      user?.professor_faculty_id,
      user?.professorId,
      user?.professor_id,
    ),

    department: getProfileValue(
      user?.professorDepartment,
      user?.professor_department,
    ),

    email: getProfileValue(user?.email),

    role: user?.role || "professor",

    mustChangePassword:
      user?.mustChangePassword === true ||
      user?.mustChangePassword === 1 ||
      user?.must_change_password === true ||
      user?.must_change_password === 1,

    profileImage:
      user?.profileImage ||
      user?.profile_image ||
      user?.avatar ||
      user?.image ||
      "",
  };
}

/* =====================================================
   FORMAT ROLE
===================================================== */

function formatRole(role) {
  if (!role) {
    return "Professor";
  }

  return String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* =====================================================
   COMPONENT
===================================================== */

export default function ProfessorProfile() {
  const [professorData, setProfessorData] = useState(
    getProfessorProfileData(null),
  );

  const [profileImage, setProfileImage] = useState(DEFAULT_PROFILE_IMAGE);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [profileImageUploading, setProfileImageUploading] = useState(false);

  /* =====================================================
     GET TOKEN
  ===================================================== */

  const getStoredToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("puffy-token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken")
    );
  };

  /* =====================================================
     FETCH PROFESSOR
  ===================================================== */

  const fetchProfessorProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getStoredToken();

      if (!token) {
        throw new Error(
          "Your login session was not found. Please log in again.",
        );
      }

      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "GET",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load professor information.",
        );
      }

      const loggedInUser = data.user || data.data?.user || data.data || data;

      if (!loggedInUser) {
        throw new Error("Professor account information was not found.");
      }

      if (loggedInUser.role && loggedInUser.role !== "professor") {
        throw new Error("The logged-in account is not a professor.");
      }

      const normalizedProfessor = getProfessorProfileData(loggedInUser);

      setProfessorData(normalizedProfessor);

      setProfileImage(resolveProfessorImage(normalizedProfessor.profileImage));

      const serializedUser = JSON.stringify(loggedInUser);

      localStorage.setItem("puffy-user", serializedUser);

      localStorage.setItem("user", serializedUser);

      localStorage.setItem("currentUser", serializedUser);
    } catch (error) {
      console.error("Professor profile loading error:", error);

      setError(error.message || "Unable to load professor profile.");
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     LOAD PROFILE
  ===================================================== */

  useEffect(() => {
    fetchProfessorProfile();
  }, []);

  /* =====================================================
     CLEAN BLOB URL
  ===================================================== */

  useEffect(() => {
    return () => {
      if (profileImage?.startsWith("blob:")) {
        URL.revokeObjectURL(profileImage);
      }
    };
  }, [profileImage]);

  /* =====================================================
     CHANGE PROFILE PICTURE
  ===================================================== */

  const changeProfilePicture = async (event) => {
    const selectedFile = event.target.files?.[0];

    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    /* INVALID FILE */

    if (!selectedFile.type.startsWith("image/")) {
      await Swal.fire({
        icon: "error",
        title: "Invalid File",
        text: "Please select a valid JPG, PNG, or WEBP image.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });

      return;
    }

    /* FILE SIZE */

    const maximumFileSize = 5 * 1024 * 1024;

    if (selectedFile.size > maximumFileSize) {
      await Swal.fire({
        icon: "warning",
        title: "File Too Large",
        text: "Please choose an image smaller than 5 MB.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });

      return;
    }

    /* CHECK SESSION */

    const token = getStoredToken();

    if (!token) {
      await Swal.fire({
        icon: "error",
        title: "Session Expired",
        text: "Your login session was not found. Please log in again.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });

      return;
    }

    const previousImage = profileImage;

    const previewUrl = URL.createObjectURL(selectedFile);

    // Preview selected image
    setProfileImage(previewUrl);

    setProfileImageUploading(true);

    try {
      const formData = new FormData();

      formData.append("profileImage", selectedFile);

      /* ===============================================
           UPLOAD IMAGE
        =============================================== */

      const response = await fetch(`${API_BASE_URL}/users/me/profile-image`, {
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

      /* ===============================================
           GET RETURNED IMAGE
        =============================================== */

      const returnedUser = data.user || data.data?.user || data.data || {};

      const returnedImage =
        returnedUser.profileImage ||
        returnedUser.profile_image ||
        data.profileImage ||
        data.profile_image;

      if (!returnedImage) {
        throw new Error(
          "The server updated the photo but did not return its saved path.",
        );
      }

      const savedImageUrl = resolveProfessorImage(returnedImage);

      console.log("Saved professor image path:", returnedImage);

      console.log("Professor image URL:", savedImageUrl);

      /* ===============================================
           DISPLAY SAVED IMAGE
        =============================================== */

      setProfileImage(savedImageUrl);

      setProfessorData((currentProfessor) => ({
        ...currentProfessor,

        profileImage: returnedImage,
      }));

      /* ===============================================
           UPDATE LOCAL STORAGE
        =============================================== */

      const currentSavedUser = (() => {
        try {
          const stored =
            localStorage.getItem("puffy-user") ||
            localStorage.getItem("user") ||
            localStorage.getItem("currentUser");

          return stored ? JSON.parse(stored) : {};
        } catch {
          return {};
        }
      })();

      const updatedStoredUser = {
        ...currentSavedUser,
        ...returnedUser,

        profileImage: returnedImage,

        profile_image: returnedImage,
      };

      const serializedUser = JSON.stringify(updatedStoredUser);

      localStorage.setItem("puffy-user", serializedUser);

      localStorage.setItem("user", serializedUser);

      localStorage.setItem("currentUser", serializedUser);

      /* ===============================================
           UPDATE HEADER / SIDEBAR
        =============================================== */

      window.dispatchEvent(
        new CustomEvent("puffy-user-updated", {
          detail: updatedStoredUser,
        }),
      );

      /* ===============================================
           REMOVE PREVIEW URL
        =============================================== */

      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      /* ===============================================
           SWEETALERT SUCCESS
        =============================================== */

      await Swal.fire({
        icon: "success",
        title: "Profile Updated!",
        text: "Your profile picture has been updated successfully.",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("Profile picture update error:", error);

      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      // Restore previous picture
      setProfileImage(previousImage);

      /* ===============================================
           SWEETALERT ERROR
        =============================================== */

      await Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: error.message || "Unable to update your profile picture.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    } finally {
      setProfileImageUploading(false);
    }
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="professor-profile-page">
        <section className="professor-profile-page-heading professor-section-heading">
          <h1>Professor Profile</h1>
        </section>

        <section className="professor-profile-content">
          <p>Loading professor information...</p>
        </section>
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error) {
    return (
      <div className="professor-profile-page">
        <section className="professor-profile-page-heading professor-section-heading">
          <h1>Professor Profile</h1>
        </section>

        <section className="professor-profile-content">
          <p>{error}</p>
        </section>
      </div>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <div className="professor-profile-page">
      <section className="professor-profile-page-heading professor-section-heading">
        <h1>Professor Profile</h1>
      </section>

      <section className="professor-profile-content">
        <div className="professor-profile-layout">
          {/* LEFT: PROFESSOR ID CARD */}

          <article className="professor-identity-card">
            <div className="professor-identity-card-accent" />

            <div className="professor-identity-header">
              <div className="professor-identity-brand">
                <img src="/images/puffybrain.png" alt="PuffyBrain" />

                <div>
                  <strong>PuffyBrain</strong>

                  <span>Professor Identification Card</span>
                </div>
              </div>

              <span className="professor-identity-role">
                {formatRole(professorData.role)}
              </span>
            </div>

            <div className="professor-identity-photo-area">
              <div className="professor-id-photo-frame">
                <img
                  src={profileImage}
                  alt={`${professorData.name}'s profile`}
                  className="professor-id-photo"

                  onError={(event) => {
                    console.error(
                      "Professor profile image failed to load:",
                      profileImage,
                    );

                    event.currentTarget.onerror = null;

                    event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                />

                <label
                  className="professor-photo-change-button"
                  title="Change profile picture"
                  aria-label="Change profile picture"
                >
                  {profileImageUploading ? (
                    "..."
                  ) : (
                    <FiCamera aria-hidden="true" />
                  )}

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="professor-photo-input"
                    onChange={changeProfilePicture}
                    disabled={profileImageUploading}
                  />
                </label>
              </div>

              <div className="professor-identity-main">
                <span className="professor-identity-overline">
                  Official faculty profile
                </span>

                <h2>{professorData.name}</h2>

                {professorData.employeeId && (
                  <strong className="professor-identity-number">
                    {professorData.employeeId}
                  </strong>
                )}

                {professorData.department && <p>{professorData.department}</p>}
              </div>
            </div>

            <div className="professor-identity-footer">
              <div>
                <span>Issued by</span>

                <strong>PuffyBrain Learning System</strong>
              </div>

              <div className="professor-id-barcode" aria-hidden="true" />
            </div>
          </article>

          {/* RIGHT SIDE */}

          <div className="professor-profile-details">
            <div className="professor-profile-details-header">
              <div>
                <span className="professor-profile-eyebrow">
                  Profile overview
                </span>

                <h2>Professor Information</h2>

                <p>Your personal, professional, and account information.</p>
              </div>
            </div>

            {/* PERSONAL INFORMATION */}

            <section className="professor-info-section">
              <div className="professor-info-section-heading">
                <span className="professor-info-section-icon">
                  <FiUser aria-hidden="true" />
                </span>

                <div>
                  <h3>Personal Information</h3>

                  <p>Basic professor account details</p>
                </div>
              </div>

              <div className="professor-info-grid">
                {professorData.name && (
                  <div className="professor-info-item">
                    <span className="professor-info-label">Full Name</span>

                    <strong>{professorData.name}</strong>
                  </div>
                )}

                {professorData.employeeId && (
                  <div className="professor-info-item">
                    <span className="professor-info-label">Employee ID</span>

                    <strong>{professorData.employeeId}</strong>
                  </div>
                )}

                {professorData.email && (
                  <div className="professor-info-item professor-info-item-wide">
                    <span className="professor-info-label">Email Address</span>

                    <div className="professor-info-value-row">
                      <FiMail aria-hidden="true" />

                      <strong>{professorData.email}</strong>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* PROFESSIONAL INFORMATION */}

            <section className="professor-info-section">
              <div className="professor-info-section-heading">
                <span className="professor-info-section-icon">
                  <FiBriefcase aria-hidden="true" />
                </span>

                <div>
                  <h3>Professional Information</h3>

                  <p>Faculty assignment and academic expertise</p>
                </div>
              </div>

              <div className="professor-info-grid">
                {professorData.department && (
                  <div className="professor-info-item professor-info-item-wide">
                    <span className="professor-info-label">Department</span>

                    <div className="professor-info-value-row">
                      <FiBookOpen aria-hidden="true" />

                      <strong>{professorData.department}</strong>
                    </div>
                  </div>
                )}

                <div className="professor-info-item">
                  <span className="professor-info-label">Role</span>

                  <strong>{formatRole(professorData.role)}</strong>
                </div>
              </div>
            </section>


          </div>
        </div>
      </section>
    </div>
  );
}
