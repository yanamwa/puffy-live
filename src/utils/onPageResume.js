// A tab switch can fire both visibilitychange and focus for the same return.
export function onPageResume(refresh) {
  let away = document.hidden || !document.hasFocus();
  const leave = () => { away = true; };
  const resume = () => {
    if (!away || document.hidden) return;
    away = false;
    refresh();
  };
  const visibilityChanged = () => {
    if (document.hidden) leave();
    else resume();
  };
  const reconnect = () => {
    if (!document.hidden) refresh();
  };

  window.addEventListener("blur", leave);
  window.addEventListener("focus", resume);
  window.addEventListener("online", reconnect);
  document.addEventListener("visibilitychange", visibilityChanged);
  return () => {
    window.removeEventListener("blur", leave);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", reconnect);
    document.removeEventListener("visibilitychange", visibilityChanged);
  };
}
