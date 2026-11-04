import { useState } from "react";

export default function ContentDownloads({ name, data }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async (format) => {
    setBusy(true);
    setError("");
    const filename = String(name || "lessons").replace(/[<>:"/\\|?*]/g, "-");
    try {
      if (format === "json") {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const { createLessonPdf } = await import("../../services/lessonPdf.js");
        const pdf = createLessonPdf(name, data);
        pdf.save(`${filename}.pdf`);
      }
    } catch { setError("Download failed. Please try again."); }
    finally { setBusy(false); }
  };
  return <div className="catalog-content-downloads"><button type="button" className="catalog-button" disabled={busy} onClick={() => download("pdf")}>Download PDF</button><button type="button" className="catalog-button" disabled={busy} onClick={() => download("json")}>Download JSON</button>{error && <span role="alert">{error}</span>}</div>;
}

