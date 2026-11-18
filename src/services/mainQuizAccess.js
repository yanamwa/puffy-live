import Swal from "sweetalert2";
import { API_BASE } from "../config.js";
import { lessonAuthHeaders } from "./lessonAuth.js";

export async function getMainQuizStatus(courseId, moduleId, signal) {
  const course = encodeURIComponent(courseId);
  const module = encodeURIComponent(moduleId);
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(
    `${API_BASE}/lessons/main-quiz/status/${course}/${module}`,
    {
      credentials: "include",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: lessonAuthHeaders(),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) {
    throw new Error(data.message || "Could not check Main Quiz access.");
  }
  if (typeof data.status?.taken !== "boolean") {
    throw new Error("Could not check Main Quiz access.");
  }
  return data.status;
}

export async function confirmMainQuizAccess(courseId, moduleId, signal) {
  if (signal?.aborted) return false;
  void Swal.fire({
    title: "Checking Main Quiz",
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen(element) {
      if (Swal.getPopup() === element) Swal.showLoading();
    },
  });
  const popup = Swal.getPopup();
  const ownsPopup = () => Swal.getPopup() === popup;
  const closeCheck = () => {
    if (ownsPopup()) Swal.close();
  };
  signal?.addEventListener("abort", closeCheck, { once: true });

  let access;
  try {
    access = await getMainQuizStatus(courseId, moduleId, signal);
  } catch (error) {
    if (!signal?.aborted && ownsPopup()) {
      await Swal.fire({
        icon: "info",
        title: "Main Quiz unavailable",
        text:
          error.name === "TimeoutError"
            ? "The access check timed out. Please try again."
            : error.message,
        confirmButtonText: "OK",
      });
    }
    return false;
  } finally {
    signal?.removeEventListener("abort", closeCheck);
  }
  if (signal?.aborted || !ownsPopup()) return false;
  if (access.taken) {
    await Swal.fire({
      imageUrl: "/images/reminder.png?v=2",
      imageWidth: 300,
      imageAlt: "Quiz reminder",
      customClass: {
        popup: "student-reminder-popup",
        title: "student-reminder-title",
      },
      title: "Main Quiz already taken",
      text: "You have already taken this Main Quiz.",
      confirmButtonText: "OK",
    });
    return false;
  }
  Swal.close();
  return true;
}
