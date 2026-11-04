// Goose dimensions (real size, metres) without the three.js model, so the flight model and the always-loaded actor
// shell can use them while the renderers (and three.js) load lazily on the first flight. Re-exported by goose.ts.

export const GOOSE_WINGSPAN_M = 1.6;
/** Uniform display scale so the goose reads at map scale (real goose ~5 artwork px long). 7x keeps it ~35 CSS px
 *  wide at zoom 1.6; the collision sphere scales with it (FLIGHT.radius = 0.4 m * 7 = 2.8 m). */
export const GOOSE_DISPLAY_SCALE = 7;
/** Radius of a sphere around the origin that encloses the body (wings excluded), real size, for collision sweeps. */
export const GOOSE_BODY_RADIUS_M = 0.4;
