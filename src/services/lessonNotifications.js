import "./lessonNotifications.css";
import Swal from "sweetalert2";

export function notifyLessonGenerated(pageCount, coverage) {
  if (Array.isArray(pageCount)) return showLessonGenerationSummary(pageCount, coverage);
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    customClass: { popup: "lessonGenerationToast" },
    title: "Lesson generated",
    text: `${pageCount ? `${pageCount} ${pageCount === 1 ? "page" : "pages"} ready. ` : ""}Review the lesson and save your changes.`,
    showConfirmButton: false,
    showCloseButton: true,
    timer: 6500,
    timerProgressBar: true,
    didOpen: (popup) => {
      popup.parentElement.style.zIndex = "1000000";
      popup.addEventListener("mouseenter", Swal.stopTimer);
      popup.addEventListener("mouseleave", Swal.resumeTimer);
    },
  });
}

function showLessonGenerationSummary(pages, coverage) {
  const content = document.createElement("div");
  content.className = "lessonGenerationSummaryContent";
  const message = document.createElement("p");
  message.textContent = `Generation completed. ${pages.length} ${pages.length === 1 ? "lesson page is" : "lesson pages are"} ready.`;
  content.append(message);
  const heading = document.createElement("h3");
  heading.textContent = "Generated Page Titles";
  content.append(heading);
  const list = document.createElement("ol");
  pages.forEach((page, index) => {
    const item = document.createElement("li");
    item.textContent = String(page?.title || "").trim() || `Page ${index + 1}`;
    list.append(item);
  });
  content.append(list);
  const section = (title, entries) => {
    if (!entries?.length) return;
    const heading = document.createElement("h3"), list = document.createElement("ul");
    heading.textContent = title;
    for (const entry of entries) {
      const li = document.createElement("li");
      li.textContent = entry;
      list.append(li);
    }
    content.append(heading, list);
  };
  section("Topics needing more instructional material", coverage?.missing_topic_details?.map(item => item.topic + " — " + item.reason) || coverage?.missing_topics);
  section("Consulted instructional sources", coverage?.consulted_sources);
  section("References listed in the syllabus", coverage?.syllabus_references?.flatMap(group =>
    group.entries.map(e => group.category + " — " + e.text + " (syllabus p. " + e.source_page + ")")));
  const reminder = document.createElement("p");
  reminder.className = "lessonGenerationSummaryReminder";
  reminder.textContent =
    "Review the generated lesson pages and save your module changes.";
  content.append(reminder);
  return Swal.fire({
    icon: "success",
    title: "Module Generation Completed",
    html: content,
    customClass: { popup: "lessonGenerationSummary" },
    confirmButtonText: "Done",
    buttonsStyling: false,
    allowOutsideClick: false,
    didOpen: (popup) => {
      popup.parentElement.style.zIndex = "1000000";
      if (popup.scrollHeight > popup.clientHeight) {
        popup.focus({ preventScroll: true });
        popup.scrollTop = 0;
      }
    },
  });
}
