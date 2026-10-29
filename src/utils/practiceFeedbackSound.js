let activeSound;
export function readPracticeSound() {
  try {
    const saved = JSON.parse(localStorage.getItem("practice-sound") || "{}");
    return { muted: Boolean(saved.muted), volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.65 };
  } catch { return { muted: false, volume: 0.65 }; }
}
export function setPracticeSound(settings) {
  localStorage.setItem("practice-sound", JSON.stringify(settings));
  if (activeSound) { activeSound.volume = settings.volume; activeSound.muted = settings.muted; }
}

// Called directly from answer interactions so browser audio is permitted.
export function playPracticeFeedbackSound(isCorrect) {
  window.dispatchEvent(new CustomEvent("practice-answer-feedback", { detail: { isCorrect } }));
  if (activeSound) { activeSound.pause(); activeSound.currentTime = 0; }
  const settings = readPracticeSound();
  if (settings.muted || settings.volume === 0) return;
  activeSound = new Audio(isCorrect ? "/images/correct_answer.mp3" : "/images/wrong_answer.mp3");
  activeSound.volume = settings.volume;
  const playback = activeSound.play();
  playback?.catch(() => { /* Audio availability must not block answering. */ });
}
