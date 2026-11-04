// Lazy entry for everything that needs three.js (the goose model, both WebGL renderers). Actor.ts imports it with a
// dynamic import on the first flight, so the map's initial bundle does not carry three.js.
import type { Frame } from '../frame';
import { ActorRenderer } from './actorRenderer';
import type { HeightWindow } from './heightWindow';
import { ShadowRenderer } from './shadowRenderer';

export interface Renderers { actor: ActorRenderer; shadow: ShadowRenderer }

/** Both renderers on their canvases; throws (after cleaning up) when WebGL 2 is unavailable. */
export function createRenderers(actorCanvas: HTMLCanvasElement, shadowCanvas: HTMLCanvasElement, frame: Frame, heights: HeightWindow,
  scale: number, shadowRadius: number): Renderers {
  let actor: ActorRenderer | null = null;
  try {
    actor = new ActorRenderer(actorCanvas, frame, heights, scale);
    return { actor, shadow: new ShadowRenderer(shadowCanvas, frame, heights, actor.goose, shadowRadius) };
  } catch (e) {
    actor?.dispose();
    throw new Error(`WebGL 2 is not available (${(e as Error)?.message ?? e})`);
  }
}
