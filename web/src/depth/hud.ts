// Goose flight HUD inside map.hudRoot: a compact toolbar (altitude, speed, feathers, nearest-feather pointer, Land),
// keyboard hints, touch flight buttons (coarse pointers) and screen-positioned markers for uncollected feathers.
// Only buttons take pointer input (#hud passes everything else through to the map).
import './actor.css';
import type { FlightInput } from './flight';

const FEATHER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3c-6 0-11 4-12.5 10.5L5 21l2-.6 1.5-4.4C15 15.5 19.5 10 20 3z"/><path d="M8.5 16 15 8.5"/></svg>';
const ARROW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M12 6l6 6-6 6"/></svg>';

type PadKey = 'left' | 'right' | 'up' | 'down' | 'boost' | 'flap';

const PAD: { key: PadKey; label: string; glyph: string }[] = [
  { key: 'left', label: 'Turn left', glyph: '◀' },
  { key: 'up', label: 'Climb', glyph: '▲' },
  { key: 'down', label: 'Dive', glyph: '▼' },
  { key: 'right', label: 'Turn right', glyph: '▶' },
  { key: 'flap', label: 'Flap', glyph: 'Flap' },
  { key: 'boost', label: 'Boost', glyph: 'Boost' },
];

export interface HudStats {
  altitude: number;          // m above the surface below (NaN = unknown)
  speed: number;             // m/s horizontal
  feathers: number; total: number;
  nearest: { angle: number; distance: number; label: string } | null;   // screen angle (rad, clockwise from +x)
}

export interface FeatherMarker { id: string; x: number; y: number; label: string }

export class FlightHud {
  readonly el: HTMLElement;
  private readonly alt: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly feathers: HTMLElement;
  private readonly nearest: HTMLElement;
  private readonly nearestArrow: HTMLElement;
  private readonly nearestText: HTMLElement;
  private readonly markers: HTMLElement;
  private readonly markerEls = new Map<string, HTMLElement>();
  private readonly held = new Set<PadKey>();
  private lastText = '';

  constructor(root: HTMLElement, onLand: () => void) {
    this.el = el('div', 'goose-hud');
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Goose flight');
    this.el.hidden = true;

    this.markers = el('div', 'gh-markers');
    this.markers.setAttribute('aria-hidden', 'true');

    const bar = el('div', 'gh-bar');
    const stat = (label: string) => {
      const s = el('span', 'gh-stat');
      s.append(el('span', 'gh-label', label));
      const v = el('span', 'gh-val');
      s.append(v);
      bar.append(s);
      return v;
    };
    this.alt = stat('Altitude');
    this.speed = stat('Speed');
    const f = el('span', 'gh-stat gh-feathers');
    f.title = 'Feathers collected';
    f.insertAdjacentHTML('afterbegin', FEATHER_SVG);
    this.feathers = el('span', 'gh-val');
    f.append(this.feathers);
    bar.append(f);
    this.nearest = el('span', 'gh-stat gh-nearest');
    this.nearestArrow = el('span', 'gh-arrow');
    this.nearestArrow.innerHTML = ARROW_SVG;
    this.nearestText = el('span', 'gh-val');
    this.nearest.append(this.nearestArrow, this.nearestText);
    bar.append(this.nearest);
    const land = el('button', 'gh-land', 'Land') as HTMLButtonElement;
    land.type = 'button';
    land.setAttribute('aria-label', 'Land and leave goose flight (L or Escape)');
    land.addEventListener('click', onLand);
    bar.append(land);

    const hints = el('p', 'gh-hints');
    hints.innerHTML = '<kbd>A</kbd><kbd>D</kbd> turn · <kbd>W</kbd><kbd>S</kbd> climb / dive · <kbd>Shift</kbd> boost · <kbd>Space</kbd> flap · <kbd>L</kbd> land';

    // touch buttons: hold to steer. Keyboard users have the keys, so these stay out of the tab order.
    const pad = el('div', 'gh-pad');
    for (const p of PAD) {
      const b = el('button', `gh-pad-btn gh-${p.key}`, p.glyph) as HTMLButtonElement;
      b.type = 'button';
      b.tabIndex = -1;
      b.setAttribute('aria-label', p.label);
      const on = (e: PointerEvent) => { e.preventDefault(); b.setPointerCapture(e.pointerId); this.held.add(p.key); b.classList.add('on'); };
      const off = () => { this.held.delete(p.key); b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      pad.append(b);
    }

    this.el.append(this.markers, bar, hints, pad);
    root.append(this.el);
  }

  show(on: boolean): void {
    this.el.hidden = !on;
    if (!on) { this.held.clear(); for (const b of this.el.querySelectorAll('.gh-pad-btn.on')) b.classList.remove('on'); }
  }

  /** Touch-button contribution to the flight input. */
  touchInput(): FlightInput {
    const h = this.held;
    return {
      turn: (h.has('left') ? 1 : 0) - (h.has('right') ? 1 : 0),
      climb: (h.has('up') ? 1 : 0) - (h.has('down') ? 1 : 0),
      boost: h.has('boost'), flap: h.has('flap'),
    };
  }

  /** Numbers in the toolbar (cheap: only touches the DOM when the rounded text changes). */
  update(s: HudStats): void {
    const alt = s.altitude === s.altitude ? `${Math.max(0, Math.round(s.altitude))} m` : '–';
    const text = `${alt}|${Math.round(s.speed)}|${s.feathers}/${s.total}|${s.nearest ? Math.round(s.nearest.distance / 10) : ''}`;
    if (s.nearest) this.nearestArrow.style.transform = `rotate(${s.nearest.angle.toFixed(3)}rad)`;
    if (text === this.lastText) return;
    this.lastText = text;
    this.alt.textContent = alt;
    this.speed.textContent = `${Math.round(s.speed)} m/s`;
    this.feathers.textContent = `${s.feathers}/${s.total}`;
    this.nearest.hidden = !s.nearest;
    if (s.nearest) {
      const d = s.nearest.distance;
      this.nearestText.textContent = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`;
      this.nearest.title = `Nearest feather: ${s.nearest.label}`;
    }
  }

  /** Place markers for the given (on-screen, uncollected) feathers; others are removed. */
  setMarkers(list: FeatherMarker[]): void {
    const keep = new Set<string>();
    for (const m of list) {
      keep.add(m.id);
      let e = this.markerEls.get(m.id);
      if (!e) {
        e = el('div', 'gh-marker');
        e.innerHTML = FEATHER_SVG;
        e.title = m.label;
        this.markers.append(e);
        this.markerEls.set(m.id, e);
      }
      e.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
    }
    for (const [id, e] of this.markerEls) if (!keep.has(id)) { e.remove(); this.markerEls.delete(id); }
  }

  dispose(): void { this.el.remove(); }
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
