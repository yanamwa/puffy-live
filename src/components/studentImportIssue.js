import Swal from "sweetalert2";
import "./StudentImportPanel.css";

export function showStudentImportIssue(title, messages) {
  const list = document.createElement("ul");
  for (const message of messages) {
    const item = document.createElement("li");
    item.textContent = message;
    list.append(item);
  }
  return Swal.fire({
    title,
    html: list,
    confirmButtonText: "OK",
    customClass: {
      popup: "student-import-result",
      confirmButton: "student-import-button",
    },
    buttonsStyling: false,
  });
}
