// Adaptive quality: when the GPU cannot keep up during a goose flight (frames arrive late), step the effects down a
// level at a time; restore them a level per flight, never in the middle of one. Each step is tested on the window after
// it: if neither it nor the next level makes the frames faster (a 30 fps cap: lowering the effects cannot help), the
// run is undone at once; after a second such flight it is not tried again this visit. Only in Quality 'auto': an
// explicit Low or High is the visitor's choice. The level is a runtime overlay and never changes the stored settings.
//
// QualityGovernor is pure (no DOM, no clocks of its own): it is fed frame times and flight starts / ends, so tests can
// drive it with synthetic sequences (tests/adaptive_check.mjs). createAdaptiveQuality wires it to the map's frames.
import type { FrameInfo, MapAPI } from '../types';

export interface GovernorOptions {
  /** Highest level (all reductions applied). */
  maxLevel: number;
  /** A frame is late when its interval exceeds this (ms). 27 ms sits between the common frame intervals: a missed
   *  refresh at 60 Hz (33.3) and 4-refresh frames at 144 Hz (27.8) are late; 40 fps on a 120 Hz screen (25.0) and any
   *  60 fps are not. */
  lateMs?: number;
  /** Longer gaps are not frames of a running flight (sleep, a debugger pause): ignored, judging restarted. A hidden tab
   *  is not seen here at all (the caller ends the flight), so anything shorter, however slow, is a late frame: on an
   *  overloaded machine those are the frames that matter. */
  gapMs?: number;
  /** No judging this long after take-off or after any reset (intro camera flight, first uploads, JIT warm-up). */
  warmupMs?: number;
  /** Length of one judging window. */
  windowMs?: number;
  /** A window also runs until it holds this many frames, so a very slow machine (10 fps) is judged too, over longer
   *  windows. (Stalls cannot stretch one: a gap over gapMs restarts it.) */
  minFrames?: number;
  /** A window is bad when more than this fraction of its frames are late. */
  badFraction?: number;
  /** Consecutive bad windows before stepping down. Three, so a single stall of a second or so (it can spill into two
   *  windows) never costs a level. */
  badWindows?: number;
  /** After a step down, wait this long before judging again (the new level needs a few frames to take effect). */
  settleMs?: number;
  /** Each step down is tested on the first window after its settle time. It is kept if that window is no longer bad,
   *  or if its mean frame interval is at most this fraction of the baseline (the fastest of the bad windows that led
   *  to it). Otherwise the next level is tried against the same baseline; if the deepest allowed level does not help
   *  either, the run is undone (frames capped at 30 fps by a 30 Hz screen, Low Power Mode or Energy Saver: lowering
   *  the effects cannot help) and nothing more is tried in that flight. After a second such run from the same level,
   *  on a later flight, those levels are not tried again this visit, unless one of them helped before. */
  gainRatio?: number;
}

export interface GovernorState {
  level: number;
  flying: boolean;
  /** Late fraction of the last completed window (NaN before the first). */
  lastLateFraction: number;
  /** Steps down taken (including any later undone). */
  stepsDown: number;
  /** Tested steps that helped and were kept. */
  kept: number;
  /** Runs of steps undone because none of them helped. */
  undone: number;
  /** Deepest level worth stepping to. */
  usefulMax: number;
  /** Deepest level a kept step has reached (one noisy re-test never caps a level below this). */
  provenMax: number;
  /** A step is waiting for its test window. */
  testing: boolean;
}

export class QualityGovernor {
  private readonly o: Required<GovernorOptions>;
  private lvl = 0;
  private flying = false;
  private judgeFrom = Infinity;    // time from which frames are judged
  private lastT = NaN;
  private winStart = NaN;
  private winFrames = 0;
  private winLate = 0;
  private winSum = 0;              // sum of frame intervals in the window (capped while a step is under test)
  private bad = 0;
  private badMin = Infinity;       // fastest mean frame interval among the current run of bad windows
  private lastFraction = NaN;
  private downs = 0;
  private keptSteps = 0;
  private undoneRuns = 0;
  private usefulMax: number;
  private provenMax = 0;
  private testBase = 0;            // level before the run of steps under test
  private baseline = NaN;          // mean frame interval to beat (NaN: no step under test)
  private heldThisFlight = false;  // a run was undone in this flight: no more steps until the next take-off
  private readonly failedRuns: number[];   // undone runs per starting level (a cap needs two, on separate flights)

