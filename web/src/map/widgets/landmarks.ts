// Landmark card strip (bottom centre), landmark detail panel and the map labels for covered landmarks.
import type { ActorModule, Landmark, MapAPI } from '../../types';
import { h, icon } from './dom';
import type { Panels } from './panels';

const LABEL_MIN_ZOOM = 0.15;
/** Zoom used to show a pending landmark: far enough out to read the hatched "coming soon" area. */
const PENDING_ZOOM = 0.3;
const STRIP_KEY = 'tinyWaterloo.stripCollapsed';

const isApprox = (s: string) => /approx|estimate|default/i.test(s);

export function createLandmarks(map: MapAPI, landmarks: Landmark[], actor: ActorModule, panels: Panels) {
  const portfolio = landmarks.some((l) => l.portfolio);
  const stripTitle = portfolio ? 'Portfolio stops' : 'Landmarks';
  // ---------------------------------------------------------------- detail panel
  const detail = panels.create('landmark-panel', 'Landmark');
  const cards = new Map<string, HTMLButtonElement>();

  const showPortfolio = (l: Landmark, opener: HTMLElement | null) => {
    const p = l.portfolio!;
    detail.title.textContent = l.name;
    const nodes: (Node | null)[] = [
      h('p', { class: 'chips' }, h('span', { class: 'chip' }, l.category), p.award ? h('span', { class: 'chip ok' }, p.award) : null),
      p.meta ? h('p', { class: 'muted' }, p.meta) : null,
      h('p', {}, l.description),
      (l.facts?.length ? h('ul', { class: 'stop-facts' }, ...l.facts.map((f) => h('li', {}, f))) : null),
      (p.tech?.length ? h('p', { class: 'chips' }, ...p.tech.map((t) => h('span', { class: 'chip code' }, t))) : null),
      ...(p.sections ?? []).map((sec) => h('section', { class: 'stop-section' },
        h('h3', {}, sec.title),
        sec.award ? h('p', { class: 'chips' }, h('span', { class: 'chip ok' }, sec.award)) : null,
        sec.meta ? h('p', { class: 'muted' }, sec.meta) : null,
        sec.text ? h('p', {}, sec.text) : null,
        sec.tech?.length ? h('p', { class: 'chips' }, ...sec.tech.map((t) => h('span', { class: 'chip code' }, t))) : null,
        sec.links?.length ? h('p', { class: 'stop-link' }, ...sec.links.map((k) => h('a', { href: k.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${sec.title} on ${k.label} (opens in a new tab)` }, k.label, icon('external')))) : null)),
      (p.links.length ? h('ul', { class: 'sources' }, ...p.links.map((s) => h('li', {},
        h('a', { href: s.url, target: s.url.startsWith('mailto:') ? '_self' : '_blank', rel: 'noopener noreferrer' }, s.label, icon('external'))))) : null),
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: () => { panels.close(); actor.start({ cx: l.canvas[0], cy: l.canvas[1] }).catch((e) => map.toast(`Could not start flight: ${e?.message ?? e}`)); },
      }, icon('bird'), 'Keep flying'),
    ];
    detail.body.replaceChildren(...nodes.filter((n): n is Node => n !== null));
    panels.open(detail.el, opener);
  };

  const showDetail = (l: Landmark, opener: HTMLElement | null) => {
    if (l.portfolio) { showPortfolio(l, opener); return; }
    detail.title.textContent = l.name;
    const covered = l.status === 'covered';
    const heightApprox = isApprox(l.height_source);
    const [ti, tj] = map.frame.tileOf(l.canvas[0], l.canvas[1]);
    const tileKind = map.manifest.tiles[`${ti}_${tj}`]?.kind;
    const status = !covered ? 'Outside the published tiles - coming soon'
      : tileKind === 'art' ? 'Illustrated' : 'Reference render - artwork pending';
    detail.body.replaceChildren(
      h('p', { class: 'chips' },
        h('span', { class: 'chip' }, l.category),
        h('span', { class: `chip ${covered ? 'ok' : 'soon'}` }, covered ? 'On the map' : 'Coming soon')),
      h('p', {}, l.description),
      ...(l.facts ?? []).map((f) => h('p', { class: 'muted' }, f)),
      h('dl', { class: 'meta' },
        h('dt', {}, 'Geometry'), h('dd', {}, l.geometry_source),
        h('dt', {}, 'Height'), h('dd', {}, l.height_source, heightApprox ? h('span', { class: 'chip warn', title: 'Height is approximated, not surveyed' }, 'Approximate') : null),
        h('dt', {}, 'Status'), h('dd', {}, status)),
      h('h3', {}, 'Sources'),
      h('ul', { class: 'sources' }, ...l.sources.map((s) => h('li', {}, s.url
        ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label, icon('external'))
        : s.label))),
      ...(covered ? [h('button', {
        class: 'btn primary', type: 'button',
        onclick: () => { panels.close(); actor.start({ cx: l.canvas[0], cy: l.canvas[1] }).catch((e) => map.toast(`Could not start flight: ${e?.message ?? e}`)); },
      }, icon('bird'), 'Fly from here')] : []),
    );
    panels.open(detail.el, opener);
  };

  const select = (l: Landmark, opener: HTMLElement | null) => {
    for (const [id, c] of cards) c.setAttribute('aria-current', String(id === l.id));
    if (l.status === 'covered') map.setView({ cx: l.canvas[0], cy: l.canvas[1], zoom: l.zoom }, { animate: true });
    else {
      map.setView({ cx: l.canvas[0], cy: l.canvas[1], zoom: PENDING_ZOOM }, { animate: true });
      map.toast(`${l.name} is coming soon - this area is not illustrated yet`);
    }
    showDetail(l, opener);
  };

  // ---------------------------------------------------------------- strip
  let collapsed = false;
  try { collapsed = localStorage.getItem(STRIP_KEY) === '1'; } catch { /* storage unavailable */ }
  const list = h('div', { class: 'strip-list', role: 'list' });
  for (const l of landmarks) {
    const covered = l.status === 'covered';
    const card = h('button', {
      class: `card${covered ? '' : ' pending'}`, type: 'button',
      'aria-label': `${l.name}, ${l.category}${covered ? '' : ', coming soon'}`,
      onclick: () => select(l, card),
    }, h('span', { class: 'card-badge', 'aria-hidden': 'true' }, l.short ?? l.name.slice(0, 3)),
       h('span', { class: 'card-text' }, h('span', { class: 'card-name' }, l.name), h('span', { class: 'card-cat' }, covered ? l.category : 'Coming soon')));
    cards.set(l.id, card);
    list.append(h('div', { role: 'listitem', class: 'strip-item' }, card));
  }
  const toggle = h('button', { class: 'strip-toggle', type: 'button', 'aria-controls': 'strip-list', 'aria-expanded': String(!collapsed) },
    h('span', {}, stripTitle), icon('chevron'));
  list.id = 'strip-list';
  const strip = h('section', { class: `strip panel-chrome${collapsed ? ' collapsed' : ''}`, 'aria-label': stripTitle }, toggle, list);
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    strip.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    try { localStorage.setItem(STRIP_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  });
  // vertical wheel scrolls the strip horizontally on desktop
  list.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { list.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });

  // ---------------------------------------------------------------- labels on the map
  const labelsRoot = document.getElementById('labels')!;
  const labels = landmarks.filter((l) => l.status === 'covered').map((l) => {
    const el = h('button', { class: 'map-label', type: 'button', tabindex: -1, 'aria-hidden': 'true', onclick: () => select(l, cards.get(l.id) ?? null) },
      h('span', { class: 'map-label-dot' }), l.short ?? l.name);
    el.title = l.name;
    el.dataset.id = l.id;
    labelsRoot.append(el);
    return { l, el };
  });
  let labelsOn = map.settings.labels;
  const placeLabels = () => {
    const v = map.getView();
    const show = labelsOn && v.zoom >= LABEL_MIN_ZOOM;
    labelsRoot.classList.toggle('hidden', !show);
    if (!show) return;
    const w = labelsRoot.clientWidth, hgt = labelsRoot.clientHeight;
    for (const { l, el } of labels) {
      const [x, y] = map.canvasToScreen(l.canvas[0], l.canvas[1]);
      const visible = x > -80 && y > -40 && x < w + 80 && y < hgt + 40;
      el.hidden = !visible;
      if (visible) el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  };
  map.on('viewchange', placeLabels);
  map.onSettings((s) => { labelsOn = s.labels; placeLabels(); });
  new ResizeObserver(placeLabels).observe(labelsRoot);
  placeLabels();

  return { strip, select, cards };
}
