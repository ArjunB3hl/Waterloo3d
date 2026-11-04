// Floating side panels (bottom sheets on phones): one open at a time, Escape / close button closes and focus
// returns to the control that opened it. Also builds the Settings and About panel contents.
import type { MapAPI, Settings } from '../../types';
import { h, icon } from './dom';

export class Panels {
  private current: { el: HTMLElement; opener: HTMLElement | null } | null = null;

  constructor(private readonly host: HTMLElement) {}

  /** Build an empty dialog shell; fill `.panel-body`. */
  create(id: string, title: string): { el: HTMLElement; body: HTMLElement; title: HTMLElement } {
    const titleEl = h('h2', { id: `${id}-title`, tabindex: -1 }, title);
    const body = h('div', { class: 'panel-body' });
    const el = h('section', { id, class: 'panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': `${id}-title`, hidden: true },
      h('header', { class: 'panel-head' }, titleEl,
        h('button', { class: 'icon-btn', 'aria-label': `Close ${title}`, onclick: () => this.close() }, icon('close'))),
      body);
    this.host.append(el);
    return { el, body, title: titleEl };
  }

  isOpen(el: HTMLElement): boolean { return this.current?.el === el; }

  open(el: HTMLElement, opener: HTMLElement | null): void {
    if (this.current?.el === el) return;
    if (this.current) this.hide(false);
    this.current = { el, opener };
    el.hidden = false;
    opener?.setAttribute('aria-expanded', 'true');
    (el.querySelector('h2') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  toggle(el: HTMLElement, opener: HTMLElement | null): void {
    if (this.isOpen(el)) this.close(); else this.open(el, opener);
  }

  /** Close the open panel. Returns false if none was open (so Escape can fall through). */
  close(): boolean {
    if (!this.current) return false;
    this.hide(true);
    return true;
  }

  private hide(restoreFocus: boolean): void {
    const c = this.current!;
    this.current = null;
    c.el.hidden = true;
    c.opener?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && c.opener?.isConnected) c.opener.focus({ preventScroll: true });
  }
}

// ------------------------------------------------------------------------------------------ settings

export function buildSettings(body: HTMLElement, map: MapAPI): void {
  const toggles: [keyof Settings, string, string?][] = [
    ['minimap', 'Minimap', 'Keyboard shortcut: M'],
    ['life', 'Life on the map', 'Swaying trees and moving water'],
    ['labels', 'Landmark labels'],
    ['coverage', 'Coverage overlay', 'City boundary, pending areas and render badges'],
    ['tiltShift', 'Tilt-shift focus', 'Miniature-style depth of field'],
  ];
  const inputs = new Map<keyof Settings, HTMLInputElement>();
  const list = h('div', { class: 'settings-list' });
  for (const [key, label, hint] of toggles) {
    const id = `set-${key}`;
    const input = h('input', { id, type: 'checkbox', role: 'switch', onchange: () => map.updateSettings({ [key]: input.checked }) });
    inputs.set(key, input);
    list.append(h('label', { class: 'setting', for: id },
      h('span', { class: 'setting-text' }, h('span', {}, label), hint ? h('small', {}, hint) : null),
      input, h('span', { class: 'switch', 'aria-hidden': 'true' })));
    if (key === 'tiltShift') {
      const range = h('input', { id: 'set-tiltStrength', type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Tilt-shift strength',
        oninput: () => map.updateSettings({ tiltStrength: Number(range.value) }) });
      inputs.set('tiltStrength', range);
      list.append(h('div', { class: 'setting setting-range' }, h('label', { for: 'set-tiltStrength' }, 'Strength'), range));
    }
  }
  const quality = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Rendering quality' });
  for (const q of ['auto', 'high', 'low'] as const) {
    const id = `set-quality-${q}`;
    const r = h('input', { type: 'radio', name: 'quality', id, value: q, onchange: () => map.updateSettings({ quality: q }) });
    quality.append(r, h('label', { for: id }, q[0].toUpperCase() + q.slice(1)));
  }
  list.append(h('div', { class: 'setting' }, h('span', { class: 'setting-text' }, h('span', {}, 'Quality'), h('small', {}, 'Low halves effect-layer resolution')), quality));
  const perf = h('input', { id: 'set-perfHud', type: 'checkbox', role: 'switch', onchange: () => map.updateSettings({ perfHud: perf.checked }) });
  inputs.set('perfHud', perf);
  list.append(h('label', { class: 'setting', for: 'set-perfHud' }, h('span', { class: 'setting-text' }, h('span', {}, 'Performance HUD')), perf, h('span', { class: 'switch', 'aria-hidden': 'true' })));
  body.append(list);

  const sync = (s: Settings) => {
    for (const [k, el] of inputs) {
      if (el.type === 'checkbox') el.checked = !!s[k];
      else el.value = String(s[k]);
    }
    inputs.get('tiltStrength')!.disabled = !s.tiltShift;
    for (const r of quality.querySelectorAll('input')) r.checked = r.value === s.quality;
  };
  sync(map.settings);
  map.onSettings(sync);
}

// ------------------------------------------------------------------------------------------ about

export function buildAbout(body: HTMLElement, map: MapAPI): void {
  const c = map.manifest.counts;
  const link = (href: string, text: string) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
  const keys: [string, string][] = [
    ['Drag / arrows / WASD', 'Move the map (Shift = faster)'], ['Scroll / pinch / + -', 'Zoom'], ['Double-click', 'Zoom in'],
    ['0', 'Home view (campus)'], ['/', 'Search'], ['M', 'Toggle minimap'], ['Esc', 'Close panels'],
  ];
  body.append(
    h('p', {}, 'Tiny Waterloo is an interactive illustrated isometric map of Waterloo, Ontario, drawn from a single fixed ',
      'oblique camera so the whole city reads like a miniature model.'),
    h('p', { class: 'note' }, `${c.tiles} tiles are published so far, around the University of Waterloo, Waterloo Park and Uptown. `,
      c.art ? `${c.art} carry final artwork; ` : '',
      `${c.reference} are reference renders - procedural renders of the real geometry awaiting generated artwork. `,
      'Hatched areas inside the dashed city boundary are coming soon.'),
    h('h3', {}, 'Data and licences'),
    h('ul', { class: 'sources' },
      h('li', {}, 'Buildings, roads, land use: ', link('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors'), ' (ODbL), via ',
        link('https://overturemaps.org', 'Overture Maps Foundation'), '.'),
      h('li', {}, 'Building heights: OSM tags where present, otherwise Microsoft ML building heights (ODbL, via Overture) or class defaults - landmark cards flag approximations.'),
      h('li', {}, 'Terrain: ', link('https://registry.opendata.aws/terrain-tiles/', 'AWS Terrain Tiles / Mapzen'),
        ', including CDEM © Natural Resources Canada (', link('https://open.canada.ca/en/open-government-licence-canada', 'OGL-Canada'), ').'),
      h('li', {}, 'City boundary: Overture divisions (from OSM).'),
      ...map.manifest.attribution.map((a) => h('li', { class: 'muted' }, a))),
    h('h3', {}, 'Keyboard'),
    h('dl', { class: 'keys' }, ...keys.flatMap(([k, v]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, v)])),
    h('p', { class: 'muted' }, 'Original code and artwork. Inspired by the interaction quality of tiny illustrated city maps.'),
  );
}
