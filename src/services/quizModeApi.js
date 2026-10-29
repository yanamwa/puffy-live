import { API_BASE } from "../config.js";

/* =====================================================
   LOCAL MODE CONSTANTS

   These are kept for compatibility with other parts
   of PuffyBrain that may still use local mode data.

   Super Admin CRUD operations themselves do NOT
   silently fall back to localStorage.
===================================================== */

export const ADMIN_MODES_KEY = "admin-modes";

export const ADMIN_MODES_EVENT = "admin-modes-updated";

export const ADMIN_MODES_SEED_VERSION_KEY = "admin-modes-seed-version";

export const ADMIN_MODES_SEED_VERSION = "3";

/* =====================================================
   DEFAULT QUIZ MODES
===================================================== */

export const quizModeSeeds = [
  {
    id: 8113789,
    kind: "flashcard",
    title: "Flashcards",

    description:
      "Review facts and test your memory in a fun and quick way. Perfect for learning on the go!",

    route: "/flashcards-tutorial",

    image: "/images/flashcard.png",
  },

  {
    id: 5515895,
    kind: "qna",
    title: "Q & A",

    description:
      "Challenge your brain with interesting questions and discover something new every time you play!",

    route: "/QandA-tutorial",

    image: "/images/qna.png",
  },

  {
    id: 9218948,
    kind: "multiple",
    title: "Multiple Choice",

    description:
      "Only one answer is correct. Trust your instincts, think carefully, and aim for that perfect score!",

    route: "/multipleChoice-tutorial",

    image: "/images/multiplechoice.png",
  },

  {
    id: 7291701,
    kind: "matching",
    title: "Matching Type",

    description:
      "Pair the terms, ideas, or clues correctly. It's a fun way to test your memory and logic!",

    route: "/Matching-tutorial",

    image: "/images/matching.png",
  },

  {
    id: 7291702,
    kind: "timed",
    title: "Timed Quiz",

    description:
      "Answer questions within a time limit and build speed while reviewing the lesson.",

    route: "/timedquiz-tutorial",

    image: "/images/timedquiz.png",
  },

  {
    id: 7291703,
    kind: "mixed",
    title: "Mixed Mode",

    description:
      "Practice with matching type, multiple choice, and Q&A all at once.",

    route: "/random-modes-tutorial",

    image: "/images/mixed_match.png",
  },
];

/* =====================================================
   GET AUTH TOKEN
===================================================== */

function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

/* =====================================================
   AUTH HEADERS
===================================================== */

