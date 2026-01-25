/**
 * Result interface containing the WebGL2 compatible buffers.
 */
export interface SphereGeometry {
  vertices: Float32Array; 
  indices: Uint32Array; 
  vertexCount: number;
  indexCount: number;
}

export class QuadSphereGenerator {
  
  /**
   * Generates a High-Res Quad Sphere with fixed UV seams.
   */
  public static create(radius: number, subdivisions: number): SphereGeometry {
    const vertexCountPerFace = (subdivisions + 1) * (subdivisions + 1);
    const totalVertices = vertexCountPerFace * 6;
    const vertexStride = 8; 
    
    const indexCountPerFace = subdivisions * subdivisions * 6;
    const totalIndices = indexCountPerFace * 6;

    const vertices = new Float32Array(totalVertices * vertexStride);
    const indices = new Uint32Array(totalIndices);

    let vIndex = 0; 
    let iIndex = 0; 
    let vertexOffset = 0; 

    // Define the 6 faces of the cube.
    // We explicitly mark faces that cross the texture seam (the International Date Line).
    // The seam is located at longitude 180 (x < 0, z = 0).
    const faces = [
      { origin: [1, 1, 1], right: [0, 0, -1], up: [0, -1, 0], checkSeam: false },   // +X (Right)
      { origin: [-1, 1, -1], right: [0, 0, 1], up: [0, -1, 0], checkSeam: true },   // -X (Left)  <-- Crosses Seam
      { origin: [-1, 1, 1], right: [1, 0, 0], up: [0, 0, -1], checkSeam: true },    // +Y (Top)   <-- Crosses Seam
      { origin: [-1, -1, -1], right: [1, 0, 0], up: [0, 0, 1], checkSeam: true },   // -Y (Bottom)<-- Crosses Seam
      { origin: [-1, 1, 1], right: [0, -1, 0], up: [1, 0, 0], checkSeam: false },   // +Z (Front)
      { origin: [1, 1, -1], right: [0, -1, 0], up: [-1, 0, 0], checkSeam: false },  // -Z (Back)
    ];

    for (const face of faces) {
      const faceStartVertex = vertexOffset;

      // 1. Generate Vertices
      for (let j = 0; j <= subdivisions; j++) {
        for (let i = 0; i <= subdivisions; i++) {
          
          const uStep = i / subdivisions;
          const vStep = j / subdivisions;

          const px = face.origin[0] + (face.right[0] * uStep * 2.0) + (face.up[0] * vStep * 2.0);
          const py = face.origin[1] + (face.right[1] * uStep * 2.0) + (face.up[1] * vStep * 2.0);
          const pz = face.origin[2] + (face.right[2] * uStep * 2.0) + (face.up[2] * vStep * 2.0);

          const len = Math.sqrt(px * px + py * py + pz * pz);
          const nx = px / len;
          const ny = py / len;
          const nz = pz / len;

          const x = nx * radius;
          const y = ny * radius;
          const z = nz * radius;

          // Standard Equirectangular projection
          let u = 0.5 + (Math.atan2(nz, nx) / (2 * Math.PI));
          u = 1.0 - u; 
          const v = 0.5 - (Math.asin(ny) / Math.PI);

          // --- FIX ---
          // If this face is flagged as crossing the seam, we check for vertices 
          // that have wrapped around to ~0.0 (the start of the texture).
          // We shift them to ~1.0 (the end of the texture) so they connect 
          // smoothly with their neighbors at ~0.9.
          if (face.checkSeam && u < 0.25) {
            u += 1.0;
          }
          
          vertices[vIndex++] = x;
          vertices[vIndex++] = y;
          vertices[vIndex++] = z;
          vertices[vIndex++] = u;
          vertices[vIndex++] = v;
          vertices[vIndex++] = nx;
          vertices[vIndex++] = ny;
          vertices[vIndex++] = nz;
        }
      }

      // 2. Generate Indices
      for (let j = 0; j < subdivisions; j++) {
        for (let i = 0; i < subdivisions; i++) {
          const row1 = faceStartVertex + (j * (subdivisions + 1));
          const row2 = faceStartVertex + ((j + 1) * (subdivisions + 1));

          const a = row1 + i;
          const b = row1 + i + 1;
          const c = row2 + i;
          const d = row2 + i + 1;

          indices[iIndex++] = a;
          indices[iIndex++] = c;
          indices[iIndex++] = b;

          indices[iIndex++] = b;
          indices[iIndex++] = c;
          indices[iIndex++] = d;
        }
      }

      vertexOffset += vertexCountPerFace;
    }

    return {
      vertices,
      indices,
      vertexCount: totalVertices,
      indexCount: totalIndices,
    };
  }
}