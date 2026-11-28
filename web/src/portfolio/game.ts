// Portfolio as a game (web/portfolio.html, or index.html?portfolio=1): a title screen over the live map, stops to
// find as a goose, a quest tracker with a pointer to the next stop, and a finish message. Stop content itself is in
// web/public/data/portfolio_stops.json and is shown by the landmark widget (map/widgets/landmarks.ts). Its stylesheet
// (game.css) is imported by main.ts, so the title screen and the hidden map-app chrome are styled at first paint.
import type { ActorModule, Landmark, MapAPI } from '../types';
import { h, icon } from '../map/widgets/dom';
import { createPortfolioMusic } from './music';

const SEEN_KEY = 'arjunPortfolio.stopsFound.v1';
const FIND_RADIUS = 150;            // canvas px (about 45 m): flying this close to a stop finds it
const M_PER_PX = 0.29296875;
const PREFETCH_DELAY_MS = 1500;     // after the title shows: fetch what a take-off needs while the visitor reads

/** Touch screens get tap wording instead of key names (same test as the touch flight pad's CSS). */
const touch = () => matchMedia('(pointer: coarse)').matches;

export function startPortfolioGame(map: MapAPI, actor: ActorModule, stops: Landmark[], ui: HTMLElement): void {
  const app = document.getElementById('app')!;
  const music = createPortfolioMusic(ui);
  const found = new Set<string>();
  try { for (const id of JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) if (stops.some((s) => s.id === id)) found.add(id); } catch { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...found])); } catch { /* ignore */ } };

  /** Shortcut: go straight to a stop and open its card, without flying (lands the goose first if it is in the air). */
  function jumpTo(s: Landmark) {
    const open = () => document.querySelector<HTMLElement>(`.map-label[data-id="${s.id}"]`)?.click();   // moves the map, opens the card, marks it found
    if (!actor.active) { open(); return; }
    actor.stop();
    const t0 = performance.now();
    const wait = () => { if (!app.classList.contains('actor-active') || performance.now() - t0 > 1500) open(); else window.setTimeout(wait, 50); };
    wait();
  }

  // ------------------------------------------------------------------ quest tracker
  const items = new Map<string, HTMLButtonElement>();
  const list = h('ol', { class: 'quest-list' });
  stops.forEach((s, n) => {
    const b = h('button', { type: 'button', class: 'quest-item', title: `Jump to ${s.name} (key ${n + 1})`, onclick: () => jumpTo(s) },
      h('span', { class: 'quest-mark', 'aria-hidden': 'true' }), h('span', { class: 'quest-name' }, s.name), h('kbd', { class: 'quest-key', 'aria-hidden': 'true' }, String(n + 1)));
    items.set(s.id, b);
    list.append(h('li', {}, b));
  });
  const count = h('span', { class: 'quest-count' });
  const pointerArrow = h('span', { class: 'quest-arrow', 'aria-hidden': 'true' }, '➤');
  const pointerText = h('span', { class: 'quest-next' });
  const pointer = h('div', { class: 'quest-pointer', role: 'status', 'aria-live': 'off' }, pointerArrow, pointerText);
  const reset = h('button', { type: 'button', class: 'quest-reset', onclick: () => { found.clear(); save(); update(); map.toast('Progress cleared'); } }, 'Reset');
  // the chevron only shows on short screens (landscape phones), where the list starts folded away (game.css)
  list.id = 'quest-list';
  const more = h('button', { type: 'button', class: 'quest-more', 'aria-controls': 'quest-list', 'aria-expanded': 'false', 'aria-label': 'Show all stops' }, icon('chevron'));
  const tracker = h('section', { class: 'quest panel-chrome', 'aria-label': 'Portfolio stops' },
    h('header', { class: 'quest-head' }, h('span', { class: 'quest-title' }, 'Stops found'), count, more), pointer, list,
    h('p', { class: 'quest-hint' }, touch() ? 'Tap a stop to jump there' : `Click a stop or press 1–${stops.length} to jump there`), reset);
  more.addEventListener('click', () => {
    const open = tracker.classList.toggle('expanded');
    more.setAttribute('aria-expanded', String(open));
    more.setAttribute('aria-label', open ? 'Hide the list of stops' : 'Show all stops');
  });
  ui.append(tracker);

  // ------------------------------------------------------------------ title screen
  const startLabel = h('span', {}, found.size ? 'Continue flying' : 'Start flying');
  const startBtn = h('button', { type: 'button', class: 'btn primary title-start' }, icon('bird'), startLabel);
  const lookBtn = h('button', { type: 'button', class: 'title-look' }, 'Skip the flight: jump straight to the stops');
  const startError = h('p', { class: 'title-error', role: 'alert', hidden: true });
  const title = h('div', { class: 'title-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title-name' },
    h('div', { class: 'title-box' },
      h('p', { class: 'title-kicker' }, 'An interactive portfolio'),
      h('h1', { id: 'title-name' }, 'Arjun Behl'),
      h('p', { class: 'title-tag' }, 'I build software and AI-powered tools.'),
      h('p', { class: 'title-sub' }, 'Fly a goose over the University of Waterloo campus and find the stops: my projects, experience, education, skills and how to reach me.'),
      startBtn,
      startError,
      found.size ? h('p', { class: 'title-progress' }, `${found.size} of ${stops.length} stops found so far`) : null,
      h('p', { class: 'title-keys' }, h('kbd', {}, 'W A S D'), ' or arrows steer  ', h('kbd', {}, 'Shift'), ' faster  ', h('kbd', {}, 'Space'), ' flap  ', h('kbd', {}, 'L'), ' land and read a stop  ', h('kbd', {}, `1–${stops.length}`), ' jump to a stop'),
      h('p', { class: 'title-touch' }, 'Steer with the arrow buttons and tap Land to read a stop, or tap a stop in the list to jump there.'),
      lookBtn,
      h('p', { class: 'title-links' },
        h('a', { href: 'https://github.com/ArjunB3hl', target: '_blank', rel: 'noopener noreferrer' }, 'GitHub'),
        h('a', { href: 'https://www.linkedin.com/in/arjunbehl8/', target: '_blank', rel: 'noopener noreferrer' }, 'LinkedIn'),
        h('a', { href: 'mailto:arjun.behl.2003@gmail.com' }, 'Email'))));
  document.getElementById('title-boot')?.remove();     // the static title portfolio.html paints before the scripts run
  ui.append(title);
  // Escape leaves the title wherever focus is: on the music toggle, which sits outside it, too
  const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !title.contains(e.target as Node)) { leaveTitle(); document.getElementById('stage')?.focus(); } };
  const closeTitle = () => { title.remove(); app.classList.remove('title-open'); window.removeEventListener('keydown', onEscape); };
  app.classList.add('title-open');
  window.addEventListener('keydown', onEscape);
  const first: Landmark | undefined = stops.find((s) => s.id === 'about') ?? stops[0];   // none if the stops failed to load
  // The title stays up, with the button showing that the goose is taking off, until the flight has really started: the
  // first take-off downloads the 3D renderers and collision data, which takes seconds on a phone. Closing the title
  // first left a bare map that did nothing, and a stop opened meanwhile was closed again when the flight began.
  // Skip and Escape stay live meanwhile and drop the take-off, so a slow or stalled load never traps the visitor.
  let launching = false;
  const endLaunch = () => { launching = false; startBtn.removeAttribute('aria-disabled'); startBtn.removeAttribute('aria-busy'); };
  const leaveTitle = () => {
    if (launching) { endLaunch(); actor.cancelStart?.(); }
    closeTitle(); music.start();
  };
  startBtn.addEventListener('click', () => {
    if (launching) return;
    launching = true;
    music.start();                       // inside the click: browsers only allow audible playback from a gesture
    // aria-disabled, not disabled: a disabled button drops keyboard focus to the page, where Escape no longer reaches the title
    startBtn.setAttribute('aria-disabled', 'true');
    startBtn.setAttribute('aria-busy', 'true');
    startLabel.textContent = 'Taking off…';
    startError.hidden = true;
    const at = first ? { cx: first.canvas[0] - 60, cy: first.canvas[1] + 240 } : undefined;
    // through a promise, so a synchronous throw also lands in the failure path below instead of leaving the title stuck
    Promise.resolve().then(() => actor.start(at)).then(() => { if (launching) { endLaunch(); closeTitle(); } }, (e) => {
      console.warn('Goose flight could not start:', e);
      if (!launching) return;            // the visitor already left the title with Skip or Escape
      endLaunch();
      startLabel.textContent = 'Try again';
      startError.textContent = 'The flight could not start. Check the connection and try again, or jump straight to the stops below.';
      startError.hidden = false;
      startBtn.focus();
    });
  });
  lookBtn.addEventListener('click', () => {
    leaveTitle();
    if (first) jumpTo(first);
    map.toast(touch() ? 'No flying needed: pick a stop from the list' : `No flying needed: pick a stop from the list, or press 1–${stops.length}`);
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { leaveTitle(); document.getElementById('stage')?.focus(); }
    e.stopPropagation();
  });
  window.setTimeout(() => startBtn.focus(), 0);
  window.setTimeout(() => actor.prefetch?.(), PREFETCH_DELAY_MS);

  // ------------------------------------------------------------------ progress
  const nearest = (from: [number, number], pool: Landmark[]) => {
    let best: Landmark | null = null, bd = Infinity;
    for (const s of pool) { const d = Math.hypot(s.canvas[0] - from[0], s.canvas[1] - from[1]); if (d < bd) { bd = d; best = s; } }
    return [best, bd] as const;
  };
  let finished = found.size === stops.length;
  function update() {
    count.textContent = `${found.size} / ${stops.length}`;
    for (const s of stops) {
      const done = found.has(s.id);
      items.get(s.id)!.classList.toggle('done', done);
      items.get(s.id)!.setAttribute('aria-label', `${s.name}, ${s.category}, ${done ? 'found' : 'not found yet'}. Jump to this stop`);
      document.querySelector<HTMLElement>(`.map-label[data-id="${s.id}"]`)?.classList.toggle('found', done);
    }
    reset.hidden = found.size === 0;
  }
  function find(s: Landmark) {
    if (found.has(s.id)) return;
    found.add(s.id); save();
    const award = s.portfolio?.award ? ` - ${s.portfolio.award}` : '';
    map.toast(found.size === stops.length ? `Found ${s.name}${award}. That is all ${stops.length} stops!` : `Found ${s.name}${award} (${found.size}/${stops.length}). ${touch() ? 'Tap Land to read it' : 'Press L to land and read it'}`);
    update();
    if (found.size === stops.length && !finished) {
      finished = true;
      window.setTimeout(() => map.toast('All stops found. Thanks for flying by: arjun.behl.2003@gmail.com'), 4200);
    }
  }
  let lastNear: string | null = null;
  const shown = { state: '?', arrow: '', text: '' };
  const setPointer = (state: '' | 'all', arrow: string, text: string) => {
    if (state !== shown.state) { shown.state = state; pointer.classList.toggle('all', state === 'all'); }
    if (arrow !== shown.arrow) { shown.arrow = arrow; pointerArrow.style.transform = arrow; }
    if (text !== shown.text) { shown.text = text; pointerText.textContent = text; }
  };
  map.on('frame', () => {
    const v = map.getView(), here: [number, number] = [v.cx, v.cy];
    const flying = !!actor.active;
    if (flying) {
      const [s, d] = nearest(here, stops);
      if (s && d < FIND_RADIUS) {
        if (!found.has(s.id)) find(s);
        else if (lastNear !== s.id) map.toast(`Over ${s.name} - ${touch() ? 'tap Land to read it' : 'press L to land and read it'}`);
        lastNear = s.id;
      } else lastNear = null;
    }
    // pointer to the nearest stop not found yet
    const todo = stops.filter((s) => !found.has(s.id));
    const goal = nearest(here, todo)[0];
    // touch the DOM only when what is shown changes: this runs every frame, and each write is a mutation the browser
    // (and any extension watching the page) has to process
    if (!goal) { setPointer('all', '', 'All stops found'); return; }
    const dx = goal.canvas[0] - here[0], dy = goal.canvas[1] - here[1];
    const metres = Math.round(Math.hypot(dx, dy * Math.SQRT2) * M_PER_PX / 10) * 10;
    setPointer('', `rotate(${Math.atan2(dy, dx).toFixed(2)}rad)`, `${goal.name} · ${metres} m`);
  });
  // opening a stop from its beacon also counts as finding it
  document.getElementById('labels')!.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('.map-label')?.dataset.id;
    const s = stops.find((x) => x.id === id);
    if (s) find(s);
  });
  // keys 1..n jump to a stop (not while typing, and not while the title screen is open)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || app.classList.contains('title-open')) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= stops.length) { e.preventDefault(); jumpTo(stops[n - 1]); }
  });
  update();
}
