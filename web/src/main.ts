// Tiny Waterloo entry point: wires MapView (map/), effects compositor (fx/), actor overlay (depth/) and UI.
import './style.css';
// portfolio styles load with the page, not with the game's lazy chunk: the title screen and the hidden map-app chrome
// (search bar, landmark strip) must be styled at first paint, or the generic map UI flashes up before the title
import './portfolio/game.css';
import { createMap } from './map/MapView';
import { createUI } from './map/ui';
import { ADAPTIVE_MAX_LEVEL, createEffects } from './fx/Effects';
import { createAdaptiveQuality } from './fx/adaptive';
import { createActor } from './depth/Actor';
import type { Landmark } from './types';

async function boot() {
  const stage = document.getElementById('stage')!;
  const map = await createMap(stage);
  const fx = createEffects(map);
  stage.insertBefore(fx.canvas, document.getElementById('labels'));
  const actor = createActor(map);
  stage.insertBefore(actor.element, document.getElementById('labels'));
  // during a goose flight, lower the effects if the GPU falls behind (Quality 'auto' only; never stored)
  const adaptive = createAdaptiveQuality(map, fx, () => actor.active, ADAPTIVE_MAX_LEVEL);
  // Portfolio game (web/portfolio.html, or ?portfolio=1): the stops of Arjun Behl's portfolio replace the landmark list
  const portfolio = document.body.hasAttribute('data-portfolio') || new URLSearchParams(location.search).has('portfolio');
  if (portfolio) { document.getElementById('app')!.classList.add('portfolio-mode', 'title-open'); }
  // only landmarks on the illustrated tiles (the map no longer shows unpainted areas)
  const landmarks: Landmark[] = (await fetch(portfolio ? 'data/portfolio_stops.json' : 'data/landmarks.json').then((r) => (r.ok ? r.json() : [])).catch(() => []) as Landmark[])
    .filter((l) => l.status === 'covered');
  createUI(map, { fx, actor, landmarks, ui: document.getElementById('ui')!, attribution: document.getElementById('attribution')! });
  if (portfolio) (await import('./portfolio/game')).startPortfolioGame(map, actor, landmarks.filter((l) => l.portfolio), document.getElementById('ui')!);
  (window as any).__tinyWaterloo = { map, fx, actor, adaptive, landmarks, perf: () => map.perf() }; // test hook (read-only use in tests/)
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('ui');
  if (el) el.innerHTML = `<div class="fatal" role="alert">Tiny Waterloo failed to start: ${String(e?.message || e)}</div>`;
});
