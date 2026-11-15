import { useState } from "react";
import Swal from "sweetalert2";

import { API_BASE } from "../../../config.js";
import "../../admin/Features/AdminFeaturePages.css";

/* =====================================================
   HELPERS
===================================================== */

function getAuthToken() {
  return (
    localStorage.getItem("puffy-token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function getBackupFilename(response) {
  const disposition = response.headers.get("content-disposition") || "";

  const match = disposition.match(/filename="?([^"]+)"?/i);

  if (match?.[1]) {
    return match[1];
  }

  const today = new Date().toISOString().slice(0, 10);

  return `puffybrain-database-backup-${today}.json`;
}

/* =====================================================
   BACKUP PAGE
===================================================== */

export default function BackupPage() {
  const [backingUp, setBackingUp] = useState(false);

  /* ===================================================
     DOWNLOAD DATABASE BACKUP
  =================================================== */

  const handleBackup = async () => {
    if (backingUp) {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      await Swal.fire({
        icon: "error",
        title: "Authentication Required",
        text: "Please log in again before creating a database backup.",
        confirmButtonText: "OK",
      });

      return;
    }

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Download Database Backup?",
      text: "A backup of the current PuffyBrain database will be downloaded.",
      showCancelButton: true,
      confirmButtonText: "Download Backup",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      setBackingUp(true);

      Swal.fire({
        title: "Creating Backup",
        text: "Preparing the PuffyBrain database backup...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const response = await fetch(`${API_BASE}/backup`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          errorData.message || "Failed to create database backup.",
        );
      }

      const blob = await response.blob();

      const filename = getBackupFilename(response);

      downloadBlob(filename, blob);

      await Swal.fire({
        icon: "success",
        title: "Backup Created",
        text: "The PuffyBrain database backup was downloaded successfully.",
        confirmButtonText: "OK",
      });
    } catch (error) {
      console.error("Database backup error:", error);

      await Swal.fire({
        icon: "error",
        title: "Backup Failed",
        text: error?.message || "Could not create the database backup.",
        confirmButtonText: "OK",
      });
    } finally {
      setBackingUp(false);
    }
  };

  /* ===================================================
     UI
  =================================================== */

  return (
    <div className="admin-page feature-page">
      <header className="super-page-heading super-standalone-heading"><div>
        <h1>Backup</h1>
        <p>Create backups of the PuffyBrain database.</p>
      </div></header>

      <div>
        {/* BACKUP */}

        <section className="feature-card">
          <div className="feature-card-top" />

          <div className="feature-card-body">
            <h2>Backup Database</h2>

            <p>Download a JSON backup of the current PuffyBrain database.</p>

            <button
              className="primary-feature-btn"
              type="button"
              onClick={handleBackup}
              disabled={backingUp}
            >
              {backingUp ? "Creating Backup..." : "Download Backup"}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
