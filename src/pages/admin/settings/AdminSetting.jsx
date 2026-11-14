import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import confirmLogout from "../../../utils/confirmLogout.js";
import AdminLayout from "../shared/AdminLayout";
import styles from "./AdminSettings.module.css";
import "boxicons/css/boxicons.min.css";
import { API_BASE } from "../../config.js";

export default function AdminSettings() {
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [bellNotifications, setBellNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("personal");
  const fetchedOnce = useRef(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [admin, setAdmin] = useState({
    full_name: "",
    username: "",
    email: "",
    signature: "",
    role: "",
    profile_image: "/images/temporary profile.jpg",
  });

  const [editForm, setEditForm] = useState({
    full_name: "",
    username: "",
    email: "",
    signature: "",
    role: "",
    profile_image: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const getAdminImageUrl = (image) => {
    if (!image || image.includes("temporary profile.jpg")) {
      return "/images/temporary profile.jpg";
    }

    if (image.startsWith("http")) return image;

    let cleanImage = image.replace(/^\/+/, "");
    cleanImage = cleanImage.replace(/^puffybrain\//, "");

    return `${API_BASE}/${cleanImage}`;
  };

  const adminImage = getAdminImageUrl(admin.profile_image);

  const showFeedback = (type, title, text) => {
    Swal.fire({
      imageUrl:
        type === "success" ? "/images/success.png" : "/images/error.png",
      imageWidth: 170,
      imageHeight: 170,
      title,
      text,
    });
  };

  const fetchBellNotifications = async () => {
    try {
      const adminData = JSON.parse(localStorage.getItem("admin") || "{}");

      const res = await fetch(
        `${API_BASE}/getAdminNotifications.php?admin_id=${adminData.id || ""}`,
        { credentials: "include" },
      );

      const data = await res.json();
      setBellNotifications(data.success ? data.notifications || [] : []);
    } catch (err) {
      console.error(err);
      setBellNotifications([]);
    }
  };

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();

    const adminData = JSON.parse(localStorage.getItem("admin") || "{}");

    try {
      await fetch(`${API_BASE}/markAdminNotificationsRead.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          admin_id: adminData.id,
        }),
      });

      fetchBellNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdmin = async () => {
    try {
      const res = await fetch(`${API_BASE}/getAdminProfile.php`, {
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setAdmin({
          full_name: data.admin?.full_name || "",
          username: data.admin?.username || "",
          email: data.admin?.email || "",
          signature: data.admin?.signature || "",
          role: data.admin?.role || "Admin",
          profile_image:
            data.admin?.profile_image || "/images/temporary profile.jpg",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (fetchedOnce.current) return;

    fetchedOnce.current = true;
    fetchAdmin();
    fetchBellNotifications();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;

    localStorage.clear();
    sessionStorage.clear();
    navigate("/pb-admin-access");
  };

  const openEditModal = () => {
    setEditForm({
      full_name: admin.full_name || "",
      username: admin.username || "",
      email: admin.email || "",
      signature: admin.signature || "",
      role: admin.role || "",
      profile_image: admin.profile_image || "",
    });

    setSelectedImageFile(null);
    setImagePreview("");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview) URL.revokeObjectURL(imagePreview);

    const previewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setImagePreview(previewUrl);
  };

  const saveAdminProfile = async () => {
    try {
      const formData = new FormData();

      formData.append("full_name", editForm.full_name);
      formData.append("username", editForm.username);
      formData.append("email", editForm.email);
      formData.append("signature", editForm.signature);
      formData.append("role", editForm.role);

      if (selectedImageFile) {
        formData.append("profile_image", selectedImageFile);
      }

      const res = await fetch(`${API_BASE}/updateAdmin.php`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        await fetchAdmin();
        closeEditModal();
        showFeedback("success", "Success", "Profile updated successfully!");
      } else {
        showFeedback(
          "error",
          "Failed",
          data.message || "Failed to update profile.",
        );
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Server Error", "Failed to update profile.");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    await saveAdminProfile();
  };

  const handleChangePassword = async () => {
    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showFeedback(
        "error",
        "Missing Fields",
        "Please fill out all password fields.",
      );
      return;
    }

    if (newPassword.length < 8) {
      showFeedback(
        "error",
        "Weak Password",
        "New password must be at least 8 characters.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showFeedback(
        "error",
        "Password Mismatch",
        "New password and confirm password do not match.",
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/changeAdminPassword.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        showFeedback(
          "success",
          "Password Updated",
          data.message || "Password changed successfully.",
        );
      } else {
        showFeedback(
          "error",
          "Failed",
          data.message || "Failed to change password.",
        );
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Server Error", "Failed to change password.");
    }
  };

  return (
    <AdminLayout>
      <div className={styles.pageHeader}>
        <h1>Admin Profile</h1>
      </div>

      <div className={styles.profilePage}>
        <div className={styles.profileOuter}>
          <div className={styles.profileInner}>
            <div className={styles.profileCard}>
              <div className={styles.profileTabs}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${
                    activeTab === "personal" ? styles.activeTab : ""
                  }`}
                  onClick={() => setActiveTab("personal")}
                >
                  Personal Information
                </button>

                <button
                  type="button"
                  className={`${styles.tabBtn} ${
                    activeTab === "settings" ? styles.activeTab : ""
                  }`}
                  onClick={() => setActiveTab("settings")}
                >
                  Settings
                </button>
              </div>

              {activeTab === "personal" && (
                <>
                  <div className={styles.editTop}>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={openEditModal}
                    >
                      Edit
                    </button>
                  </div>

                  <div className={styles.profileContent}>
                    <div className={styles.profileForm}>
                      <div className={styles.formGroup}>
                        <label>Full Name</label>
                        <input type="text" value={admin.full_name} readOnly />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Username</label>
                        <input type="text" value={admin.username} readOnly />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Email</label>
                        <input type="text" value={admin.email} readOnly />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Role</label>
                        <input type="text" value={admin.role} readOnly />
                      </div>
                    </div>

                    <div className={styles.profileImageSection}>
                      <img
                        src={adminImage}
                        alt="Admin"
                        className={styles.largeProfilePic}
                        onError={(e) => {
                          e.currentTarget.src = "/images/temporary profile.jpg";
                        }}
                      />

                      <p className={styles.imageHint}>
                        Recommend ratio 1:1
                        <br />
                        and file less than 5mb
                      </p>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "settings" && (
                <div className={styles.settingsContent}>
                  <div className={styles.settingsCard}>
                    <h2 className={styles.settingsHeading}>Change Password</h2>
                    <div className={styles.settingsDivider}></div>

                    <div className={styles.settingsBody}>
                      <div className={styles.passwordGroup}>
                        <label>Current Password</label>

                        <div className={styles.passwordInputWrap}>
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            value={passwordForm.currentPassword}
                            onChange={(e) =>
                              setPasswordForm((prev) => ({
                                ...prev,
                                currentPassword: e.target.value,
                              }))
                            }
                            placeholder="Enter current password"
                          />

                          <button
                            type="button"
                            className={styles.eyeBtn}
                            onClick={() =>
                              setShowCurrentPassword((prev) => !prev)
                            }
                          >
                            <i
                              className={
                                showCurrentPassword
                                  ? "bx bx-show"
                                  : "bx bx-hide"
                              }
                            ></i>
                          </button>
                        </div>
                      </div>

                      <div className={styles.passwordGroup}>
                        <label>New Password</label>

                        <div className={styles.passwordInputWrap}>
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={passwordForm.newPassword}
                            onChange={(e) =>
                              setPasswordForm((prev) => ({
                                ...prev,
                                newPassword: e.target.value,
                              }))
                            }
                            placeholder="Enter new password"
                          />

                          <button
                            type="button"
                            className={styles.eyeBtn}
                            onClick={() => setShowNewPassword((prev) => !prev)}
                          >
                            <i
                              className={
                                showNewPassword ? "bx bx-show" : "bx bx-hide"
                              }
                            ></i>
                          </button>
                        </div>
                      </div>

                      <div className={styles.passwordGroup}>
                        <label>Confirm Password</label>

                        <div className={styles.passwordInputWrap}>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={passwordForm.confirmPassword}
                            onChange={(e) =>
                              setPasswordForm((prev) => ({
                                ...prev,
                                confirmPassword: e.target.value,
                              }))
                            }
                            placeholder="Confirm new password"
                          />

                          <button
                            type="button"
                            className={styles.eyeBtn}
                            onClick={() =>
                              setShowConfirmPassword((prev) => !prev)
                            }
                          >
                            <i
                              className={
                                showConfirmPassword
                                  ? "bx bx-show"
                                  : "bx bx-hide"
                              }
                            ></i>
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.changePasswordBtn}
                        onClick={handleChangePassword}
                      >
                        Change Password
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <div className={styles.modalOverlay} onClick={closeEditModal}>
          <div
            className={styles.editModal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={closeEditModal}
            >
              <i className="bx bx-x"></i>
            </button>

            <div className={styles.modalCard}>
              <h2 className={styles.modalTitle}>Edit Admin Profile</h2>
              <div className={styles.modalDivider}></div>

              <form
                className={styles.modalContent}
                onSubmit={handleSaveProfile}
              >
                <div className={styles.modalForm}>
                  <div className={styles.modalFormGroup}>
                    <label>Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      value={editForm.full_name}
                      onChange={handleEditInputChange}
                    />
                  </div>

                  <div className={styles.modalFormGroup}>
                    <label>Username</label>
                    <input
                      type="text"
                      name="username"
                      value={editForm.username}
                      onChange={handleEditInputChange}
                    />
                  </div>

                  <div className={styles.modalFormGroup}>
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      readOnly
                    />
                  </div>

                  <div className={styles.modalFormGroup}>
                    <label>Role</label>
                    <input
                      type="text"
                      name="role"
                      value={editForm.role}
                      readOnly
                    />
                  </div>

                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={closeEditModal}
                    >
                      Cancel
                    </button>

                    <button type="submit" className={styles.saveChangesBtn}>
                      Save Changes
                    </button>
                  </div>
                </div>

                <div className={styles.modalPhotoSection}>
                  <label className={styles.uploadPhotoCircle}>
                    <img
                      src={imagePreview || adminImage}
                      alt="Admin preview"
                      className={styles.uploadedPreview}
                      onError={(e) => {
                        e.currentTarget.src = "/images/temporary profile.jpg";
                      }}
                    />

                    <div className={styles.uploadOverlay}>
                      <i className="bx bx-camera"></i>
                      <span>Change Photo</span>
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      hidden
                    />
                  </label>

                  <p className={styles.uploadHint}>
                    Recommend ratio 1:1
                    <br />
                    and file less than 5mb
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
