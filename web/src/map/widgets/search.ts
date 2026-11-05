// Search field (ARIA combobox) over landmarks and street / place names (data/search.json, loaded on first use).
import type { Landmark, MapAPI } from '../../types';
import { h, icon } from './dom';

export interface SearchHit {
  name: string;
  kind: string;                       // 'landmark' | street | trail | rail | place | water
  detail: string;                     // secondary text
  canvas: [number, number];
  pending: boolean;
  landmark?: Landmark;
  buildingId?: string;                // labels.json id (kind 'building')
}

/** n name, k kind, c canvas point, t tile; buildings: id (labels.json), s curated UW code, a alternative names. */
interface SearchFile { entries: { n: string; k: string; c: [number, number]; t: string; id?: string; s?: string; a?: string[] }[] }
type Entry = SearchHit & { key: string; alt: string[]; codes?: string[] };

const MAX_RESULTS = 8;
const KIND_LABEL: Record<string, string> = { street: 'Street', trail: 'Trail', rail: 'Railway', place: 'Place', water: 'Water', building: 'Building' };
const GROUP_LABEL: Record<string, string> = { campus: 'Campus building', civic: 'Civic building', commercial: 'Commercial building', residential: 'Residential building' };
/** Equal scores: buildings and landmarks before streets / trails / places ('Hagey' -> Hagey Hall, then Hagey Blvd). */
const KIND_RANK: Record<string, number> = { landmark: 0, building: 1 };
const kindRank = (k: string) => KIND_RANK[k] ?? 2;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();

/** 0 exact, 1 prefix, 2 word prefix, 3 substring, -1 no match. */
function score(name: string, q: string): number {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(' ' + q)) return 2;
  return name.includes(q) ? 3 : -1;
}

export function createSearch(map: MapAPI, landmarks: Landmark[], onPick: (hit: SearchHit) => void): { el: HTMLElement; focus(): void; close(): void } {
  const tiles = map.manifest.tiles;
  const base: Entry[] = landmarks.map((l) => ({
    name: l.name, kind: 'landmark', detail: l.category, canvas: l.canvas, pending: l.status !== 'covered', landmark: l,
    key: norm(l.name), alt: [norm(l.short ?? ''), norm(l.category)].filter(Boolean), codes: l.short ? [norm(l.short)] : [],
  }));
  let index = base;
  let loading: Promise<void> | null = null;
  const ensureIndex = () => loading ??= fetch('data/search.json')
    .then((r) => (r.ok ? (r.json() as Promise<SearchFile>) : { entries: [] }))
    .then(async (f) => {
      await map.labels.ready;
      const known = new Map(base.map((b) => [b.key, b]));
      const extra: Entry[] = [];
      for (const e of f.entries) {
        const alts = e.a ?? [];
        const lm = known.get(norm(e.n));
        if (lm) {   // a landmark: keep its entry, but let the building's curated code and OSM alternative names find it too
          lm.alt = [...lm.alt, ...alts.map(norm)];
          if (e.s) lm.codes = [...(lm.codes ?? []), norm(e.s)];
          continue;
        }
        const label = e.id ? map.labels.byId(e.id) : undefined;
        // only curated UW codes are codes; OSM alternative names that look like one (MH, WLU, YNCU) stay alternative names
        const code = e.s ?? label?.short ?? undefined;
        const detail = e.k === 'building'
          ? [code, GROUP_LABEL[label?.group ?? ''] ?? 'Building'].filter(Boolean).join(' · ')
          : KIND_LABEL[e.k] ?? e.k;
        extra.push({
          name: e.n, kind: e.k, detail, canvas: e.c, pending: !(e.t in tiles), key: norm(e.n),
          alt: alts.map(norm), codes: code ? [norm(code)] : [], buildingId: e.k === 'building' ? e.id : undefined,
        });
      }
      index = base.concat(extra);
      if (input.value) update();
    })
    .catch(() => { /* landmarks still searchable */ });

  const input = h('input', {
    id: 'search-input', type: 'search', placeholder: 'Search buildings, streets, landmarks', autocomplete: 'off', spellcheck: 'false',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'search-results', 'aria-label': 'Search buildings, streets and landmarks',
  });
  const list = h('ul', { id: 'search-results', role: 'listbox', 'aria-label': 'Search results', hidden: true });
  const el = h('div', { class: 'search', role: 'search' }, h('span', { class: 'search-icon' }, icon('search')), input, h('kbd', { class: 'search-key', 'aria-hidden': 'true' }, '/'), list);

  let hits: SearchHit[] = [];
  let active = -1;

  const render = () => {
    list.replaceChildren(...hits.map((hit, k) => h('li', {
      id: `search-opt-${k}`, role: 'option', 'aria-selected': k === active ? 'true' : 'false', class: hit.pending ? 'pending' : '',
      onpointerdown: (e: Event) => e.preventDefault(),     // keep focus in the field
      onclick: () => pick(k),
    }, h('span', { class: 'hit-name' }, hit.name),
       h('span', { class: 'hit-detail' }, hit.pending ? `${hit.detail} - coming soon` : hit.detail))));
    if (!hits.length && input.value.trim()) list.append(h('li', { class: 'empty', role: 'presentation' }, 'No matches'));
    const open = !!input.value.trim();
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open && hits.length > 0));
    if (active >= 0) input.setAttribute('aria-activedescendant', `search-opt-${active}`); else input.removeAttribute('aria-activedescendant');
  };

  const update = () => {
    const q = norm(input.value);
    active = -1;
    if (!q) { hits = []; render(); return; }
    const scored: { hit: SearchHit; s: number }[] = [];
    for (const e of index) {
      let s = score(e.key, q);
      if (e.codes?.includes(q)) s = 0;
      else {
        // alternative names ("Hagey Hall", a landmark's category) rank just below an exact name match
        for (const a of e.alt) { const x = score(a, q); if (x >= 0) s = s < 0 ? Math.max(1, x) : Math.min(s, Math.max(1, x)); }
      }
      if (s >= 0) scored.push({ hit: e, s });
    }
    scored.sort((a, b) => a.s - b.s || +a.hit.pending - +b.hit.pending || kindRank(a.hit.kind) - kindRank(b.hit.kind)
      || a.hit.name.length - b.hit.name.length || a.hit.name.localeCompare(b.hit.name));
    hits = scored.slice(0, MAX_RESULTS).map((x) => x.hit);
    active = hits.length ? 0 : -1;
    render();
  };

  const close = () => { hits = []; active = -1; list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };

  const pick = (k: number) => {
    const hit = hits[k];
    if (!hit) return;
    input.value = hit.name;
    close();
    input.blur();
    onPick(hit);
  };

  input.addEventListener('focus', () => { void ensureIndex(); if (input.value) update(); });
  input.addEventListener('input', update);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      render();
      document.getElementById(`search-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(Math.max(0, active));
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      if (input.value) { input.value = ''; close(); } else input.blur();
    }
  });

  return { el, focus: () => { input.focus(); input.select(); }, close };
}
