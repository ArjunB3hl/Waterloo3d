// Building info card: opened by clicking / tapping a building label on the map or picking a building in search.
// Same panel chrome as the landmark card (role=dialog, Escape or the close button closes, focus returns).
import type { ActorModule, BuildingLabel, MapAPI } from '../../types';
import { h, icon } from './dom';
import type { Panels } from './panels';

/** Zoom used when jumping to a building: close enough to read "CODE · Full name" labels. */
const BUILDING_ZOOM = 1.2;

const GROUP_LABEL: Record<BuildingLabel['group'], string> = {
  campus: 'Campus building', civic: 'Civic', commercial: 'Commercial', residential: 'Residential', other: 'Building',
};
const isApprox = (s: string) => /approx|estimate|default/i.test(s);
const humanize = (cls: string) => cls.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** "w43250626@28" -> https://www.openstreetmap.org/way/43250626 (node / way / relation). */
export function osmUrl(osm: string): { url: string; label: string } | null {
  const m = /^([nwr])(\d+)/.exec(osm);
  if (!m) return null;
  const type = { n: 'node', w: 'way', r: 'relation' }[m[1] as 'n' | 'w' | 'r'];
  return { url: `https://www.openstreetmap.org/${type}/${m[2]}`, label: `OpenStreetMap ${type} ${m[2]}` };
}

export function createBuildingCard(map: MapAPI, panels: Panels, actor: ActorModule, openLandmark: (id: string) => boolean) {
  const detail = panels.create('building-panel', 'Building');

  const show = (l: BuildingLabel, opener: HTMLElement | null) => {
    detail.title.textContent = l.name;
    const osm = osmUrl(l.osm);
    const merged = (l.osm_all?.length ?? 0) > 1;
    detail.body.replaceChildren(
      h('p', { class: 'chips' },
        l.short ? h('span', { class: 'chip code' }, l.short) : null,
        h('span', { class: 'chip' }, GROUP_LABEL[l.group]),
        l.cls && l.cls !== 'building' ? h('span', { class: 'chip' }, humanize(l.cls)) : null),
      ...(l.campus ? [h('p', { class: 'muted' }, `On the ${l.campus} campus`)] : []),
      h('dl', { class: 'meta' },
        ...(l.short ? [h('dt', {}, 'Code'), h('dd', {}, l.short, ' ', h('span', { class: 'muted' }, '(curated - verify on uwaterloo.ca/map)'))] : []),
        ...(l.alt?.length ? [h('dt', {}, 'Also mapped as'), h('dd', {}, l.alt.join(', '))] : []),
        h('dt', {}, 'Height'), h('dd', {}, `${Math.round(l.height_m)} m - ${l.height_source}`,
          isApprox(l.height_source) ? h('span', { class: 'chip warn', title: 'Height is approximated, not surveyed' }, 'Approximate') : null),
        h('dt', {}, 'Footprint'), h('dd', {}, `${l.area_m2.toLocaleString('en-CA')} m²${merged ? ` (${l.osm_all!.length} mapped buildings)` : ''}`),
        h('dt', {}, 'Geometry'), h('dd', {}, `${l.source}, ${l.osm}`)),
      h('h3', {}, 'Sources'),
      h('ul', { class: 'sources' },
        osm ? h('li', {}, h('a', { href: osm.url, target: '_blank', rel: 'noopener noreferrer' }, `View on ${osm.label}`, icon('external'))) : null,
        l.short ? h('li', {}, h('a', { href: 'https://uwaterloo.ca/map/', target: '_blank', rel: 'noopener noreferrer' }, 'University of Waterloo campus map', icon('external'))) : null,
        h('li', {}, h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener noreferrer' }, 'Map data © OpenStreetMap contributors (ODbL)', icon('external')))),
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: () => { panels.close(); actor.start({ cx: l.canvas[0], cy: l.canvas[1] }).catch((e) => map.toast(`Could not start flight: ${e?.message ?? e}`)); },
      }, icon('bird'), 'Fly from here'),
    );
    panels.open(detail.el, opener);
  };

  /** Animate to the building and open its card (a building with a landmark card opens that card instead). */
  const select = (l: BuildingLabel, opener: HTMLElement | null = null) => {
    if (l.landmark_id && openLandmark(l.landmark_id)) return;
    map.setView({ cx: l.canvas[0], cy: l.canvas[1], zoom: Math.max(map.getView().zoom, BUILDING_ZOOM) }, { animate: true });
    show(l, opener);
  };

  return { select, panel: detail.el };
}
