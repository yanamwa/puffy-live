import { jsPDF } from "jspdf";
import { removeLessonPracticeActivities } from "./lessonPracticeContent.js";

// Render reader-facing sections rather than serializing internal data keys.
export function createLessonPdf(name, data) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const blue = [52, 91, 131], ink = [41, 56, 73], muted = [100, 116, 139];
  const left = 18, width = 174, bottom = 273;
  let y = 25;
  const clean = (value) => String(value ?? "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-");
  const nextPage = () => { pdf.addPage(); y = 25; };
  const room = (height) => { if (y + height > bottom) nextPage(); };
  const write = (value, size = 11, bold = false, color = ink, gap = 4) => {
    if (!value) return;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const step = size * 0.55;
    for (const line of pdf.splitTextToSize(clean(value), width)) {
      room(step);
      pdf.text(line, left, y);
      y += step;
    }
    y += gap;
  };
  const heading = (text) => { room(24); y += 4; write(text, 13, true, blue, 3); };
  const body = (value) => {
    const text = Array.isArray(value) ? value.join("\n") : String(value || "");
    for (const block of clean(text).split(/\n\s*\n/)) {
      for (const line of block.split("\n")) {
        if (/^#{1,6}\s/.test(line)) heading(line.replace(/^#{1,6}\s+/, ""));
        else write(line.replace(/^\s*[-*]\s+/, "- "));
      }
    }
  };
  const section = (title, value) => { if (value && (!Array.isArray(value) || value.length)) { heading(title); body(value); } };
  const lessons = (pages, prefix = "") => {
    (pages || []).forEach((lesson, index) => {
      nextPage();
      write(`${prefix}LESSON ${String(index + 1).padStart(2, "0")}`, 9, true, muted);
      write(lesson.title || `Lesson ${index + 1}`, 24, true, blue, 7);
      body(removeLessonPracticeActivities(lesson.content || ""));
    });
  };
  write(`LESSON HANDOUT${data.version ? ` / VERSION ${data.version}` : ""}`, 9, true, muted);
  write(data.title || name, 24, true, blue, 8);
  if (Array.isArray(data.modules)) {
    data.modules.forEach((module, index) => {
      if (index) nextPage();
      write(`MODULE ${String(index + 1).padStart(2, "0")}`, 9, true, muted);
      write(module.title || `Module ${index + 1}`, 22, true, blue, 6);
      section("Module overview", module.description);
      section("Learning objectives", module.learning_objectives || module.learningObjectives);
      section("Topics covered", module.topics);
      lessons(module.lesson_pages, `MODULE ${String(index + 1).padStart(2, "0")} / `);
    });
  } else {
    Object.entries(data.fields || {}).forEach(([key, value]) => write(`${key}: ${value}`, 10, false, muted, 2));
    if (data.joinCode) write(`Class join code: ${data.joinCode}`, 10, false, muted);
    section("Description", data.description);
    section("Learning objectives", data.learningObjectives);
    lessons(data.lessons);
    if (data.quizItems?.length) {
      nextPage();
      write("Course quiz", 22, true, blue);
      data.quizItems.forEach((item, index) => {
        heading(`${index + 1}. ${item.question || "Question"}`);
        if (item.options) body(item.options);
        body(`Answer: ${item.correct_answer || item.answer || "Not set"}`);
      });
    }
  }
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(213, 223, 236);
    pdf.line(left, 16, 192, 16); pdf.line(left, 282, 192, 282);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(...muted);
    const label = clean(data.title || name);
    pdf.text(pdf.splitTextToSize(label, 135)[0], left, 12);
    pdf.text("LESSON HANDOUT", 192, 12, { align: "right" });
    pdf.text(data.version ? `Version ${data.version}` : "Course lessons", left, 289);
    pdf.text(`${page} / ${total}`, 192, 289, { align: "right" });
  }
  return pdf;
}
