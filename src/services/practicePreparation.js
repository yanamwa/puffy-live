export const PRACTICE_QUESTION_COUNT = 10;

export function requireCompletePractice(attempt) {
  if (
    attempt?.total !== PRACTICE_QUESTION_COUNT ||
    !Array.isArray(attempt.questions) ||
    attempt.questions.length !== PRACTICE_QUESTION_COUNT
  )
    throw new Error(
      "Practice needs all 10 questions. Please try preparing it again.",
    );
  return attempt;
}

const pause = (ms, signal) =>
  new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });

export async function waitForPractice(
  request,
  body,
  { signal, onProgress, wait = pause } = {},
) {
  let data = await request("start", body, { signal });
  // Accept a complete response during a rolling backend deployment, never a recap.
  if (data.attempt) return requireCompletePractice(data.attempt);
  const jobId = data.job?.id;
  if (!jobId)
    throw new Error("Practice preparation could not start. Please try again.");
  while (true) {
    const job = data.job;
    if (job?.status === "ready") return requireCompletePractice(job.attempt);
    if (job?.status === "failed") {
      throw Object.assign(
        new Error(
          job.error?.message ||
            "Practice could not be prepared. Please try again.",
        ),
        {
          code: job.error?.code,
          status: job.error?.status,
        },
      );
    }
    if (!["queued", "running"].includes(job?.status))
      throw new Error(
        "Practice preparation could not be loaded. Please try again.",
      );
    onProgress?.(job.status);
    await wait(2000, signal);
    data = await request(`jobs/${encodeURIComponent(jobId)}`, undefined, {
      signal,
    });
  }
}
