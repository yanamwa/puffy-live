import { removeLessonPracticeActivities } from "../../services/lessonPracticeContent.js";
import { useState } from "react";
import "./LessonContent.css";

// Render supported lesson formatting as React nodes; source HTML stays plain text.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  );
}
export default function LessonContent({ content }) {
  const blocks = removeLessonPracticeActivities(content).replace(/\r\n/g, "\n").split(/\n\s*\n/).filter(block => block.trim());
  return <div className="formatted-lesson">{blocks.map((block, index) => {
    const lines = block.trim().split("\n");
    if (lines.every(line => /^\s*[-*]\s+/.test(line))) {
      return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s+/, ""))}</li>)}</ul>;
    }
    const bullet = /^\s*[-*]\s+/.test(block);
    const text = block.replace(/^\s*[-*]\s+/, "");
    if (bullet) return <ul key={index}><li>{inline(text)}</li></ul>;
    const heading = /^(#{1,6})\s+(.+)$/.exec(block.trim());
    if (heading) return <h4 key={index}>{inline(heading[2])}</h4>;
    const paragraphs = block.length > 450
      ? block.replace(/([.!?]["'’”]?)\s+(?=[A-Z])/g, "$1\n").split("\n").reduce((result, sentence) => {
          if (!result.length || result[result.length - 1].length >= 260) result.push(sentence);
          else result[result.length - 1] += " " + sentence;
          return result;
        }, [])
      : [block];
    return <div key={index}>{paragraphs.map((paragraph, i) => <p key={i}>{inline(paragraph)}</p>)}</div>;
  })}</div>;
}
export function LessonContentEditor({ value, onChange, className, placeholder }) {
  const [editing, setEditing] = useState(false);
  return <div className="lesson-content-editor">
    <div className="lesson-format-toolbar">
      <button type="button" onClick={() => setEditing(!editing)}>{editing ? "Preview formatting" : "Edit content"}</button>
      <span>{editing ? "Use **text** for bold. Preview to see formatting." : "Formatted lesson preview"}</span>
    </div>
    {editing ? <textarea aria-label="Lesson content" className={className} value={removeLessonPracticeActivities(value)} onChange={onChange} placeholder={placeholder} /> :
      <div className="lesson-editor-preview"><LessonContent content={value} />{!value && <p>No content yet. Select Edit content to begin.</p>}</div>}
  </div>;
}
