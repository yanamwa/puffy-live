import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import StudentSidebar from "../../../components/students/StudentSidebar";
import StudentHeader from "../../../components/students/StudentHeader";
import { Avatar, SortToggle } from "../enrolled/EnrolledCourses";
import JoinCourseModal from "../courses/JoinCourseModal";

import {
  enrollStudentInCourseAsync,
  findJoinableCourseByCodeAsync,
  loadStudentArchivedCourses,
} from "../courses/studentCourseData";

import "../enrolled/EnrolledCourses.css";
import "./ArchivedCourses.css";

import { API_BASE as API_BASE_URL } from "../../../config.js";

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

function normalizeArchivedCourse(course) {
  const title =
    course.title ||
    course.courseName ||
    course.course_name ||
    course.subject ||
    "Untitled course";

  const code =
    course.code || course.courseCode || course.course_code || "COURSE";

  return {
    ...course,
    id: course.id || course.course_id || code,
    code,
    title,
    instructor:
      course.professorName ||
      course.professor_name ||
      course.instructor ||
      course.instructorName ||
      "Professor",
    professorDepartment:
      course.professorDepartment ||
      course.professor_department ||
      course.database_professor_department ||
      course.department ||
      "",
    professorProfileImage:
      course.professorProfileImage ||
      course.professor_profile_image ||
      course.database_professor_profile_image ||
      course.professorAvatar ||
      course.professor_avatar ||
      "",
  };
}

function getArchivedCourseTitle(course) {
  return course.code && course.code !== "COURSE"
    ? `${course.code} - ${course.title}`
    : course.title;
}

function getProfessorDepartment(course) {
  return (
    course.professorDepartment ||
    course.professor_department ||
    "Department not set"
  );
}

