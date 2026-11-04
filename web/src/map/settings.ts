// User settings: defaults, validation and localStorage persistence (best effort - storage may be unavailable).
import type { Settings } from '../types';

const STORAGE_KEY = 'tinyWaterloo.settings.v1';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  minimap: true, life: true, tiltShift: true, tiltStrength: 40, labels: true, coverage: true, perfHud: false, quality: 'auto',
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

export function loadSettings(): Settings {
  let stored: Partial<Settings> = {};
  try { stored = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); } catch { /* storage blocked or corrupt */ }
  const s = { ...DEFAULT_SETTINGS, ...stored };
  // ?perf=1 shows the HUD for this visit without persisting it.
  if (new URLSearchParams(location.search).get('perf') === '1') s.perfHud = true;
  return s;
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode / quota: settings stay per-session */ }
}

export function mergeSettings(s: Settings, patch: Partial<Settings>): Settings {
  return { ...s, ...sanitize(patch) };
}
