// Tiny Waterloo entry point: wires MapView (map/), effects compositor (fx/), actor overlay (depth/) and UI.
import './style.css';
import { createMap } from './map/MapView';
import { createUI } from './map/ui';
import { createEffects } from './fx/Effects';
import { createActor } from './depth/Actor';
import type { Landmark } from './types';

async function boot() {
  const stage = document.getElementById('stage')!;
  const map = await createMap(stage);
  const fx = createEffects(map);
  stage.insertBefore(fx.canvas, document.getElementById('labels'));
  const actor = createActor(map);
  stage.insertBefore(actor.element, document.getElementById('labels'));
  // Portfolio game (web/portfolio.html, or ?portfolio=1): the stops of Arjun Behl's portfolio replace the landmark list
  const portfolio = document.body.hasAttribute('data-portfolio') || new URLSearchParams(location.search).has('portfolio');
  if (portfolio) { document.getElementById('app')!.classList.add('portfolio-mode'); }
  // only landmarks on the illustrated tiles (the map no longer shows unpainted areas)
  const landmarks: Landmark[] = (await fetch(portfolio ? 'data/portfolio_stops.json' : 'data/landmarks.json').then((r) => (r.ok ? r.json() : [])).catch(() => []) as Landmark[])
    .filter((l) => l.status === 'covered');
  createUI(map, { fx, actor, landmarks, ui: document.getElementById('ui')!, attribution: document.getElementById('attribution')! });
  if (portfolio) (await import('./portfolio/game')).startPortfolioGame(map, actor, landmarks.filter((l) => l.portfolio), document.getElementById('ui')!);
  (window as any).__tinyWaterloo = { map, fx, actor, landmarks, perf: () => map.perf() }; // test hook (read-only use in tests/)
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('ui');
  if (el) el.innerHTML = `<div class="fatal" role="alert">Tiny Waterloo failed to start: ${String(e?.message || e)}</div>`;
});
