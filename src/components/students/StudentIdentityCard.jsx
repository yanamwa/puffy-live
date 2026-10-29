import "./StudentIdentityCard.css";

import { API_BASE as API_BASE_URL } from "../../config.js";

const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const DEFAULT_PROFILE_IMAGE = "/images/temporaryimg.png";

function resolveProfileImage(imagePath) {
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

function normalizeStudent(student = {}) {
  return {
    name:
      student.displayName ||
      student.display_name ||
      student.name ||
      student.fullName ||
      student.full_name ||
      student.studentName ||
      "Student",

    studentNumber:
      student.studentId ||
      student.student_id ||
      student.studentNumber ||
      student.student_number ||
      student.verificationId ||
      student.verification_id ||
      "Not assigned",

    course:
      student.course ||
      student.program ||
      student.courseName ||
      student.course_name ||
      student.programName ||
      student.program_name ||
      "Program not set",

    year: student.yearLevel || student.year_level || student.year || "Not set",

    section:
      student.sectionName ||
      student.section_name ||
      student.section ||
      "Not set",

    profileImage:
      student.profileImage ||
      student.profile_image ||
      student.avatar ||
      student.image ||
      "",
  };
}

export default function StudentIdentityCard({
  student,
  editable = false,
  profileImage,
  profileImageUploading = false,
  onProfileImageChange,
}) {
  const data = normalizeStudent(student);

  const imageSource = profileImage || resolveProfileImage(data.profileImage);

  return (
    <article className="student-identity-card">
      <div className="student-identity-card-accent" />

      <div className="student-identity-header">
        <div className="student-identity-brand">
          <img src="/images/puffybrain.png" alt="PuffyBrain" />

          <div>
            <strong>PuffyBrain</strong>
            <span>Student Identification Card</span>
          </div>
        </div>

        <span className="student-identity-role">Student</span>
      </div>

      <div className="student-identity-photo-area">
        <div className="student-id-photo-frame">
          <img
            src={imageSource}
            alt={`${data.name}'s profile`}
            className="student-id-photo"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
            }}
          />

          {editable && (
            <label
              className="student-photo-change-button"
              title="Change profile picture"
              aria-label="Change profile picture"
            >
              {profileImageUploading ? (
                <span className="student-photo-uploading">...</span>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z" />
                  <circle cx="12" cy="13.5" r="3.2" />
                </svg>
              )}

              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="student-photo-input"
                onChange={onProfileImageChange}
                disabled={profileImageUploading}
              />
            </label>
          )}
        </div>

        <div className="student-identity-main">
          <span className="student-identity-overline">
            Official student profile
          </span>

          <h2>{data.name}</h2>

          <strong className="student-identity-number">
            {data.studentNumber}
          </strong>

          <p>{data.course}</p>

          <div className="student-identity-academic-row">
            <span>{data.year}</span>

            <i aria-hidden="true" />

            <span>{data.section}</span>
          </div>
        </div>
      </div>

      <div className="student-identity-footer">
        <div>
          <span>Issued by</span>
          <strong>PuffyBrain Learning System</strong>
        </div>
      </div>
    </article>
  );
}
