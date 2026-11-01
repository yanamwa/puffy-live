import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import "./ResponsiveSidebar.css";

export default function ResponsiveSidebar({
  className = "",
  logoSrc = "/images/Student.png",
  children,
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigationId = useId();
  const toggleRef = useRef(null);

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  return (
    <aside
      className={`responsive-sidebar ${className}`}
      data-mobile-open={open}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <div className="responsive-sidebar-mobile-header">
        <img src={logoSrc} alt="PuffyBrain" />
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={navigationId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </div>
      <div
        id={navigationId}
        className="responsive-sidebar-content"
        onClick={(event) => {
          if (event.target.closest("a[href]")) setOpen(false);
        }}
      >
        {children}
      </div>
    </aside>
  );
}
