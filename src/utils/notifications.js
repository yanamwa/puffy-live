import { API_BASE } from "../config.js";

export const MANAGED_NOTIFICATION_STORAGE_KEY =
  "puffy-notifications-announcements";

export const LEGACY_NOTIFICATION_STORAGE_KEY = "admin-notifications";

const MANAGED_NOTIFICATION_READ_STORAGE_KEY =
  "puffy-managed-notification-read-state";

export const MANAGED_NOTIFICATION_EVENT = "puffy-managed-notifications-updated";

export const managedNotificationTargetOptions = [
  { value: "all", label: "All users" },
  { value: "student", label: "Students" },
  { value: "professor", label: "Professors" },
  { value: "admin", label: "Admins" },
  { value: "super_admin", label: "Super admins" }
];

const seedManagedNotifications = [];

function getBrowserStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJsonStorage(key, fallback) {
  const storage = getBrowserStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const saved = storage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function dispatchManagedNotificationEvent(detail = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(MANAGED_NOTIFICATION_EVENT, {
      detail,
    }),
  );
}

export function normalizeNotificationRole(role = "") {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (!normalized) return "";
  if (normalized === "superadmin" || normalized === "superadministrator") {
    return "superAdmin";
  }
  if (normalized === "administrator") return "admin";
  if (normalized === "instructor") return "professor";
  if (normalized === "learner") return "student";

  return normalized;
}

export function formatNotificationRoleLabel(role = "") {
  const normalizedRole = normalizeNotificationRole(role);

  if (normalizedRole === "superAdmin") return "Super admin";
  if (normalizedRole === "admin") return "Admin";
  if (normalizedRole === "professor") return "Professor";
  if (normalizedRole === "student") return "Student";

  return "User";
}

export function normalizeNotificationTarget(target = "all") {
  const normalized = String(target || "all")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (!normalized || normalized === "everyone") return "all";
  if (normalized === "allusers") return "all";
  if (normalized === "users") return "user";
  if (normalized === "students") return "student";
  if (normalized === "professors" || normalized === "instructors") {
    return "professor";
  }
  if (normalized === "admins" || normalized === "administrators") {
    return "admin";
  }
  if (
  normalized === "superadmin" ||
  normalized === "superadmins" ||
  normalized === "superadministrators"
) {
  return "super_admin";
}

  return normalizeNotificationRole(normalized) || "all";
}


export function notificationTargetsRole(target, role) {
  const normalizedTarget = normalizeNotificationTarget(target);
  const normalizedRole = normalizeNotificationRole(role);

  if (normalizedTarget === "all") return true;

  if (normalizedTarget === "user") {
    return ["student", "professor"].includes(normalizedRole);
  }

  if (normalizedTarget === "admin") {
    return ["admin", "superAdmin"].includes(normalizedRole);
  }

  if (normalizedTarget === "super_admin") {
    return normalizedRole === "superAdmin";
  }

  return normalizedTarget === normalizedRole;
}


function normalizeStoredNotification(notification, index = 0) {
  if (!notification || typeof notification !== "object") {
    return null;
  }

  const id =
    notification.id ||
    notification.notificationId ||
    notification.notification_id ||
    `${Date.now()}-${index}`;

  return {
    id: String(id),
    title: String(notification.title || "Notification"),
    message: String(notification.message || notification.body || ""),
    target: normalizeNotificationTarget(
      notification.target ||
        notification.sendTo ||
        notification.send_to ||
        notification.audience ||
        "all",
    ),
    createdAt:
      notification.createdAt ||
      notification.created_at ||
      notification.date ||
      new Date().toISOString(),
    createdByRole: normalizeNotificationRole(
      notification.createdByRole ||
        notification.created_by_role ||
        notification.creatorRole ||
        "",
    ),
    createdByName: String(
      notification.createdByName ||
        notification.created_by_name ||
        notification.creatorName ||
        notification.creator_name ||
        notification.authorName ||
        notification.author_name ||
        notification.createdBy ||
        notification.created_by ||
        "",
    ),
    type: String(notification.type || "announcement").trim() || "announcement",
  };
}