function getCourseTimestamp(course) {
  const rawDate =
    course.archivedAt ||
    course.archived_at ||
    course.updatedAt ||
    course.updated_at ||
    course.createdAt ||
    course.created_at ||
    "";

  const timestamp = Date.parse(rawDate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function ArchivedCourses() {
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [courseCode, setCourseCode] = useState("");

  const [archivedCourses, setArchivedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesErrorMessage, setCoursesErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [dateSort, setDateSort] = useState("Recent");
  const [titleSort, setTitleSort] = useState("A to Z");
  const [activeSort, setActiveSort] = useState("date");

  const filteredArchivedCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return archivedCourses
      .filter((course) => {
        if (!query) return true;

        return [
          course.code,
          course.title,
          course.instructor,
          course.professorDepartment,
          course.professor_department,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((firstCourse, secondCourse) => {
        if (activeSort === "title") {
          const direction = titleSort === "A to Z" ? 1 : -1;

          return (
            getArchivedCourseTitle(firstCourse).localeCompare(
              getArchivedCourseTitle(secondCourse),
            ) * direction
          );
        }

        const direction = dateSort === "Recent" ? -1 : 1;
        const difference =
          getCourseTimestamp(firstCourse) - getCourseTimestamp(secondCourse);

        if (difference !== 0) {
          return difference * direction;
        }

        return getArchivedCourseTitle(firstCourse).localeCompare(
          getArchivedCourseTitle(secondCourse),
        );
      });
  }, [activeSort, archivedCourses, dateSort, searchQuery, titleSort]);

  useEffect(() => {
    let active = true;

    async function loadArchivedCourses() {
      try {
        setLoadingCourses(true);
        setCoursesErrorMessage("");

        const loadedCourses = await loadStudentArchivedCourses();

        if (!active) return;

        setArchivedCourses(
          Array.isArray(loadedCourses)
            ? loadedCourses.map(normalizeArchivedCourse)
            : [],
        );
      } catch (error) {
        console.error("Archived courses loading error:", error);

        if (active) {
          setArchivedCourses([]);
          setCoursesErrorMessage(
            error.message || "Could not load archived classes.",
          );
        }
      } finally {
        if (active) {
          setLoadingCourses(false);
        }
      }
    }

    loadArchivedCourses();

    return () => {
      active = false;
    };
  }, []);

  const closeJoinModal = () => {
    setJoinModalOpen(false);
    setCourseCode("");
  };

  const joinByCourseCode = async () => {
    const trimmedCode = courseCode.trim();

    if (!trimmedCode) {
      await Swal.fire({
        icon: "warning",
        title: "Enter Course Code",
        text: "Please enter the course code provided by your professor.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
      return;
    }

    try {
      const course = await findJoinableCourseByCodeAsync(trimmedCode);

      if (!course) {
        await Swal.fire({
          icon: "error",
          title: "Course Not Found",
          text: "Course code not found. Please check the code from your professor.",
          confirmButtonText: "OK",
          confirmButtonColor: "#7FA8D6",
        });
        return;
      }

      await enrollStudentInCourseAsync(course);
      closeJoinModal();

      await Swal.fire({
        icon: "success",
        title: "Course Joined!",
        text: `You have successfully joined ${
          course.title ||
          course.courseName ||
          course.course_name ||
          course.name ||
          "the course"
        }.`,
        confirmButtonText: "Continue",
        confirmButtonColor: "#7FA8D6",
      });
    } catch (error) {
      console.error("Join course error:", error);

      await Swal.fire({
        icon: "error",
        title: "Unable to Join Course",
        text:
          error?.message || "Something went wrong while joining the course.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    }
  };

  return (
    <div className="archived-courses-page">
      <StudentSidebar />

      <div className="archived-courses-main-area">
        <StudentHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search your course"
          onJoinCourse={() => setJoinModalOpen(true)}
        />

        <main className="archived-courses-content">
          <section className="public-heading archived-heading">
            <h1>Archived Classes</h1>

            <div className="filter-actions">
              <span className="sort-by-label">Sort by</span>

              <SortToggle
                options={["Recent", "Oldest"]}
                value={dateSort}
                onChange={(value) => {
                  setDateSort(value);
                  setActiveSort("date");
                }}
              />

              <SortToggle
                options={["A to Z", "Z to A"]}
                value={titleSort}
                onChange={(value) => {
                  setTitleSort(value);
                  setActiveSort("title");
                }}
              />
            </div>
          </section>

          <div className="archive-notice" role="status">
            Course has been archived by your teacher. You cannot add or edit
            anything.
          </div>

          <section
            className="public-courses-grid archived-courses-grid"
            aria-label="Archived courses"
          >
            {loadingCourses ? (
              <div className="student-empty-state">
                Loading archived classes...
              </div>
            ) : coursesErrorMessage ? (
              <div className="student-empty-state">{coursesErrorMessage}</div>
            ) : filteredArchivedCourses.length === 0 ? (
              <div className="student-empty-state">
                {searchQuery.trim()
                  ? "No archived classes match your search."
                  : "No archived classes yet."}
              </div>
            ) : (
              filteredArchivedCourses.map((course) => (
                <article
                  key={course.id || course.code}
                  className="course-folder archived-course-folder"
                >
                  <span className="archived-course-badge">Archived</span>

                  <div className="course-card-body">
                    <h2>{getArchivedCourseTitle(course)}</h2>
                  </div>

                  <div className="course-card-footer">
                    <Avatar
                      src={
                        course.professorProfileImage
                          ? resolveProfileImage(course.professorProfileImage)
                          : undefined
                      }
                      alt={`${course.instructor}'s profile`}
                    />

                    <div className="archived-course-meta">
                      <span>{course.instructor}</span>
                      <small>{getProfessorDepartment(course)}</small>
                    </div>

                    <button
                      type="button"
                      className="archived-view-button"
                      disabled
                    >
                      View only
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </main>
      </div>

      <JoinCourseModal
        open={joinModalOpen}
        courseCode={courseCode}
        onCourseCodeChange={setCourseCode}
        onCancel={closeJoinModal}
        onJoin={joinByCourseCode}
      />
    </div>
  );
}
