import Swal from "sweetalert2";
import { API_BASE } from "../config.js";
import { lessonAuthHeaders } from "./lessonAuth.js";
import "./mainQuizAccess.css";

async function requestMainQuiz(path, { signal, body } = {}) {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(`${API_BASE}/lessons/main-quiz/${path}`, {
    credentials: "include",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: {
      ...lessonAuthHeaders(),
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { method: "POST", body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) {
    const error = new Error(
      data.message || "Could not check Main Quiz access.",
    );
    error.retryAfterSeconds = data.retryAfterSeconds;
    throw error;
  }
  return data;
}

export async function getMainQuizStatus(courseId, moduleId, signal) {
  const course = encodeURIComponent(courseId);
  const module = encodeURIComponent(moduleId);
  const data = await requestMainQuiz(`status/${course}/${module}`, { signal });
  if (typeof data.status?.taken !== "boolean") {
    throw new Error("Could not check Main Quiz access.");
  }
  return data.status;
}

async function verifyEmail(courseId, moduleId, signal) {
  const scope = { course_id: courseId, module_id: moduleId };
  const lifetime = new AbortController();
  const requestSignal = signal
    ? AbortSignal.any([signal, lifetime.signal])
    : lifetime.signal;
  let popup;
  let timer;
  let resendButton;
  let status;
  let resendAt = 0;
  let sending = false;
  let verifying = false;

  function stopWhenAborted() {
    if (popup && Swal.getPopup() === popup) Swal.close();
  }

  function updateResendButton() {
    const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    resendButton.disabled = sending || verifying || seconds > 0;
    resendButton.textContent =
      seconds > 0 ? `Resend code in ${seconds}s` : "Resend code";
  }

  async function sendCode() {
    sending = true;
    Swal.getConfirmButton().disabled = true;
    status.textContent = "Sending verification code…";
    updateResendButton();
    try {
      const data = await requestMainQuiz("verification/send", {
        signal: requestSignal,
        body: scope,
      });
      if (requestSignal.aborted) return;
      if (data.verified === true) {
        Swal.close({
          isConfirmed: true,
          value: true,
          isDenied: false,
          isDismissed: false,
        });
        return;
      }
      resendAt = Date.now() + Number(data.retryAfterSeconds || 0) * 1000;
      status.textContent = data.codeAvailable
        ? "Check your registered email for the code. The code is valid for up to 5 minutes."
        : "A new code can be sent once the resend timer ends.";
    } catch (error) {
      if (requestSignal.aborted) return;
      resendAt = Date.now() + Number(error.retryAfterSeconds || 0) * 1000;
      status.textContent =
        error.name === "TimeoutError"
          ? "Sending took longer than expected. Check your email or try resending."
          : error.message;
    } finally {
      if (!requestSignal.aborted) {
        sending = false;
        Swal.getConfirmButton().disabled = false;
        updateResendButton();
      }
    }
  }

  const result = await Swal.fire({
    title: "Verify your account",
    html: '<p>Enter the code sent to your registered email to open the Main Quiz tutorial.</p><p class="main-quiz-otp-status" role="status"></p><button type="button" class="main-quiz-otp-resend">Resend code</button>',
    input: "text",
    inputLabel: "Verification code",
    inputAttributes: {
      inputmode: "numeric",
      autocomplete: "one-time-code",
      maxlength: "6",
    },
    confirmButtonText: "Verify",
    confirmButtonColor: "#7fa8d6",
    cancelButtonColor: "#fff",
    customClass: {
      container: "main-quiz-otp-overlay",
      popup: "main-quiz-otp-popup",
    },
    showCloseButton: true,
    closeButtonAriaLabel: "Close verification",
    showCancelButton: true,
    showLoaderOnConfirm: true,
    allowOutsideClick: false,
    didOpen(element) {
      popup = element;
      if (requestSignal.aborted) {
        stopWhenAborted();
        return;
      }
      signal?.addEventListener("abort", stopWhenAborted, { once: true });
      status = element.querySelector(".main-quiz-otp-status");
      resendButton = element.querySelector(".main-quiz-otp-resend");
      Swal.getInput().after(status, resendButton);
      resendButton.addEventListener("click", sendCode);
      timer = window.setInterval(updateResendButton, 1000);
      void sendCode();
    },
    willClose() {
      lifetime.abort();
      window.clearInterval(timer);
      signal?.removeEventListener("abort", stopWhenAborted);
    },
    inputValidator: (value) =>
      /^\d{6}$/.test(value)
        ? undefined
        : "Enter the six-digit verification code.",
    async preConfirm(code) {
      if (sending) return false;
      verifying = true;
      updateResendButton();
      status.textContent = "Checking the code…";
      try {
        const data = await requestMainQuiz("verification/confirm", {
          signal: requestSignal,
          body: { ...scope, code },
        });
        if (data.verified !== true)
          throw new Error("Could not verify the code.");
        return true;
      } catch (error) {
        if (!requestSignal.aborted) {
          status.textContent =
            error.name === "TimeoutError"
              ? "The verification timed out. Please try again."
              : error.message;
        }
        return false;
      } finally {
        verifying = false;
        updateResendButton();
      }
    },
  });
  return !signal?.aborted && result.isConfirmed && result.value === true;
}

export async function confirmMainQuizAccess(courseId, moduleId, signal) {
  if (signal?.aborted) return false;
  void Swal.fire({
    title: "Checking Main Quiz",
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
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
  if (access.verificationRequired !== false) {
    return verifyEmail(courseId, moduleId, signal);
  }
  Swal.close();
  return true;
}
