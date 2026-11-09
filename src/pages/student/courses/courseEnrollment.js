import Swal from "sweetalert2";
import {
  enrollStudentInCourseAsync,
  findJoinableCourseByCodeAsync,
} from "./studentCourseData.js";

export async function requestCourseEnrollmentByCode(
  code,
  { onSubmitted, isActive = () => true } = {},
) {
  const courseCode = String(code || "").trim();
  const alertOptions = {
    confirmButtonText: "OK",
    confirmButtonColor: "#7FA8D6",
  };

  if (!courseCode) {
    await Swal.fire({
      ...alertOptions,
      icon: "warning",
      title: "Enter Course Code",
      text: "Please enter the course code provided by your professor.",
    });
    return null;
  }

  try {
    const course = await findJoinableCourseByCodeAsync(courseCode);

    if (!isActive()) return null;

    if (!course) {
      await Swal.fire({
        ...alertOptions,
        icon: "error",
        title: "Course Not Found",
        text: "Course code not found. Please check the code from your professor.",
      });
      return null;
    }

    const result = await enrollStudentInCourseAsync(course);
    if (!isActive()) return result;
    onSubmitted?.(result);

    await Swal.fire({
      ...alertOptions,
      icon: result.alreadyEnrolled || result.alreadyRequested ? "info" : "success",
      title: result.alreadyEnrolled
        ? "Already Enrolled"
        : result.enrolled
          ? "Enrollment Confirmed"
          : result.alreadyRequested
            ? "Request Already Sent"
            : "Enrollment Request Sent",
      text: result.message,
    });

    return result;
  } catch (error) {
    if (!isActive()) return null;
    await Swal.fire({
      ...alertOptions,
      icon: "error",
      title: "Unable to Send Request",
      text:
        error?.message ||
        "Could not send your enrollment request. Please try again.",
    });
    return null;
  }
}
