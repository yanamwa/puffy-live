// Only send the session token to our configured API, never a stored external URL.
export function professorProofUrl(value, apiBase) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let pathname;
  try {
    pathname = new URL(raw, "https://upload-path.invalid/").pathname;
  } catch {
    return "";
  }
  const match = /^\/(?:api\/)?(?:uploads\/)?professor-ids\/([^/]+)$/.exec(
    pathname,
  );
  if (!match) return "";
  let filename;
  try {
    filename = decodeURIComponent(match[1]);
  } catch {
    return "";
  }
  if (
    !filename ||
    filename === "." ||
    filename === ".." ||
    /[\/\\\u0000-\u001f]/.test(filename)
  )
    return "";
  return `${apiBase.replace(/\/+$/, "")}/uploads/professor-ids/${encodeURIComponent(filename)}`;
}

export async function fetchProfessorProof(
  value,
  { apiBase, token, signal, fetchImpl = fetch },
) {
  const url = professorProofUrl(value, apiBase);
  if (!url) throw new Error("This proof file has an unsupported address.");
  if (!token) throw new Error("Sign in again to view this ID photo.");
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    const message =
      {
        401: "Your session expired. Sign in again to view this ID photo.",
        403: "An admin account is required to view this ID photo.",
        404: "This ID photo is missing from the server. Restore the file or upload it again.",
      }[response.status] || `Could not load the ID photo (${response.status}).`;
    throw new Error(message);
  }
  const blob = await response.blob();
  if (!/^image\/(?:jpeg|png|webp|gif|avif|bmp)$/i.test(blob.type))
    throw new Error("The server did not return a supported ID image.");
  return blob;
}
