// Portfolio as a game (web/portfolio.html, or index.html?portfolio=1): a title screen over the live map, stops to
// find as a goose, a quest tracker with a pointer to the next stop, and a finish message. Stop content itself is in
// web/public/data/portfolio_stops.json and is shown by the landmark widget (map/widgets/landmarks.ts).
import './game.css';
import type { ActorModule, Landmark, MapAPI } from '../types';
import { h, icon } from '../map/widgets/dom';

const SEEN_KEY = 'arjunPortfolio.stopsFound.v1';
const FIND_RADIUS = 150;            // canvas px (about 45 m): flying this close to a stop finds it
const M_PER_PX = 0.29296875;

export function startPortfolioGame(map: MapAPI, actor: ActorModule, stops: Landmark[], ui: HTMLElement): void {
  const app = document.getElementById('app')!;
  const found = new Set<string>();
  try { for (const id of JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) if (stops.some((s) => s.id === id)) found.add(id); } catch { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...found])); } catch { /* ignore */ } };
  let target: Landmark | null = null;

  // ------------------------------------------------------------------ quest tracker
  const items = new Map<string, HTMLButtonElement>();
  const list = h('ol', { class: 'quest-list' });
  for (const s of stops) {
    const b = h('button', { type: 'button', class: 'quest-item', onclick: () => { target = s; map.toast(`Pointer set to ${s.name}`); update(); } },
      h('span', { class: 'quest-mark', 'aria-hidden': 'true' }), h('span', { class: 'quest-name' }, s.name), h('span', { class: 'quest-cat' }, s.category));
    items.set(s.id, b);
    list.append(h('li', {}, b));
  }
  const count = h('span', { class: 'quest-count' });
  const pointerArrow = h('span', { class: 'quest-arrow', 'aria-hidden': 'true' }, '➤');
  const pointerText = h('span', { class: 'quest-next' });
  const pointer = h('div', { class: 'quest-pointer', role: 'status', 'aria-live': 'off' }, pointerArrow, pointerText);
  const reset = h('button', { type: 'button', class: 'quest-reset', onclick: () => { found.clear(); save(); update(); map.toast('Progress cleared'); } }, 'Reset');
  const tracker = h('section', { class: 'quest panel-chrome', 'aria-label': 'Portfolio stops' },
    h('header', { class: 'quest-head' }, h('span', { class: 'quest-title' }, 'Stops found'), count), pointer, list, reset);
  ui.append(tracker);

  // ------------------------------------------------------------------ title screen
  const startBtn = h('button', { type: 'button', class: 'btn primary title-start' }, icon('bird'), found.size ? 'Continue flying' : 'Start flying');
  const lookBtn = h('button', { type: 'button', class: 'title-look' }, 'or look around the map first');
  const title = h('div', { class: 'title-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title-name' },
    h('div', { class: 'title-box' },
      h('p', { class: 'title-kicker' }, 'An interactive portfolio'),
      h('h1', { id: 'title-name' }, 'Arjun Behl'),
      h('p', { class: 'title-tag' }, 'I build software and AI-powered tools.'),
      h('p', { class: 'title-sub' }, `Fly a goose over the University of Waterloo campus and find the ${stops.length} stops: three projects, experience, education and how to reach me.`),
      startBtn,
      found.size ? h('p', { class: 'title-progress' }, `${found.size} of ${stops.length} stops found so far`) : null,
      h('p', { class: 'title-keys' }, h('kbd', {}, 'W A S D'), ' or arrows steer  ', h('kbd', {}, 'Shift'), ' faster  ', h('kbd', {}, 'Space'), ' flap  ', h('kbd', {}, 'L'), ' land and read a stop'),
      lookBtn,
      h('p', { class: 'title-links' },
        h('a', { href: 'https://github.com/ArjunB3hl', target: '_blank', rel: 'noopener noreferrer' }, 'GitHub'),
        h('a', { href: 'https://www.linkedin.com/in/arjunbehl8/', target: '_blank', rel: 'noopener noreferrer' }, 'LinkedIn'),
        h('a', { href: 'mailto:arjun.behl.2003@gmail.com' }, 'Email'))));
  ui.append(title);
  const closeTitle = () => { title.remove(); app.classList.remove('title-open'); };
  app.classList.add('title-open');
  const first = stops.find((s) => s.id === 'about') ?? stops[0];
  startBtn.addEventListener('click', () => {
    closeTitle();
    actor.start({ cx: first.canvas[0] - 60, cy: first.canvas[1] + 240 }).catch((e) => map.toast(`Could not start flight: ${e?.message ?? e}`));
  });
  lookBtn.addEventListener('click', () => { closeTitle(); document.getElementById('stage')?.focus(); });
  title.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeTitle(); document.getElementById('stage')?.focus(); } e.stopPropagation(); });
  window.setTimeout(() => startBtn.focus(), 0);

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
      items.get(s.id)!.classList.toggle('target', target?.id === s.id);
      items.get(s.id)!.setAttribute('aria-label', `${s.name}, ${s.category}, ${done ? 'found' : 'not found yet'}${target?.id === s.id ? ', pointer set' : ''}`);
      document.querySelector<HTMLElement>(`.map-label[data-id="${s.id}"]`)?.classList.toggle('found', done);
    }
    reset.hidden = found.size === 0;
  }
  function find(s: Landmark) {
    if (found.has(s.id)) return;
    found.add(s.id); save();
    if (target?.id === s.id) target = null;
    const award = s.portfolio?.award ? ` - ${s.portfolio.award}` : '';
    map.toast(found.size === stops.length ? `Found ${s.name}${award}. That is all ${stops.length} stops!` : `Found ${s.name}${award} (${found.size}/${stops.length}). Press L to land and read it`);
    update();
    if (found.size === stops.length && !finished) {
      finished = true;
      window.setTimeout(() => map.toast('All stops found. Thanks for flying by: arjun.behl.2003@gmail.com'), 4200);
    }
  }
  let lastNear: string | null = null;
  map.on('frame', () => {
    const v = map.getView(), here: [number, number] = [v.cx, v.cy];
    const flying = !!actor.active;
    if (flying) {
      const [s, d] = nearest(here, stops);
      if (s && d < FIND_RADIUS) {
        if (!found.has(s.id)) find(s);
        else if (lastNear !== s.id) map.toast(`Over ${s.name} - press L to land and read it`);
        lastNear = s.id;
      } else lastNear = null;
    }
    // pointer to the chosen stop, else the nearest one not found yet
    const todo = stops.filter((s) => !found.has(s.id));
    const goal = target ?? nearest(here, todo)[0];
    if (!goal) { pointer.classList.add('all'); pointerText.textContent = 'All stops found'; return; }
    pointer.classList.remove('all');
    const dx = goal.canvas[0] - here[0], dy = goal.canvas[1] - here[1];
    const metres = Math.round(Math.hypot(dx, dy * Math.SQRT2) * M_PER_PX / 10) * 10;
    pointerArrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    pointerText.textContent = `${goal.name} · ${metres} m`;
  });
  // opening a stop from its beacon also counts as finding it
  document.getElementById('labels')!.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('.map-label')?.dataset.id;
    const s = stops.find((x) => x.id === id);
    if (s) find(s);
  });
  update();
}