function getAuthHeaders(extraHeaders = {}) {
  const token = getAuthToken();

  return {
    ...extraHeaders,

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

/* =====================================================
   DISPATCH LOCAL UPDATE EVENT
===================================================== */

function dispatchModesUpdate(modes) {
  window.dispatchEvent(
    new CustomEvent(ADMIN_MODES_EVENT, {
      detail: {
        modes,
      },
    }),
  );
}

/* =====================================================
   NORMALIZE IMAGE
===================================================== */

function normalizeImagePath(value, title = "") {
  const image = String(value || "").trim();

  if (image) {
    return image;
  }

  const lowerTitle = String(title).toLowerCase();

  if (lowerTitle.includes("multiple")) {
    return "/images/multiplechoice.png";
  }

  if (lowerTitle.includes("matching")) {
    return "/images/matching.png";
  }

  if (lowerTitle.includes("mixed")) {
    return "/images/mixed_match.png";
  }

  if (lowerTitle.includes("random")) {
    return "/images/mixed_match.png";
  }

  if (lowerTitle.includes("survival")) {
    return "/images/mixed_match.png";
  }

  if (lowerTitle.includes("timed")) {
    return "/images/timedquiz.png";
  }

  if (lowerTitle.includes("q")) {
    return "/images/qna.png";
  }

  return "/images/flashcard.png";
}

/* =====================================================
   INFER MODE KIND
===================================================== */

function inferModeKind(mode, title) {
  const text =
    `${mode?.kind || ""} ` +
    `${mode?.quizMode || ""} ` +
    `${title || ""} ` +
    `${mode?.mode_name || ""} ` +
    `${mode?.route || ""}`.toLowerCase();

  if (
    text.includes("mixed") ||
    text.includes("random") ||
    text.includes("survival")
  ) {
    return "mixed";
  }

  if (text.includes("timed")) {
    return "timed";
  }

  if (text.includes("multiple")) {
    return "multiple";
  }

  if (text.includes("matching")) {
    return "matching";
  }

  if (text.includes("q")) {
    return "qna";
  }

  return "flashcard";
}

/* =====================================================
   NORMALIZE QUIZ MODE
===================================================== */

export function normalizeQuizMode(mode) {
  const id = mode?.id || mode?.mode_id || mode?.quiz_id || Date.now();

  const title = mode?.title || mode?.mode_name || "Untitled Mode";

  const kind = inferModeKind(mode, title);

  const description = String(mode?.description || "");

  const route = String(mode?.route || "");

  const isLegacyMixedMode =
    kind === "mixed" &&
    (String(id) === "7291703" ||
      /survival/i.test(title) ||
      /three lives|lives|life/i.test(description));

  return {
    ...mode,

    id,

    kind,

    mode_id: mode?.mode_id || id,

    quiz_id: mode?.quiz_id || id,

    title: isLegacyMixedMode ? "Mixed Mode" : title,

    mode_name: isLegacyMixedMode ? "Mixed Mode" : mode?.mode_name || title,

    description:
      isLegacyMixedMode || !description
        ? "Practice with matching type, multiple choice, and Q&A all at once."
        : description,

    route:
      kind === "mixed" &&
      (!route || route.includes("survival") || route.includes("mixed-mode"))
        ? "/random-modes-tutorial"
        : route,

    image: normalizeImagePath(mode?.image, title),
  };
}

/* =====================================================
   MERGE SEEDS

   Kept for local compatibility only.
===================================================== */

function mergeSeedModes(modes) {
  const normalized = modes.map(normalizeQuizMode);

  const existingKeys = new Set(
    normalized.flatMap((mode) => [
      String(mode.id),

      String(mode.kind || "").toLowerCase(),

      String(mode.route || "").toLowerCase(),

      String(mode.title || "").toLowerCase(),
    ]),
  );

  const missingSeeds = quizModeSeeds.map(normalizeQuizMode).filter((seed) => {
    const seedKeys = [
      String(seed.id),

      String(seed.kind || "").toLowerCase(),

      String(seed.route || "").toLowerCase(),

      String(seed.title || "").toLowerCase(),
    ];

    return !seedKeys.some((key) => key && existingKeys.has(key));
  });

  return [...normalized, ...missingSeeds];
}

/* =====================================================
   READ LOCAL MODES

   Other PuffyBrain pages can still use this if needed.
===================================================== */

export function readLocalQuizModes() {
  try {
    const saved = localStorage.getItem(ADMIN_MODES_KEY);

    const parsed = saved ? JSON.parse(saved) : quizModeSeeds;

    const normalized = Array.isArray(parsed)
      ? parsed.map(normalizeQuizMode)
      : quizModeSeeds.map(normalizeQuizMode);

    const seedVersion = localStorage.getItem(ADMIN_MODES_SEED_VERSION_KEY);

    if (saved && seedVersion !== ADMIN_MODES_SEED_VERSION) {
      const merged = mergeSeedModes(normalized);

      localStorage.setItem(ADMIN_MODES_KEY, JSON.stringify(merged));

      localStorage.setItem(
        ADMIN_MODES_SEED_VERSION_KEY,
        ADMIN_MODES_SEED_VERSION,
      );

      return merged;
    }

    if (!saved) {
      localStorage.setItem(
        ADMIN_MODES_SEED_VERSION_KEY,
        ADMIN_MODES_SEED_VERSION,
      );
    }

    return normalized;
  } catch (error) {
    console.error("Could not read local quiz modes:", error);

    return quizModeSeeds.map(normalizeQuizMode);
  }
}

/* =====================================================
   SAVE LOCAL MODES

   Kept for pages that listen for mode updates.
===================================================== */

export function saveLocalQuizModes(modes) {
  const normalized = modes.map(normalizeQuizMode);

  localStorage.setItem(ADMIN_MODES_KEY, JSON.stringify(normalized));

  localStorage.setItem(ADMIN_MODES_SEED_VERSION_KEY, ADMIN_MODES_SEED_VERSION);

  dispatchModesUpdate(normalized);

  return normalized;
}

/* =====================================================
   API REQUEST
===================================================== */

async function requestMode(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      ...options,

      credentials: "include",

      headers: getAuthHeaders(options.headers || {}),
    });
  } catch {
    throw new Error("Could not connect to the PuffyBrain server.");
  }

  const data = await response.json().catch(() => ({
    success: false,

    message: "Server returned an invalid response.",
  }));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Mode request failed.");
  }

  return data;
}

/* =====================================================
   FETCH MODES

   IMPORTANT:
   No silent localStorage fallback.

   If the API fails, the caller receives the error.
===================================================== */

export async function fetchQuizModes() {
  const data = await requestMode(`${API_BASE}/modes`, {
    method: "GET",
  });

  const modes = Array.isArray(data.modes)
    ? data.modes.map(normalizeQuizMode)
    : [];

  /*
    Keep the successful server result
    locally for other pages that may
    listen to ADMIN_MODES_EVENT.

    This local copy is NOT used to
    pretend a failed API call worked.
  */

  saveLocalQuizModes(modes);

  return modes;
}

/* =====================================================
   CREATE / UPDATE MODE

   IMPORTANT:
   A failed server request throws an error.

   We no longer create/update the mode locally
   when MySQL/API fails.
===================================================== */

export async function saveQuizMode(mode) {
  const hasId = Boolean(mode?.id || mode?.mode_id || mode?.quiz_id);

  const normalized = normalizeQuizMode(mode);

  const data = await requestMode(
    hasId
      ? `${API_BASE}/modes/${encodeURIComponent(normalized.id)}`
      : `${API_BASE}/modes`,

    {
      method: hasId ? "PUT" : "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        title: normalized.title,

        description: normalized.description,

        route: normalized.route,

        image: normalized.image,

        kind: normalized.kind,
      }),
    },
  );

  const savedMode = normalizeQuizMode(data.mode);

  /*
    Synchronize the successful
    database result to localStorage.
  */

  const currentModes = readLocalQuizModes();

  const nextModes = hasId
    ? currentModes.map((item) =>
        String(item.id) === String(savedMode.id) ? savedMode : item,
      )
    : [savedMode, ...currentModes];

  saveLocalQuizModes(nextModes);

  return savedMode;
}

/* =====================================================
   DELETE MODE

   IMPORTANT:
   Local copy is changed ONLY after the
   server confirms successful deletion.
===================================================== */

export async function deleteQuizModeById(id) {
  await requestMode(`${API_BASE}/modes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  const nextModes = readLocalQuizModes().filter(
    (mode) => String(mode.id) !== String(id),
  );

  saveLocalQuizModes(nextModes);

  return true;
}
