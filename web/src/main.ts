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
  const landmarks: Landmark[] = await fetch('data/landmarks.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  createUI(map, { fx, actor, landmarks, ui: document.getElementById('ui')!, attribution: document.getElementById('attribution')! });
  (window as any).__tinyWaterloo = { map, fx, actor, landmarks, perf: () => map.perf() }; // test hook (read-only use in tests/)
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('ui');
  if (el) el.innerHTML = `<div class="fatal" role="alert">Tiny Waterloo failed to start: ${String(e?.message || e)}</div>`;
});