  constructor(opts: GovernorOptions) {
    this.o = {
      lateMs: 27, gapMs: 1000, warmupMs: 3000, windowMs: 1000, minFrames: 10, badFraction: 0.15, badWindows: 3,
      settleMs: 2000, gainRatio: 0.9,
      ...opts,
    };
    this.usefulMax = this.o.maxLevel;
    this.failedRuns = new Array(this.o.maxLevel + 1).fill(0);
  }

  get level(): number { return this.lvl; }
  get kept(): number { return this.keptSteps; }
  get isFlying(): boolean { return this.flying; }
  private get testing(): boolean { return this.baseline === this.baseline; }

  get state(): GovernorState {
    return { level: this.lvl, flying: this.flying, lastLateFraction: this.lastFraction, stepsDown: this.downs,
      kept: this.keptSteps, undone: this.undoneRuns, usefulMax: this.usefulMax, provenMax: this.provenMax, testing: this.testing };
  }

  /** A flight begins. It starts one level above where the last one ended (a machine that recovered climbs back a step
   *  per flight; one that did not steps down again after the warm-up, and stays there for the rest of that flight). */
  start(now: number): void {
    if (this.flying) return;
    this.flying = true;
    this.heldThisFlight = false;
    this.lvl = Math.max(0, this.lvl - 1);
    this.reset(now, this.o.warmupMs);
  }

  /** The flight ended (landed). The level holds until the next start(); a step still waiting for its test is withdrawn
   *  (it was never shown to help), without counting against that level. */
  end(): void { this.withdraw(); this.flying = false; this.lastT = NaN; }

  /** The window was resized: the load changed, so a step under test is withdrawn (its baseline was measured at the old
   *  size) and judging restarts after holdMs. */
  resized(now: number, holdMs = 2000): void { this.withdraw(); this.reset(now, holdMs); }

  /** Restart judging after a pause or a forced level. A step under test stays under test: its window comes later. */
  reset(now: number, holdMs = this.o.warmupMs): void {
    this.judgeFrom = now + holdMs;
    this.lastT = NaN;
    this.winStart = NaN;
    this.winFrames = this.winLate = this.winSum = 0;
    this.bad = 0;
    this.badMin = Infinity;
  }

  /** Force a level (tests, debugging). Judging restarts after the settle time; nothing is under test. */
  force(level: number, now: number): void {
    this.lvl = Math.max(0, Math.min(this.o.maxLevel, Math.round(level)));
    this.baseline = NaN;
    this.reset(now, this.o.settleMs);
  }

  private withdraw(): void {
    if (this.testing) this.lvl = this.testBase;
    this.baseline = NaN;
  }

  private stepTo(level: number, t: number): true {
    this.lvl = level;
    this.reset(t, this.o.settleMs);
    this.lastT = t;
    return true;
  }

