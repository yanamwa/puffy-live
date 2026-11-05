import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { searchSystemPages } from "../utils/systemPageSearch.js";
import "./SystemPageSearch.css";

export default function SystemPageSearch({ role }) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = searchSystemPages(role, query);
  const visible = open && query.trim().length > 0;
  const choose = (result) => {
    setOpen(false);
    setQuery("");
    navigate(result.path);
  };
  return (
    <div className="admin-header-search system-page-search" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <input type="search" role="combobox" aria-label="Search management pages" aria-autocomplete="list"
        aria-expanded={visible} aria-controls={listId}
        aria-activedescendant={visible && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Search pages..." value={query}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)} onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive(current => results.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);
          }
          if (event.key === "Enter" && visible && results[active]) {
            event.preventDefault();
            choose(results[active]);
          }
        }} />
      <FiSearch className="search-icon" aria-hidden="true" />
      {visible && <div className="system-search-results" id={listId} role="listbox" aria-label="Matching pages">
        {results.length ? results.map((result, index) => (
          <button key={result.path} id={`${listId}-${index}`} type="button" role="option" aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()} onClick={() => choose(result)}>{result.label}</button>
        )) : <p role="status">No matching pages found.</p>}
      </div>}
    </div>
  );
}
