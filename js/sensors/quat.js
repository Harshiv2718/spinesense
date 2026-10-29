// Minimal quaternion and 3-vector maths. Quaternions are [w, x, y, z].

export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;

export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
export function norm3(a) {
  const n = len3(a);
  return n ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 0];
}
/** Angle between two vectors, in degrees. */
export const angle3 = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot3(norm3(a), norm3(b))))));

export function qmul(a, b) {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}
export const qconj = ([w, x, y, z]) => [w, -x, -y, -z];
export function qnorm(q) {
  const n = Math.hypot(...q);
  return n ? q.map((c) => c / n) : [1, 0, 0, 0];
}
export function qfromAxisAngle(axis, angleRad) {
  const [x, y, z] = norm3(axis);
  const s = Math.sin(angleRad / 2);
  return [Math.cos(angleRad / 2), x * s, y * s, z * s];
}
/** Rotate vector v by quaternion q (v' = q v q*). */
export function qrotate(q, v) {
  const r = qmul(qmul(q, [0, v[0], v[1], v[2]]), qconj(q));
  return [r[1], r[2], r[3]];
}

/**
 * Quaternion (device -> earth, Z up) from a browser deviceorientation event, per the W3C
 * DeviceOrientation spec (intrinsic Z-X'-Y'' rotations: alpha, beta, gamma in degrees).
 * The resulting "up" direction is well defined even near beta = ±90°, where alpha and gamma aren't.
 */
export function quatFromDeviceOrientation(alpha, beta, gamma) {
  const x = rad(beta ?? 0) / 2;
  const y = rad(gamma ?? 0) / 2;
  const z = rad(alpha ?? 0) / 2;
  const [cX, cY, cZ, sX, sY, sZ] = [Math.cos(x), Math.cos(y), Math.cos(z), Math.sin(x), Math.sin(y), Math.sin(z)];
  return [
    cX * cY * cZ - sX * sY * sZ,
    sX * cY * cZ - cX * sY * sZ,
    cX * sY * cZ + sX * cY * sZ,
    cX * cY * sZ + sX * sY * cZ,
  ];
}
