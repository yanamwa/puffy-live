import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { API_BASE } from "../config.js";
import { fetchProfessorProof } from "../utils/professorProof.js";

export default function ProfessorProofImage({ proof, name, compact = false }) {
  // Context updates also re-render this preview when the signed-in user changes.
  const auth = useAuth();
  const token = auth?.user
    ? localStorage.getItem("puffy-token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      ""
    : "";
  const [preview, setPreview] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setPreview(null);
    fetchProfessorProof(proof, {
      apiBase: API_BASE,
      token,
      signal: controller.signal,
    })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ proof, token, url: objectUrl });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPreview({ proof, token, error: error.message });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proof, token, retry]);

  const current =
    preview?.proof === proof && preview?.token === token ? preview : null;
  if (!current) return <span role="status">Loading ID photo�</span>;
  if (current.error)
    return (
      <span className="users-proof-error" role="status">
        {current.error}{" "}
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      </span>
    );
  return (
    <a
      className={compact ? "users-proof-cell" : "users-proof-preview"}
      href={current.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        className={compact ? "users-proof-thumb" : "users-proof-image"}
        src={current.url}
        alt={`${name || "Professor"} employment proof`}
        loading="lazy"
      />
      {compact && <span>View proof</span>}
    </a>
  );
}
