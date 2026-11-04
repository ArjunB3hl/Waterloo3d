// Performance HUD (top-left): numbers from map.perf(), refreshed four times a second while visible.
import type { MapAPI } from '../../types';
import { h } from './dom';

export function createPerfHud(map: MapAPI): { el: HTMLElement; setVisible(v: boolean): void } {
  const pre = h('pre', {});
  const el = h('div', { class: 'perf-hud panel-chrome', role: 'region', 'aria-live': 'off', 'aria-label': 'Performance statistics', hidden: true }, pre);
  let timer = 0;
  const refresh = () => {
    const p = map.perf();
    pre.textContent = [
      `fps        ${p.fps}`,
      `frame p95  ${p.frameP95Ms} ms`,
      `draw p95   ${p.drawP95Ms} ms`,
      `bitmaps    ${p.bitmaps}  ${p.bitmapMB} / ${p.budgetMB} MB`,
      `heights    ${p.heightTiles}`,
      `requests   ${p.inflight} live  ${p.queued} queued  ${p.deferred ?? 0} deferred  ${p.failed} failed`,
      `tiles      ${p.tilesDrawn} drawn`,
      `heap       ${p.heapMB === null ? 'n/a' : `${p.heapMB} MB`}`,
      `dpr        ${p.dpr}   ${p.viewport[0]}x${p.viewport[1]}`,
    ].join('\n');
  };
  return {
    el,
    setVisible(v) {
      el.hidden = !v;
      clearInterval(timer);
      if (v) { refresh(); timer = window.setInterval(refresh, 250); }
    },
  };
}
