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