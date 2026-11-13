import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import Swal from "sweetalert2";

import StudentSidebar from "../../../components/students/StudentSidebar";

import StudentHeader from "../../../components/students/StudentHeader";
import StudentIdentityCard from "../../../components/students/StudentIdentityCard";
import JoinCourseModal from "../courses/JoinCourseModal";

import { requestCourseEnrollmentByCode } from "../courses/courseEnrollment.js";
import { API_BASE } from "../../../config.js";

import "./StudentProfile.css";

const API_BASE_URL = API_BASE;

const DEFAULT_PROFILE_IMAGE = "/images/temporary profile.jpg";

function resolveProfileImage(imagePath) {
  if (!imagePath) return DEFAULT_PROFILE_IMAGE;

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }
  const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, "");

  return `${serverOrigin}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
}

function getUserRole(user) {
  return user?.role || user?.userRole || user?.user_role || "";
}

function isStudentUser(user) {
  return getUserRole(user) === "student";
}

function getHomePath(role) {
  if (role === "super_admin") return "/super-admin";

  if (role === "admin") return "/admin";

  if (role === "professor") return "/professor";

  return "/student";
}

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

function getSavedUser() {
  try {
    const storedUser =
      localStorage.getItem("puffy-user") ||
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("user") ||
      sessionStorage.getItem("currentUser");

    if (!storedUser) return null;

    const savedUser = JSON.parse(storedUser);

    return isStudentUser(savedUser) ? savedUser : null;
  } catch (error) {
    console.error("Unable to read saved user:", error);

    return null;
  }
}

function saveUpdatedUser(updatedUser) {
  if (!isStudentUser(updatedUser)) return;

  const serializedUser = JSON.stringify(updatedUser);

  localStorage.setItem("user", serializedUser);

  localStorage.setItem("currentUser", serializedUser);

  localStorage.setItem("puffy-user", serializedUser);

  if (sessionStorage.getItem("user")) {
    sessionStorage.setItem("user", serializedUser);
  }

  if (sessionStorage.getItem("currentUser")) {
    sessionStorage.setItem("currentUser", serializedUser);
  }

  window.dispatchEvent(
    new CustomEvent("puffy-user-updated", {
      detail: updatedUser,
    }),
  );
}

function normalizeStudent(user) {
  const savedUser = user || {};

  return {
    id: savedUser.userId || savedUser.user_id || savedUser.id || "",

    name:
      savedUser.displayName ||
      savedUser.display_name ||
      savedUser.name ||
      savedUser.fullName ||
      savedUser.full_name ||
      savedUser.username ||
      "Student",

    studentNumber:
      savedUser.studentId ||
      savedUser.student_id ||
      savedUser.studentNumber ||
      savedUser.student_number ||
      savedUser.verificationId ||
      savedUser.verification_id ||
      "Not assigned",

    email: savedUser.email || "Not available",

    year:
      savedUser.yearLevel ||
      savedUser.year_level ||
      savedUser.year ||
      "Not set",

    section:
      savedUser.sectionName ||
      savedUser.section_name ||
      savedUser.section ||
      "Not set",

    role: savedUser.role || "student",

    course:
      savedUser.course ||
      savedUser.program ||
      savedUser.programName ||
      savedUser.program_name ||
      savedUser.courseName ||
      savedUser.course_name ||
      "Course not set",

    profileImage:
      savedUser.profileImage ||
      savedUser.profile_image ||
      savedUser.avatar ||
      savedUser.image ||
      "",

    temporaryPassword:
      savedUser.temporaryPassword ||
      savedUser.temporary_password ||
      savedUser.initialPassword ||
      savedUser.initial_password ||
      "Not available",
  };
}

export default function StudentProfile() {
  const navigate = useNavigate();

  const savedStudent = normalizeStudent(getSavedUser());

  const [studentData, setStudentData] = useState(savedStudent);

  const [profileLoading, setProfileLoading] = useState(true);

  const [profileError, setProfileError] = useState("");

  const [profileImage, setProfileImage] = useState(
    resolveProfileImage(savedStudent.profileImage),
  );

  const [profileImageUploading, setProfileImageUploading] = useState(false);



  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const [courseCode, setCourseCode] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStudentProfile() {
      try {
        setProfileLoading(true);

        setProfileError("");

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

          credentials: "include",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load your profile information.",
          );
        }

        const loggedInUser = data.user || data.data || data;

        if (!loggedInUser) {
          throw new Error("Student account information was not found.");
        }

        const loggedInRole = getUserRole(loggedInUser);

        if (loggedInRole && loggedInRole !== "student") {
          if (active) {
            navigate(getHomePath(loggedInRole), {
              replace: true,
            });
          }

          return;
        }

        const normalizedUser = normalizeStudent(loggedInUser);

        if (!active) return;

        setStudentData(normalizedUser);

        setProfileImage(resolveProfileImage(normalizedUser.profileImage));

        saveUpdatedUser(loggedInUser);
      } catch (error) {
        console.error("Student profile loading error:", error);

        if (active) {
          setProfileError(
            error.message || "Unable to load your profile information.",
          );
        }
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    loadStudentProfile();

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (profileImage.startsWith("blob:")) {
        URL.revokeObjectURL(profileImage);
      }
    };
  }, [profileImage]);

  const closeJoinModal = () => {
    setJoinModalOpen(false);

    setCourseCode("");
  };

  const joinByCourseCode = () =>
    requestCourseEnrollmentByCode(courseCode, { onSubmitted: closeJoinModal });

  const shareProfile = async () => {
    const profileLink = `${window.location.origin}/student/profile`;

    try {
      await navigator.clipboard.writeText(profileLink);

      await Swal.fire({
        icon: "success",

        title: "Profile Link Copied",

        text: "Your profile link has been copied.",

        confirmButtonColor: "#7FA8D6",

        timer: 1600,

        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Unable to copy profile link:", error);

      await Swal.fire({
        icon: "error",

        title: "Unable to Copy Link",

        text: "Unable to copy the profile link.",

        confirmButtonColor: "#7FA8D6",
      });
    }
  };

  const changeProfilePicture = async (event) => {
    const selectedFile = event.target.files?.[0];

    event.target.value = "";

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      await Swal.fire({
        icon: "error",

        title: "Invalid File",

        text: "Please select a valid image file.",

        confirmButtonColor: "#7FA8D6",
      });

      return;
    }

    const maximumFileSize = 5 * 1024 * 1024;

    if (selectedFile.size > maximumFileSize) {
      await Swal.fire({
        icon: "warning",

        title: "File Too Large",

        text: "Please choose an image smaller than 5 MB.",

        confirmButtonColor: "#7FA8D6",
      });

      return;
    }

    const token = getStoredToken();

    if (!token) {
      await Swal.fire({
        icon: "error",

        title: "Session Expired",

        text: "Please log in again.",

        confirmButtonColor: "#7FA8D6",
      });

      return;
    }

    const previousImage = profileImage;

    const previewUrl = URL.createObjectURL(selectedFile);

    setProfileImage(previewUrl);

    setProfileImageUploading(true);

    try {
      const formData = new FormData();

      formData.append("profileImage", selectedFile);

      const response = await fetch(
        `${API_BASE_URL}/users/me/profile-image`,

        {
          method: "PUT",

          headers: {
            Authorization: `Bearer ${token}`,
          },

          credentials: "include",

          body: formData,
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update your profile picture.",
        );
      }

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

      const currentSavedUser = getSavedUser() || {};

      const updatedUser = {
        ...currentSavedUser,

        ...returnedUser,

        profileImage: returnedImage,

        profile_image: returnedImage,
      };

      const savedImageUrl = resolveProfileImage(returnedImage);

      URL.revokeObjectURL(previewUrl);

      setProfileImage(savedImageUrl);

      setStudentData(normalizeStudent(updatedUser));

      saveUpdatedUser(updatedUser);

      await Swal.fire({
        icon: "success",

        title: "Profile Updated!",

        text: "Your profile picture has been updated successfully.",

        confirmButtonColor: "#7FA8D6",

        timer: 1800,

        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Profile picture update error:", error);

      URL.revokeObjectURL(previewUrl);

      setProfileImage(previousImage);

      await Swal.fire({
        icon: "error",

        title: "Update Failed",

        text: error.message || "Unable to update your profile picture.",

        confirmButtonColor: "#7FA8D6",
      });
    } finally {
      setProfileImageUploading(false);
    }
  };

  return (
    <div className="enrolled-dashboard striped-dashboard student-profile-page">
            <StudentSidebar />
      <main className="enrolled-main">

        <StudentHeader
          searchPlaceholder="Search your course"

          onJoinCourse={() => setJoinModalOpen(true)}
        />
        <section className="public-heading">
                    <h1>Student Profile</h1>       {" "}
        </section>

        {profileLoading && (
          <div className="student-empty-state">
                        Loading your profile             information...        

          </div>
        )}

        {!profileLoading && profileError && (
          <div className="student-empty-state">
                          {profileError}           {" "}
          </div>
        )}

        {!profileLoading && !profileError && (
          <section className="student-profile-content">

            <div className="student-profile-layout">

              <StudentIdentityCard
                student={studentData}
                editable={true}
                profileImage={profileImage}
                profileImageUploading={profileImageUploading}
                onProfileImageChange={changeProfilePicture}
              />

              <div className="student-profile-details">

                <div className="student-profile-details-header">

                  <div>

                    <span className="student-profile-eyebrow">
                                              Profile overview                  

                    </span>

                    <h2>
                                              Student Information              

                    </h2>

                    <p>
                                              Your personal,                    
                          academic, and account                        
                      information.                      {" "}
                    </p>

                  </div>

                  <button
                    type="button"

                    className="student-profile-share-button"

                    onClick={shareProfile}

                    title="Copy profile link"

                    aria-label="Copy profile link"
                  >

                    <svg
                      viewBox="0 0 24 24"

                      aria-hidden="true"
                    >

                      <circle
                        cx="18"

                        cy="5"

                        r="2.5"
                      />

                      <circle
                        cx="6"

                        cy="12"

                        r="2.5"
                      />

                      <circle
                        cx="18"

                        cy="19"

                        r="2.5"
                      />
                                              <path d="m8.2 10.8 7.5-4.4" />
                                              <path d="m8.2 13.2 7.5 4.4" />   

                    </svg>

                  </button>

                </div>

                <section className="student-info-section">

                  <div className="student-info-section-heading">

                    <span className="student-info-section-icon">

                      <svg
                        viewBox="0 0 24 24"

                        aria-hidden="true"
                      >

                        <circle
                          cx="12"

                          cy="8"

                          r="4"
                        />

                        <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" />             

                      </svg>

                    </span>

                    <div>

                      <h3>
                                                  Personal Information          

                      </h3>

                      <p>
                                                  Basic student account        
                                          details                        {" "}
                      </p>

                    </div>

                  </div>

                  <div className="student-info-grid">

                    <div className="student-info-item">

                      <span className="student-info-label">
                                                  Full Name                    

                      </span>

                      <strong>
                                                  {studentData.name}           

                      </strong>

                    </div>

                    <div className="student-info-item">

                      <span className="student-info-label">
                                                  Student Number                

                      </span>

                      <strong>
                                                  {studentData.studentNumber}   

                      </strong>

                    </div>

                    <div className="student-info-item student-info-item-wide">

                      <span className="student-info-label">
                                                  Email Address                

                      </span>

                      <strong>
                                                  {studentData.email}           

                      </strong>

                    </div>

                  </div>

                </section>

                <section className="student-info-section">

                  <div className="student-info-section-heading">

                    <span className="student-info-section-icon">

                      <svg
                        viewBox="0 0 24 24"

                        aria-hidden="true"
                      >

                        <path d="m3.5 8.2 8.5-4.7 8.5 4.7-8.5 4.7-8.5-4.7Z" /> 

                        <path d="M6.5 10.2v5c0 1.3 2.5 3 5.5 3s5.5-1.7 5.5-3v-5" />

                      </svg>

                    </span>

                    <div>

                      <h3>
                                                  Academic Information          

                      </h3>

                      <p>
                                                  Year level and class          
                                        assignment                        {" "}
                      </p>

                    </div>

                  </div>

                  <div className="student-info-grid">

                    <div className="student-info-item student-info-item-wide">

                      <span className="student-info-label">
                                                  Course                      

                      </span>

                      <strong>
                                                  {studentData.course}         

                      </strong>

                    </div>

                    <div className="student-info-item">

                      <span className="student-info-label">
                                                  Year Level                    

                      </span>

                      <strong>
                                                  {studentData.year}           

                      </strong>

                    </div>

                    <div className="student-info-item">

                      <span className="student-info-label">
                                                  Section                      

                      </span>

                      <strong>
                                                  {studentData.section}         

                      </strong>

                    </div>

                  </div>

                </section>


              </div>

            </div>

          </section>
        )}

        <JoinCourseModal
          open={joinModalOpen}

          courseCode={courseCode}

          onCourseCodeChange={setCourseCode}

          onCancel={closeJoinModal}

          onJoin={joinByCourseCode}
        />

      </main>

    </div>
  );
}
