// WGS84 helpers shared by the Google 3D Tiles fetcher (Node) and renderer (browser).
// Local frame: tangent plane at the map origin (east, north, up). Map x/y use a transverse Mercator centred on the
// same origin; within the city (< 8 km) the horizontal difference between the two is < 1 cm, but the vertical drop of
// the ellipsoid below the tangent plane (d^2 / 2R, ~2 m at 5 km) is NOT negligible and is corrected per vertex.
export const A = 6378137.0, F = 1 / 298.257223563, E2 = F * (2 - F);
export const R_MEAN = 6371000.0;

export function ecefFromLonLatH(lonDeg, latDeg, h) {
  const lon = lonDeg * Math.PI / 180, lat = latDeg * Math.PI / 180;
  const N = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  return [(N + h) * Math.cos(lat) * Math.cos(lon), (N + h) * Math.cos(lat) * Math.sin(lon), (N * (1 - E2) + h) * Math.sin(lat)];
}

export function makeLocalFrame(latDeg, lonDeg) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
  const O = ecefFromLonLatH(lonDeg, latDeg, 0);
  const E = [-Math.sin(lon), Math.cos(lon), 0];
  const N = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
  const U = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  return {
    O, E, N, U,
    /** ECEF -> local [x east, y north, h ellipsoidal height] with curvature correction. */
    ecefToLocal(p) {
      const d = [p[0] - O[0], p[1] - O[1], p[2] - O[2]];
      const x = d[0] * E[0] + d[1] * E[1] + d[2] * E[2], y = d[0] * N[0] + d[1] * N[1] + d[2] * N[2];
      const u = d[0] * U[0] + d[1] * U[1] + d[2] * U[2];
      return [x, y, u + (x * x + y * y) / (2 * R_MEAN)];
    },
    /** local [x, y, h ellipsoidal] -> ECEF (inverse of the above, same approximation). */
    localToEcef([x, y, h]) {
      const u = h - (x * x + y * y) / (2 * R_MEAN);
      return [O[0] + x * E[0] + y * N[0] + u * U[0], O[1] + x * E[1] + y * N[1] + u * U[1], O[2] + x * E[2] + y * N[2] + u * U[2]];
    },
  };
}
