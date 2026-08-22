let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

type SoundName =
  | "matchFound"
  | "matchSearch"
  | "revealConsent"
  | "revealComplete"
  | "message"
  | "error"
  | "click";

const SOUND_ENABLED_KEY = "sweetscene-sound";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SOUND_ENABLED_KEY) !== "false";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

export function playSound(name: SoundName) {
  if (typeof window === "undefined") return;
  if (!isSoundEnabled()) return;

  const ctx = getCtx();
  if (!ctx) return;

  if (ctx.state === "suspended") ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const presets: Record<SoundName, { freq: number; type: OscillatorType; dur: number; vol: number }> = {
    matchFound:   { freq: 880, type: "sine",     dur: 0.3, vol: 0.15 },
    matchSearch:  { freq: 440, type: "triangle", dur: 0.5, vol: 0.10 },
    revealConsent:{ freq: 660, type: "sine",     dur: 0.2, vol: 0.12 },
    revealComplete:{ freq: 1320, type: "sine",   dur: 0.6, vol: 0.18 },
    message:      { freq: 800, type: "square",   dur: 0.08, vol: 0.06 },
    error:        { freq: 200, type: "sawtooth", dur: 0.2, vol: 0.12 },
    click:        { freq: 600, type: "sine",     dur: 0.05, vol: 0.08 },
  };

  const p = presets[name] || presets.click;
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.freq, ctx.currentTime);
  gain.gain.setValueAtTime(p.vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + p.dur);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + p.dur);
}
