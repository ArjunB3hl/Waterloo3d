// Rolling one-second frame statistics for the performance HUD and tests.

const WINDOW_MS = 1000;
/** Gaps longer than this mean the loop was idle (nothing to draw), not a slow frame. */
const IDLE_GAP_MS = 250;

export class FrameStats {
  private frames: { t: number; interval: number; draw: number }[] = [];
  private last = 0;

  record(t: number, drawMs: number): void {
    const interval = this.last && t - this.last < IDLE_GAP_MS ? t - this.last : NaN;
    this.last = t;
    this.frames.push({ t, interval, draw: drawMs });
    while (this.frames.length && this.frames[0].t < t - WINDOW_MS) this.frames.shift();
  }

  summary(now: number): { fps: number; frameP95Ms: number; drawP95Ms: number } {
    const recent = this.frames.filter((f) => f.t >= now - WINDOW_MS);
    const intervals = recent.map((f) => f.interval).filter((x) => !Number.isNaN(x));
    return { fps: recent.length, frameP95Ms: p95(intervals), drawP95Ms: p95(recent.map((f) => f.draw)) };
  }
}

function p95(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] * 10) / 10;
}
