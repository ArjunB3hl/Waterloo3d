// Goose dimensions (real size, metres) without the three.js model, so the flight model and the always-loaded actor
// shell can use them while the renderers (and three.js) load lazily on the first flight. Re-exported by goose.ts.

export const GOOSE_WINGSPAN_M = 1.6;
/** Recommended uniform scale so the goose reads at map scale (actor may pick 4-6). */
export const GOOSE_DISPLAY_SCALE = 5;
/** Radius of a sphere around the origin that encloses the body (wings excluded), real size, for collision sweeps. */
export const GOOSE_BODY_RADIUS_M = 0.4;
