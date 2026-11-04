// STUB - replaced by depth implementation.
import type { MapAPI, ActorModule } from '../types';
export function createActor(_map: MapAPI): ActorModule {
  const element = document.createElement('div');
  return { element, async start() {}, stop() {}, active: false, render() {}, dispose() {} };
}
