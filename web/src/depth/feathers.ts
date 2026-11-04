// Collectible feathers for the goose: data (web/public/data/feathers.json, built by pipeline/build_feathers.py)
// and the player's progress (persisted per browser in localStorage, guarded so private mode / blocked storage still works).
// Pure TypeScript, no three.js / DOM dependency beyond the optional Storage object.
import type { Vec3 } from '../frame';

export interface Feather {
  id: string;
  x: number; y: number; z: number;     // local ENU metres, z rel. datum
  label: string;                       // human readable place ("Dana Porter Library rooftop"), for HUD / screen readers
  landmark_id?: string;                // landmarks.json id when the feather marks a landmark
  over: 'roof' | 'ground' | 'tree' | 'water';
  canvas: [number, number];            // artwork px of (x, y, z)
}

export interface FeatherFile { version: number; datum_m: number; feathers: Feather[] }

export const FEATHER_STORAGE_KEY = 'tinywaterloo.feathers.v1';

export async function loadFeathers(url = 'data/feathers.json'): Promise<Feather[]> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`feathers: HTTP ${r.status}`);
  return ((await r.json()) as FeatherFile).feathers;
}

/** Feathers whose centre lies within `radius` metres of p (3D distance), nearest first. */
export function feathersNear(list: readonly Feather[], p: Vec3, radius: number): Feather[] {
  const r2 = radius * radius;
  const d2 = (f: Feather) => (f.x - p[0]) ** 2 + (f.y - p[1]) ** 2 + (f.z - p[2]) ** 2;
  return list.filter((f) => d2(f) <= r2).sort((a, b) => d2(a) - d2(b));
}

/** Which feathers this browser has collected. Unknown ids in storage (from older data) are kept but not counted. */
export class FeatherProgress {
  private readonly ids: ReadonlySet<string>;
  private readonly got = new Set<string>();
  private readonly listeners = new Set<(p: FeatherProgress) => void>();
  private readonly storage: Storage | null;

  /** `storage` defaults to window.localStorage when reachable; pass null for an in-memory session. */
  constructor(feathers: readonly Pick<Feather, 'id'>[], storage: Storage | null | undefined = undefined) {
    this.ids = new Set(feathers.map((f) => f.id));
    this.storage = storage === undefined ? defaultStorage() : storage;
    try {
      const raw = this.storage?.getItem(FEATHER_STORAGE_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved)) for (const id of saved) if (typeof id === 'string') this.got.add(id);
    } catch {
      // unreadable or corrupt storage: start fresh, never break the map
    }
  }

  get total(): number { return this.ids.size; }

  get count(): number {
    let n = 0;
    for (const id of this.got) if (this.ids.has(id)) n++;
    return n;
  }

  has(id: string): boolean { return this.got.has(id); }

  /** Mark collected. Returns true only the first time (so the caller can celebrate once). */
  collect(id: string): boolean {
    if (!this.ids.has(id) || this.got.has(id)) return false;
    this.got.add(id);
    this.save();
    for (const cb of this.listeners) cb(this);
    return true;
  }

  reset(): void {
    this.got.clear();
    this.save();
    for (const cb of this.listeners) cb(this);
  }

  onChange(cb: (p: FeatherProgress) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private save() {
    try {
      this.storage?.setItem(FEATHER_STORAGE_KEY, JSON.stringify([...this.got]));
    } catch {
      // quota / disabled storage: progress lasts for this session only
    }
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;   // accessing localStorage itself can throw (sandboxed iframes, blocked site data)
  }
}