function getNotificationTimestamp(notification) {
  const timestamp = new Date(notification.createdAt).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function newestFirst(a, b) {
  return getNotificationTimestamp(b) - getNotificationTimestamp(a);
}

function keepOnlyNewestNotification(notifications) {
  const uniqueNotifications = new Map();

  notifications.forEach((notification) => {
    if (!notification) return;

    const id = String(
      notification.id ||
        notification.notificationId ||
        notification.notification_id ||
        "",
    );

    if (!id) return;

    uniqueNotifications.set(id, notification);
  });

  return [...uniqueNotifications.values()].sort(newestFirst);
}

function isAnnouncementNotification(notification) {
  return (
    String(notification?.type || "announcement").toLowerCase() ===
    "announcement"
  );
}

export function readManagedNotifications() {
  const storage = getBrowserStorage();

  if (!storage) {
    return seedManagedNotifications.map(normalizeStoredNotification);
  }

  try {
    const saved = storage.getItem(MANAGED_NOTIFICATION_STORAGE_KEY);

    storage.removeItem(LEGACY_NOTIFICATION_STORAGE_KEY);

    const source = saved ? JSON.parse(saved) : seedManagedNotifications;
    const notifications = Array.isArray(source) ? source : [];
    const newestNotifications = keepOnlyNewestNotification(
      notifications
        .map(normalizeStoredNotification)
        .filter(
          (notification) =>
            notification && isAnnouncementNotification(notification),
        ),
    );

    if (saved) {
      storage.setItem(
        MANAGED_NOTIFICATION_STORAGE_KEY,
        JSON.stringify(newestNotifications),
      );
    }

    return newestNotifications;
  } catch {
    return keepOnlyNewestNotification(
      seedManagedNotifications.map(normalizeStoredNotification).filter(Boolean),
    );
  }
}

export function writeManagedNotifications(notifications) {
  const storage = getBrowserStorage();
  const normalizedNotifications = keepOnlyNewestNotification(
    Array.isArray(notifications)
      ? notifications
          .map(normalizeStoredNotification)
          .filter(
            (notification) =>
              notification && isAnnouncementNotification(notification),
          )
      : [],
  );

  if (storage) {
    storage.setItem(
      MANAGED_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(normalizedNotifications),
    );
    storage.removeItem(LEGACY_NOTIFICATION_STORAGE_KEY);
  }

  dispatchManagedNotificationEvent({
    notifications: normalizedNotifications,
  });

  return normalizedNotifications;
}

export function createManagedNotification({
  title,
  message,
  target = "all",
  createdByRole = "",
  createdByName = "",
}) {
  return normalizeStoredNotification({
    id: Date.now(),
    title,
    message,
    target,
    createdByRole,
    createdByName,
    type: "announcement",
    createdAt: new Date().toISOString(),
  });
}

function readStoredUser() {
  const storage = getBrowserStorage();

  if (!storage) return null;

  const candidates = [
    storage.getItem("puffy-user"),
    storage.getItem("user"),
    storage.getItem("currentUser"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

function getAudienceKey(role, user = readStoredUser()) {
  const storage = getBrowserStorage();
  const normalizedRole = normalizeNotificationRole(role) || "user";
  const identity =
    user?.userId ||
    user?.user_id ||
    user?.id ||
    user?.email ||
    storage?.getItem("user_id") ||
    storage?.getItem("user_email") ||
    storage?.getItem("email") ||
    "guest";

  return `${normalizedRole}:${identity}`;
}

function readReadState() {
  return readJsonStorage(MANAGED_NOTIFICATION_READ_STORAGE_KEY, {});
}

function writeReadState(state) {
  const storage = getBrowserStorage();

  if (storage) {
    storage.setItem(
      MANAGED_NOTIFICATION_READ_STORAGE_KEY,
      JSON.stringify(state),
    );
  }

  dispatchManagedNotificationEvent({
    readState: state,
  });
}

function normalizeManagedNotificationId(notificationOrId) {
  const id =
    typeof notificationOrId === "object"
      ? notificationOrId.managedSourceId ||
        notificationOrId.sourceId ||
        notificationOrId.id
      : notificationOrId;

  return String(id || "").replace(/^managed-/, "");
}

function getStoredToken() {
  if (typeof window === "undefined") return "";

  const storages = [];

  try {
    if (window.localStorage) storages.push(window.localStorage);
  } catch {
    // Ignore inaccessible storage.
  }

  try {
    if (window.sessionStorage) storages.push(window.sessionStorage);
  } catch {
    // Ignore inaccessible storage.
  }

  const tokenKeys = ["puffy-token", "token", "authToken"];

  for (const storage of storages) {
    for (const key of tokenKeys) {
      const token = storage.getItem(key);

      if (token) return token;
    }
  }

  return "";
}

async function requestManagedNotificationApi(path, options = {}) {
  const token = getStoredToken();

  if (!token) {
    throw new Error("Authentication token is missing.");
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Notification request failed.");
  }

  return data;
}

function normalizeNotificationApiPayload(data, fallback = []) {
  const source = Array.isArray(data?.notifications)
    ? data.notifications
    : data?.notification
      ? [data.notification]
      : fallback;

  return keepOnlyNewestNotification(
    source
      .map(normalizeStoredNotification)
      .filter(
        (notification) =>
          notification && isAnnouncementNotification(notification),
      ),
  );
}


export async function fetchManagedNotificationsFromServer() {
  const data = await requestManagedNotificationApi(
    "/notifications/posted"
  );

  if (!Array.isArray(data.notifications)) {
    throw new Error("Invalid posted notifications response.");
  }

  const notifications = normalizeNotificationApiPayload(data);

  return writeManagedNotifications(notifications);
}



export async function saveManagedNotificationToServer(notification) {
  const normalizedNotification =
    normalizeStoredNotification(notification);

  if (!normalizedNotification) {
    throw new Error("Notification is invalid.");
  }

  await requestManagedNotificationApi("/notifications", {
    method: "POST",
    body: JSON.stringify({
      title: normalizedNotification.title,
      message: normalizedNotification.message,
      target: normalizedNotification.target,
      type: "announcement",
    }),
  });

  return await fetchManagedNotificationsFromServer();
}



export async function deleteManagedNotificationFromServer(
  notificationOrId
) {
  const notificationId =
    normalizeManagedNotificationId(notificationOrId);

  if (!notificationId) {
    throw new Error("Notification id is invalid.");
  }

  await requestManagedNotificationApi(
    `/notifications/${encodeURIComponent(notificationId)}`,
    {
      method: "DELETE",
    }
  );

  return await fetchManagedNotificationsFromServer();
}


let lastManagedNotificationServerSyncAt = 0;

function syncManagedNotificationsFromServerSoon() {
  if (typeof window === "undefined") return;

  const now = Date.now();

  if (now - lastManagedNotificationServerSyncAt < 3000) return;

  lastManagedNotificationServerSyncAt = now;
  fetchManagedNotificationsFromServer().catch(() => {});
}

export function markManagedNotificationAsReadForRole(
  role,
  notificationOrId,
  user,
) {
  const notificationId = normalizeManagedNotificationId(notificationOrId);

  if (!notificationId) return;

  const isManagedNotification = readManagedNotifications().some(
    (notification) => notification.id === notificationId,
  );

  if (!isManagedNotification) return;

  const state = readReadState();
  const audienceKey = getAudienceKey(role, user);

  state[audienceKey] = {
    ...(state[audienceKey] || {}),
    [notificationId]: true,
  };

  writeReadState(state);
}

export function markManagedNotificationsAsReadForRole(
  role,
  notificationIds,
  user,
) {
  const normalizedRole = normalizeNotificationRole(role);
  const ids =
    Array.isArray(notificationIds) && notificationIds.length > 0
      ? notificationIds.map(normalizeManagedNotificationId).filter(Boolean)
      : readManagedNotifications()
          .filter((notification) =>
            notificationTargetsRole(notification.target, normalizedRole),
          )
          .map((notification) => notification.id);

  if (ids.length === 0) return;

  const state = readReadState();
  const audienceKey = getAudienceKey(normalizedRole, user);

  state[audienceKey] = {
    ...(state[audienceKey] || {}),
  };

  ids.forEach((id) => {
    state[audienceKey][id] = true;
  });

  writeReadState(state);
}

export function formatNotificationTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)} minutes ago`;
  if (diff < day) return `${Math.floor(diff / hour)} hours ago`;
  if (diff < 2 * day) return "Yesterday";

  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatNotificationTarget(value) {
  const target = normalizeNotificationTarget(value);
  const option = managedNotificationTargetOptions.find(
    (item) => item.value === target,
  );

  if (option) return option.label;
  if (target === "user") return "Users";

  return target || "All users";
}

function normalizeNotificationLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function isEmailLike(value) {
  return /\S+@\S+/.test(String(value || ""));
}

function getSafeNotificationCreatorName(value, roleLabel) {
  const creatorName = String(value || "")
    .replace(/^@+/, "")
    .trim();

  if (!creatorName || isEmailLike(creatorName)) return "";
  if (
    normalizeNotificationLabel(creatorName) ===
    normalizeNotificationLabel(roleLabel)
  ) {
    return "";
  }

  return creatorName;
}

export function formatNotificationCreator(
  notification = {},
  { includeName = true } = {},
) {
  const creatorRole = formatNotificationRoleLabel(notification.createdByRole);
  const creatorName = includeName
    ? getSafeNotificationCreatorName(notification.createdByName, creatorRole)
    : "";

  if (creatorName) {
    return `Posted by ${creatorName}, ${creatorRole}`;
  }

  return `Posted by ${creatorRole}`;
}

export function getManagedNotificationsForRole(role, user) {
  const normalizedRole = normalizeNotificationRole(role);
  const state = readReadState();
  const readForAudience = state[getAudienceKey(normalizedRole, user)] || {};
  const isPublicAudience = ["student", "professor"].includes(normalizedRole);

  return readManagedNotifications()
    .filter(
      (notification) =>
        isAnnouncementNotification(notification) &&
        notificationTargetsRole(notification.target, normalizedRole),
    )
    .sort(newestFirst)
    .map((notification) => {
      const creatorLabel = formatNotificationCreator(notification, {
        includeName: !isPublicAudience,
      });
      const createdTime = formatNotificationTime(notification.createdAt);

      return {
        ...notification,
        id: `managed-${notification.id}`,
        managedSourceId: notification.id,
        icon: "announcement",
        isManagedNotification: true,
        course: "Announcement",
        creatorLabel,
        createdTime,
        time: isPublicAudience
          ? createdTime
          : `${creatorLabel} • ${createdTime}`,
        unread: !readForAudience[notification.id],
        status: readForAudience[notification.id] ? "read" : "unread",
      };
    });
}

export function mergeManagedNotificationsForRole(
  role,
  notifications = [],
  user,
) {
  return getManagedNotificationsForRole(role, user);
}

export function subscribeToManagedNotifications(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event) => {
    if (
      event.key !== MANAGED_NOTIFICATION_STORAGE_KEY &&
      event.key !== LEGACY_NOTIFICATION_STORAGE_KEY &&
      event.key !== MANAGED_NOTIFICATION_READ_STORAGE_KEY
    ) {
      return;
    }

    callback(event);
  };

  const handleManagedNotificationEvent = (event) => {
    callback(event);
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(
    MANAGED_NOTIFICATION_EVENT,
    handleManagedNotificationEvent,
  );
  syncManagedNotificationsFromServerSoon();

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      MANAGED_NOTIFICATION_EVENT,
      handleManagedNotificationEvent,
    );
  };
}
