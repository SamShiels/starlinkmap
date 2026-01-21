// Procedurally generates a quad-sphere (cube mapped to sphere) with interleaved
// position + UV data. Default subdivision of 3 yields a 4x4 grid per face.
type FaceBasis = {
  normal: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
};

const faces: FaceBasis[] = [
  { normal: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },   // +X
  { normal: [-1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // -X
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },  // +Y
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },  // -Y
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },   // +Z
  { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // -Z
];

function generateQuadSphere(subdivisions: number) {
  const resolution = subdivisions + 1;
  const vertsPerFace = resolution * resolution;
  const totalVerts = vertsPerFace * faces.length;

  const interleaved = new Float32Array(totalVerts * 5);
  const indices = new Uint16Array(subdivisions * subdivisions * 6 * faces.length);

  let vPtr = 0;
  let iPtr = 0;

  for (let f = 0; f < faces.length; f += 1) {
    const { normal, u, v } = faces[f];
    const faceVertexOffset = f * vertsPerFace;

    for (let y = 0; y < resolution; y += 1) {
      const vCoord = (y / subdivisions) * 2 - 1;
      for (let x = 0; x < resolution; x += 1) {
        const uCoord = (x / subdivisions) * 2 - 1;

        let px =
          normal[0] + u[0] * uCoord + v[0] * vCoord;
        let py =
          normal[1] + u[1] * uCoord + v[1] * vCoord;
        let pz =
          normal[2] + u[2] * uCoord + v[2] * vCoord;

        const len = Math.hypot(px, py, pz);
        px /= len;
        py /= len;
        pz /= len;

        interleaved[vPtr] = px;
        interleaved[vPtr + 1] = py;
        interleaved[vPtr + 2] = pz;
        interleaved[vPtr + 3] = x / subdivisions;
        interleaved[vPtr + 4] = y / subdivisions;
        vPtr += 5;
      }
    }

    for (let y = 0; y < subdivisions; y += 1) {
      for (let x = 0; x < subdivisions; x += 1) {
        const i0 = faceVertexOffset + y * resolution + x;
        const i1 = i0 + 1;
        const i2 = i0 + resolution;
        const i3 = i2 + 1;

        indices[iPtr++] = i0;
        indices[iPtr++] = i2;
        indices[iPtr++] = i1;

        indices[iPtr++] = i1;
        indices[iPtr++] = i2;
        indices[iPtr++] = i3;
      }
    }
  }

  return { interleaved, indices };
}

const quadSphere = generateQuadSphere(3);

export const quadSphereInterleaved = quadSphere.interleaved;
export const quadSphereIndices = quadSphere.indices;
