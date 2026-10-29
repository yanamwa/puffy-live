import { useState } from "react";
import { readPracticeSound, setPracticeSound } from "../../utils/practiceFeedbackSound.js";
import "./PracticeSoundControl.css";
export default function PracticeSoundControl() {
  const [settings, setSettings] = useState(readPracticeSound);
  const muted = settings.muted || settings.volume === 0;
  function toggle() {
    const next = {...settings, muted: !muted, volume: settings.volume || 0.65};
    setSettings(next);
    setPracticeSound(next);
  }
  return <button className="practice-sound-control" type="button" aria-label={muted ? "Unmute sound effects" : "Mute sound effects"} aria-pressed={muted} title={muted ? "Unmute sound effects" : "Mute sound effects"} onClick={toggle}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
    </svg>
  </button>;
}
