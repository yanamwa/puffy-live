import Swal from "sweetalert2";
import "./successDialog.css";

export const successDialog = Swal.mixin({
  imageUrl: import.meta.env.BASE_URL + "images/complete.png",
  imageAlt: "",
  showCloseButton: true,
  confirmButtonText: "OK",
  customClass: { popup: "puffy-success-dialog" },
  didOpen(popup) {
    const image = popup.querySelector(".swal2-image");
    const message = popup.querySelector(".swal2-html-container");
    const lead = message?.firstElementChild;
    if (!image || !message) return;

    if (lead?.tagName === "P") {
      lead.after(image);
    } else if (!lead) {
      const [summary, ...details] = message.textContent.split("\n");
      const paragraph = document.createElement("p");
      paragraph.textContent = summary;
      message.replaceChildren(paragraph, image);
      if (details.length) {
        const detail = document.createElement("p");
        detail.textContent = details.join("\n");
        message.append(detail);
      }
    }
  },
});
