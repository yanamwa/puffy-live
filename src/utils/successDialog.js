import Swal from "sweetalert2";
import "./successDialog.css";

export const successDialog = Swal.mixin({
  icon: "success",
  iconColor: "#7fa8d6",
  customClass: { popup: "puffy-success-dialog" },
});
