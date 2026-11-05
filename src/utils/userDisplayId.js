const rolePrefixes = {
  student: "STD",
  professor: "PRF",
  admin: "AD",
  super_admin: "SPAD",
};

export function formatUserDisplayId(user = {}) {
  const id = user.id ?? user.userId ?? user.user_id ?? user.UserID;
  const role = String(user.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const joined = user.joined || user.created_at || user.createdAt;
  if (id === undefined || id === null || id === "") return "Not assigned";
  const prefix = rolePrefixes[role] || "USR";
  const identifier = String(id ?? "").padStart(4, "0");
  const date = joined ? new Date(joined) : null;
  if (!date || Number.isNaN(date.getTime())) return `${prefix}${identifier}`;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${prefix}${month}${day}${date.getFullYear()}${identifier}`;
}
