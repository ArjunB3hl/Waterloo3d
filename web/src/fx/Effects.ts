// STUB - replaced by fx implementation.
import type { MapAPI, EffectsModule } from '../types';
export function createEffects(_map: MapAPI): EffectsModule {
  const canvas = document.createElement('canvas');
  return { canvas, setEnabled() {}, setFocus() {}, render() {}, dispose() {} };
}
