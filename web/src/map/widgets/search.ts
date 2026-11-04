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
}

interface SearchFile { entries: { n: string; k: string; c: [number, number]; t: string }[] }

const MAX_RESULTS = 8;
const KIND_LABEL: Record<string, string> = { street: 'Street', trail: 'Trail', rail: 'Railway', place: 'Place', water: 'Water' };

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
  const base: (SearchHit & { key: string; alt: string })[] = landmarks.map((l) => ({
    name: l.name, kind: 'landmark', detail: l.category, canvas: l.canvas, pending: l.status !== 'covered', landmark: l,
    key: norm(l.name), alt: norm(`${l.short ?? ''} ${l.category}`),
  }));
  let index = base;
  let loading: Promise<void> | null = null;
  const ensureIndex = () => loading ??= fetch('data/search.json')
    .then((r) => (r.ok ? (r.json() as Promise<SearchFile>) : { entries: [] }))
    .then((f) => {
      const known = new Set(base.map((b) => b.key));
      index = base.concat(f.entries.filter((e) => !known.has(norm(e.n))).map((e) => ({
        name: e.n, kind: e.k, detail: KIND_LABEL[e.k] ?? e.k, canvas: e.c, pending: !(e.t in tiles), key: norm(e.n), alt: '',
      })));
      if (input.value) update();
    })
    .catch(() => { /* landmarks still searchable */ });

  const input = h('input', {
    id: 'search-input', type: 'search', placeholder: 'Search streets and landmarks', autocomplete: 'off', spellcheck: 'false',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'search-results', 'aria-label': 'Search streets and landmarks',
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
      if (s < 0 && e.alt) s = score(e.alt, q) >= 0 ? 3 : -1;
      if (s >= 0) scored.push({ hit: e, s });
    }
    scored.sort((a, b) => a.s - b.s || +a.hit.pending - +b.hit.pending || +(b.hit.kind === 'landmark') - +(a.hit.kind === 'landmark')
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
