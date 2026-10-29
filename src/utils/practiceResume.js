import { useMemo, useRef, useState } from "react";
function key() {
  const user = localStorage.getItem("puffy-user") || localStorage.getItem("user") || "guest";
  const scope = localStorage.getItem("practiceScope") || "";
  return `practice-resume-v1:${user}:${location.pathname}:${scope}`;
}
function read(storageKey) { try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; } }
function write(storageKey, name, value) { try { localStorage.setItem(storageKey, JSON.stringify({...read(storageKey), [name]: value})); } catch { /* Storage may be unavailable. */ } }
export function clearPracticeProgress() { localStorage.removeItem(key()); }
export function usePracticeState(name, initial, data = false) {
  const storageKey = useRef(key()).current;
  const saved = useRef(read(storageKey));
  const firstDataWrite = useRef(data && Object.hasOwn(saved.current, name) && (!Array.isArray(saved.current[name]) || saved.current[name].length > 0));
  const [value, setValue] = useState(() => Object.hasOwn(saved.current, name) ? saved.current[name] : typeof initial === "function" ? initial() : initial);
  const update = (next) => {
    if (firstDataWrite.current) { firstDataWrite.current = false; return; }
    setValue(previous => {
      const result = typeof next === "function" ? next(previous) : next;
      write(storageKey, name, result);
      return result;
    });
  };
  return [value, update];
}
export function usePracticeItems(name, build, deps) {
  const storageKey = useRef(key()).current;
  return useMemo(() => {
    const items = read(storageKey)[name];
    if (Array.isArray(items) && items.length) return items;
    const result = build();
    if (Array.isArray(result) && result.length) write(storageKey, name, result);
    return result;
  }, deps);
}
