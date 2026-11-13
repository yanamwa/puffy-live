import Swal from "sweetalert2";
import "./confirmLogout.css";

export async function confirmLogout() {
  const result = await Swal.fire({
    title: "Are you sure you want to log out?",
    text: "You will be signed out of your account.",
    target: document.body,
    showCancelButton: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      container: "logout-confirmation-overlay",
      popup: "logout-confirmation-dialog",
    },
  });

  return result.isConfirmed;
}