  /** One animation frame at time t (ms). Returns true when the level changed. */
  frame(t: number): boolean {
    if (!this.flying) return false;
    const dt = t - this.lastT;
    this.lastT = t;
    if (!(dt > 0)) return false;                               // first frame of a run (NaN) or a repeated timestamp
    // the first frames back after a pause are often slow too (textures re-uploaded): skip them as well
    if (dt > this.o.gapMs) { this.reset(t, this.o.settleMs); this.lastT = t; return false; }
    if (t < this.judgeFrom) return false;
    if (!(this.winStart <= t)) this.winStart = t - dt;
    this.winFrames++;
    // under test, one stall (a tile decode, a GC) must not outweigh a real gain: cap each interval at twice the baseline
    this.winSum += this.testing ? Math.min(dt, 2 * this.baseline) : dt;
    if (dt > this.o.lateMs) this.winLate++;
    if (t - this.winStart < this.o.windowMs || this.winFrames < this.o.minFrames) return false;
    // a window is complete
    const fraction = this.winLate / this.winFrames;
    const mean = this.winSum / this.winFrames;
    this.winStart = t;
    this.winFrames = this.winLate = this.winSum = 0;
    this.lastFraction = fraction;
    const bad = fraction > this.o.badFraction;
    const floor = Math.min(this.o.maxLevel, this.usefulMax);
    if (this.testing) {
      if (!bad || mean <= this.baseline * this.o.gainRatio) {
        // the step helped: frames are on time again, or at least clearly faster (on a 120 Hz screen they come in whole
        // refreshes, so a step that removes every late frame barely moves the mean)
        this.keptSteps++;
        this.provenMax = Math.max(this.provenMax, this.lvl);
        this.baseline = NaN;
      } else if (this.lvl < floor) {
        this.downs++;                                          // no help yet: try the next level, against the same baseline
        return this.stepTo(this.lvl + 1, t);
      } else {
        // nothing from testBase down helped: undo the run. A load that drifts can make one run fail on a machine where the
        // levels do help, so they are given up (for this visit) only when a run from the same level fails again on a
        // later flight, and never below a level that helped before.
        this.undoneRuns++;
        this.heldThisFlight = true;                            // no flapping: try again next flight at the earliest
        if (++this.failedRuns[this.testBase] >= 2) this.usefulMax = Math.max(this.testBase, this.provenMax);
        this.baseline = NaN;
        return this.stepTo(this.testBase, t);
      }
    }
    if (bad) { this.bad++; this.badMin = Math.min(this.badMin, mean); }
    else { this.bad = 0; this.badMin = Infinity; }
    if (this.bad < this.o.badWindows || this.lvl >= floor || this.heldThisFlight) return false;   // hold
    this.testBase = this.lvl;
    this.baseline = this.badMin;
    this.downs++;
    return this.stepTo(this.lvl + 1, t);
  }
}

export interface AdaptiveQuality {
  readonly governor: QualityGovernor;
  /** Test hooks: force a level (also while landed), or stop adapting (level 0 until enabled again). */
  readonly debug: { force(level: number): void; setEnabled(on: boolean): void; readonly enabled: boolean };
  dispose(): void;
}

/**
 * Drive `fx` from the map's frames while `flying()` is true. Only in Quality 'auto'; switching to Low or High
 * restores the full effects at once. `?adaptive=0` in the URL turns it off (tests that assert on the effects).
 */
export function createAdaptiveQuality(
  map: MapAPI,
  fx: { setAdaptiveLevel(level: number): void },
  flying: () => boolean,
  maxLevel: number,
): AdaptiveQuality {
  const governor = new QualityGovernor({ maxLevel });
  let enabled = new URLSearchParams(location.search).get('adaptive') !== '0';
  let applied = 0;
  let toasted = false;
  const judging = () => enabled && map.settings.quality === 'auto' && flying() && document.visibilityState === 'visible';
  const apply = () => {
    const level = enabled && map.settings.quality === 'auto' ? governor.level : 0;
    if (level !== applied) { applied = level; fx.setAdaptiveLevel(level); }
    // told once, and only about a step that was kept (it made the frames faster), never one that was undone
    if (!toasted && applied > 0 && governor.kept > 0) { toasted = true; map.toast('Effects lowered to keep the flight smooth (Settings, Quality)'); }
  };
  /** Start or end the governor's flight before applying, so a switch back to Auto (or re-enabling) mid-flight never
   *  pushes the level the last flight ended on for a frame before start() steps it up. */
  const sync = (now: number) => {
    const judge = judging();
    if (judge && !governor.isFlying) governor.start(now);
    else if (!judge && governor.isFlying) governor.end();
    apply();
  };
  const onFrame = (f: FrameInfo) => {
    const keptBefore = governor.kept;
    if (judging() !== governor.isFlying) sync(f.time);
    if (governor.isFlying && (governor.frame(f.time) || governor.kept !== keptBefore)) apply();
  };
  const offFrame = map.on('frame', onFrame);
  const offSettings = map.onSettings(() => sync(performance.now()));
  // a resize reallocates every canvas: its first frames say nothing about the steady load
  const onResize = () => { governor.resized(performance.now()); apply(); };
  addEventListener('resize', onResize);
  return {
    governor,
    debug: {
      force(level: number) { governor.force(level, performance.now()); apply(); },
      setEnabled(on: boolean) { enabled = on; sync(performance.now()); },
      get enabled() { return enabled; },
    },
    dispose() { offFrame(); offSettings(); removeEventListener('resize', onResize); },
  };
}
