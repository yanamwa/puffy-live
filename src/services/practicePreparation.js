export const PRACTICE_QUESTION_COUNT = 10;
const REQUEST_TIMEOUT_MS = 30_000;
const QUEUE_WAIT_MS = 15 * 60_000;
const GENERATION_WAIT_MS = 240_000;

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
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const read = async (action, payload) => {
    controller.signal.throwIfAborted();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await request(action, payload, { signal: controller.signal });
      controller.signal.throwIfAborted();
      return data;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let data = await read("start", body);
    // Accept a complete response during a rolling backend deployment.
    if (data.attempt) return requireCompletePractice(data.attempt);
    const jobId = data.job?.id;
    if (!jobId)
      throw new Error(
        "Practice preparation could not start. Please try again.",
      );
    let pollDelay = 2000;
    // Allow a final status request to deliver the server's terminal result.
    const queueDeadline = Date.now() + QUEUE_WAIT_MS + REQUEST_TIMEOUT_MS;
    let runningDeadline;
    while (true) {
      const job = data.job;
      if (job?.id !== jobId) throw new Error("Practice preparation could not be loaded. Please try again.");
      if (job?.status === "ready") return requireCompletePractice(job.attempt);
      if (job?.status === "failed") {
        throw Object.assign(
          new Error(
            job.error?.message ||
              "Practice could not be prepared. Please try again.",
          ),
          { code: job.error?.code, status: job.error?.status },
        );
      }
      if (!["queued", "running"].includes(job?.status)) {
        throw new Error(
          "Practice preparation could not be loaded. Please try again.",
        );
      }
      if (job.status === "running" && runningDeadline === undefined)
        runningDeadline = Date.now() + GENERATION_WAIT_MS + REQUEST_TIMEOUT_MS;
      // An expired lease can briefly look queued again. Keep the first run's
      // deadline so repeated restarts or a stuck worker cannot extend it.
      if (Date.now() >= (runningDeadline ?? queueDeadline))
        throw new Error(runningDeadline === undefined
          ? "Your practice waited too long in the queue. Please try again."
          : "Practice preparation timed out. Please try again.");
      onProgress?.(job.status);
      await wait(pollDelay, controller.signal);
      data = await read(`jobs/${encodeURIComponent(jobId)}`);
      pollDelay = Math.min(pollDelay + 1000, 6000);
    }
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted)
      throw new Error("Practice preparation timed out.");
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
