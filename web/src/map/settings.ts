// User settings: defaults, validation and localStorage persistence (best effort - storage may be unavailable).
import type { Settings } from '../types';

const STORAGE_KEY = 'tinyWaterloo.settings.v1';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  minimap: true, life: true, tiltShift: true, tiltStrength: 25, labels: true, coverage: true, perfHud: false, quality: 'auto',
};

/** Keep only known keys with the right types so a stale or hand-edited entry can never break the map. */
function sanitize(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Settings> = {};
  for (const k of ['minimap', 'life', 'tiltShift', 'labels', 'coverage', 'perfHud'] as const) {
    if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  }
  if (typeof r.tiltStrength === 'number' && Number.isFinite(r.tiltStrength)) out.tiltStrength = Math.min(100, Math.max(0, r.tiltStrength));
  if (r.quality === 'auto' || r.quality === 'high' || r.quality === 'low') out.quality = r.quality;
  return out;
}

function readStored(): Partial<Settings> {
  try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); } catch { return {}; /* storage blocked or corrupt */ }
}

export function loadSettings(): Settings {
  const stored = readStored();
  // Phones: the minimap would cover a large share of the map, so it starts hidden there (still toggleable).
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const s = { ...DEFAULT_SETTINGS, minimap: !small, ...stored };
  // ?perf=1 shows the HUD for this visit without persisting it.
  if (new URLSearchParams(location.search).get('perf') === '1') s.perfHud = true;
  return s;
}

/**
 * Persist only what the user changed: the patch is merged into the stored entry, so per-visit values (?perf=1) and
 * viewport-derived defaults (no minimap on phones) never get written as if the user had chosen them.
 */
export function saveSettings(patch: Partial<Settings>): void {
  const next = { ...readStored(), ...sanitize(patch) };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode / quota: settings stay per-session */ }
}

export function mergeSettings(s: Settings, patch: Partial<Settings>): Settings {
  return { ...s, ...sanitize(patch) };
}
