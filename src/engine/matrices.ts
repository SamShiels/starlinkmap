export function makeViewMatrix(position: { x: number; y: number; z: number }): Float32Array {
  const m = new Float32Array(16);
  m.set([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    position.x, position.y, position.z, 1,
  ]);
  return m;
}

export function makePerspectiveMatrix(
  out: Float32Array,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
) {
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);

  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;

  out[12] = 0;
  out[13] = 0;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
}

export function makeLookAtMatrix(
  out: Float32Array,
  eye: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
) {
  const f = {
    x: target.x - eye.x,
    y: target.y - eye.y,
    z: target.z - eye.z,
  };
  const len = Math.sqrt(f.x * f.x + f.y * f.y + f.z * f.z);
  f.x /= len;
  f.y /= len;
  f.z /= len;

  const r = {
    x: f.y * up.z - f.z * up.y,
    y: f.z * up.x - f.x * up.z,
    z: f.x * up.y - f.y * up.x,
  };
  const rlen = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
  r.x /= rlen;
  r.y /= rlen;
  r.z /= rlen;

  const u = {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x,
  };

  out[0] = r.x;
  out[1] = u.x;
  out[2] = -f.x;
  out[3] = 0;

  out[4] = r.y;
  out[5] = u.y;
  out[6] = -f.y;
  out[7] = 0;

  out[8] = r.z;
  out[9] = u.z;
  out[10] = -f.z;
  out[11] = 0;

  out[12] = -(r.x * eye.x + r.y * eye.y + r.z * eye.z);
  out[13] = -(u.x * eye.x + u.y * eye.y + u.z * eye.z);
  out[14] = f.x * eye.x + f.y * eye.y + f.z * eye.z;
  out[15] = 1;
}