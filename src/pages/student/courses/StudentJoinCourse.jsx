import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { requestCourseEnrollmentByCode } from "./courseEnrollment.js";

export default function StudentJoinCourse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const courseCode =
    searchParams.get("courseCode") || searchParams.get("code") || "";

  useEffect(() => {
    let active = true;

    async function joinCourse() {
      const result = await requestCourseEnrollmentByCode(courseCode, {
        isActive: () => active,
      });

      if (!active) return;

      if (result?.enrolled) {
        const course = result.course;
        navigate(`/student/enrolled-courses/${course.id || course.code}`, {
          replace: true,
        });

        return;
      }

      navigate("/student/public-courses", {
        replace: true,
      });
    }

    joinCourse();

    return () => {
      active = false;
    };
  }, [courseCode, navigate]);

  return null;
}
