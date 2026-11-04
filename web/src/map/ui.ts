// Map UI: search (top), controls + compass (right), minimap (bottom-left), landmark strip and "Fly as a goose"
// (bottom centre), settings / about / landmark panels, performance HUD and the attribution footer.
// Talks to the rest of the app only through MapAPI and the effects / actor module interfaces.
import type { ActorModule, EffectsModule, Landmark, MapAPI, Settings } from '../types';
import { formatHash, homeView } from './view';
import { h, icon, isTyping } from './widgets/dom';
import { createLandmarks } from './widgets/landmarks';
import { createMinimap } from './widgets/minimap';
import { buildAbout, buildSettings, Panels } from './widgets/panels';
import { createPerfHud } from './widgets/perfHud';
import { createSearch, type SearchHit } from './widgets/search';

const BUTTON_ZOOM = 1.6;
const STREET_ZOOM = 1.0;
const PENDING_ZOOM = 0.3;
const MARKER_MS = 8000;

export function createUI(map: MapAPI, deps: { fx: EffectsModule; actor: ActorModule; landmarks: Landmark[]; ui: HTMLElement; attribution: HTMLElement }): void {
  const { fx, actor, landmarks, ui, attribution } = deps;
  const app = document.getElementById('app') ?? document.body;
  const stage = document.getElementById('stage')!;
  const panels = new Panels(ui);

  // ---------------------------------------------------------------- search + result marker
  const marker = h('div', { class: 'search-marker', hidden: true, 'aria-hidden': 'true' }, icon('pin'), h('span', {}));
  document.getElementById('labels')!.append(marker);
  let markerAt: [number, number] | null = null;
  let markerTimer = 0;
  const placeMarker = () => {
    if (!markerAt) return;
    const [x, y] = map.canvasToScreen(markerAt[0], markerAt[1]);
    marker.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const showMarker = (hit: SearchHit) => {
    markerAt = hit.canvas;
    marker.querySelector('span')!.textContent = hit.name;
    marker.hidden = false;
    placeMarker();
    clearTimeout(markerTimer);
    markerTimer = window.setTimeout(() => { marker.hidden = true; markerAt = null; }, MARKER_MS);
  };
  map.on('viewchange', placeMarker);

  const lm = createLandmarks(map, landmarks, actor, panels);
  const search = createSearch(map, landmarks, (hit) => {
    if (hit.landmark) { lm.select(hit.landmark, null); return; }
    const zoom = hit.pending ? PENDING_ZOOM : Math.max(STREET_ZOOM, map.getView().zoom);
    map.setView({ cx: hit.canvas[0], cy: hit.canvas[1], zoom }, { animate: true });
    showMarker(hit);
    if (hit.pending) map.toast(`${hit.name} is in an area that is coming soon`);
    stage.focus({ preventScroll: true });
  });

  // ---------------------------------------------------------------- right-edge controls
  const settingsPanel = panels.create('settings-panel', 'Settings');
  buildSettings(settingsPanel.body, map);
  const aboutPanel = panels.create('about-panel', 'About Tiny Waterloo');
  buildAbout(aboutPanel.body, map);

  const zoomBy = (f: number) => map.setView({ zoom: map.getView().zoom * f }, { animate: true });
  const button = (name: string, label: string, onclick: (e: Event) => void, extra: Record<string, string> = {}) =>
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick, ...extra }, icon(name));
  const share = async () => {
    // built from the live view (the address bar catches up once the camera rests)
    const url = `${location.origin}${location.pathname}${location.search}${formatHash(map.getView())}`;
    try { await navigator.clipboard.writeText(url); map.toast('Link to this view copied'); }
    catch { map.toast(`Copy this link: ${url}`); }
  };
  const settingsBtn = button('settings', 'Settings', () => panels.toggle(settingsPanel.el, settingsBtn), { 'aria-controls': 'settings-panel', 'aria-expanded': 'false' });
  const aboutBtn = button('info', 'About and data sources', () => panels.toggle(aboutPanel.el, aboutBtn), { 'aria-controls': 'about-panel', 'aria-expanded': 'false' });
  const controls = h('nav', { class: 'controls', 'aria-label': 'Map controls' },
    compass(map),
    h('div', { class: 'btn-group map-only' },
      button('plus', 'Zoom in', () => zoomBy(BUTTON_ZOOM)),
      button('minus', 'Zoom out', () => zoomBy(1 / BUTTON_ZOOM))),
    h('div', { class: 'btn-group' },
      h('span', { class: 'map-only' }, button('home', 'Home view: University of Waterloo campus', () =>
        map.setView(homeView(map.manifest, stage.clientWidth, stage.clientHeight), { animate: true }))),
      button('share', 'Copy link to this view', share),
      settingsBtn, aboutBtn));

  // ---------------------------------------------------------------- minimap, bottom bar, HUD
  const minimap = createMinimap(map);
  const flyBtn = h('button', { class: 'btn primary fly-btn', type: 'button', 'aria-label': 'Fly as a goose' }, icon('bird'), 'Fly as a goose');
  flyBtn.addEventListener('click', () => {
    panels.close();
    actor.start().then(syncActor, (e) => map.toast(`Could not start flight: ${e?.message ?? e}`));
    syncActor();
  });
  const perfHud = createPerfHud(map);

  ui.prepend(
    h('div', { class: 'top map-only' }, search.el),
    controls,
    h('div', { class: 'bottom-left' }, minimap.el),
    h('div', { class: 'bottom map-only' }, flyBtn, lm.strip),
    perfHud.el,
  );

  attribution.replaceChildren(
    h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener noreferrer' }, '© OpenStreetMap contributors'),
    ' · ', h('a', { href: 'https://overturemaps.org', target: '_blank', rel: 'noopener noreferrer' }, 'Overture Maps'),
    ' · Terrain: Mapzen/AWS (CDEM) · ',
    h('button', { class: 'link-btn', type: 'button', onclick: () => panels.open(aboutPanel.el, aboutBtn) }, 'About'),
  );

  // ---------------------------------------------------------------- settings -> modules
  const applySettings = (s: Settings) => {
    fx.setEnabled({ life: s.life, tiltShift: s.tiltShift, strength: s.tiltStrength });
    minimap.setVisible(s.minimap);
    perfHud.setVisible(s.perfHud);
  };
  applySettings(map.settings);
  map.onSettings(applySettings);

  // tilt-shift focus follows the mouse on desktop; touch keeps it at the screen centre
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { const r = stage.getBoundingClientRect(); fx.setFocus(e.clientX - r.left, e.clientY - r.top); }
  });
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') fx.setFocus(null, null); });

  // ---------------------------------------------------------------- actor (goose) mode
  // The actor owns its HUD and Land control; while it flies, map-drag-only UI is hidden and pan input is locked.
  let actorActive = false;
  function syncActor() {
    if (!!actor.active === actorActive) return;
    actorActive = !!actor.active;
    app.classList.toggle('actor-active', actorActive);
    map.setInteractive(!actorActive);
    minimap.setEnabled(!actorActive);
    if (actorActive) { panels.close(); search.close(); }
    else flyBtn.focus({ preventScroll: true });
  }
  map.on('frame', syncActor);
  setInterval(syncActor, 400);   // also catch a stop that happens without a redraw

  // ---------------------------------------------------------------- global shortcuts
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (panels.close()) e.preventDefault();
      return;
    }
    if (isTyping(e)) return;
    if (e.key === '/' && !actorActive) { e.preventDefault(); search.focus(); }
    else if (e.key === 'm' || e.key === 'M') map.updateSettings({ minimap: !map.settings.minimap });
  });
}

/** Compass: needle toward the on-screen direction of geographic north (+y in local ENU) for the fixed camera. */
function compass(map: MapAPI): HTMLElement {
  const r = map.manifest.camera.right_enu, u = map.manifest.camera.up_enu;
  // screen vector of a step north on the ground: (dot(north, right), -dot(north, up)); angle clockwise from screen-up
  const deg = (Math.atan2(r[1], u[1]) * 180) / Math.PI;
  const side = deg < 0 ? 'left' : 'right';
  const el = h('div', { class: 'compass', role: 'img', 'aria-label': `Compass: north is ${Math.abs(Math.round(deg))} degrees ${side} of straight up` });
  el.innerHTML = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
    <g transform="rotate(${deg.toFixed(1)} 24 24)"><path d="M24 12 28.5 25h-9z" class="compass-n"/><path d="M24 38 19.5 25h9z" class="compass-s"/>
    <text x="24" y="10" text-anchor="middle" class="compass-label">N</text></g></svg>`;
  return el;
}
