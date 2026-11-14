import { useState } from "react";

export default function ContentDownloads({ name, data }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    setBusy(true);
    setError("");
    const filename = String(name || "lessons").replace(/[<>:"/\\|?*]/g, "-");
    try {
      const { createLessonPdf } = await import("../../services/lessonPdf.js");
      const pdf = createLessonPdf(name, data);
      pdf.save(`${filename}.pdf`);
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="catalog-content-downloads">
      <button
        type="button"
        className="catalog-button"
        disabled={busy}
        onClick={download}
      >
        Download PDF
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
