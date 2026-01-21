/**
 * Result interface containing the WebGL2 compatible buffers.
 */
export interface SphereGeometry {
  /** Interleaved Data: [x, y, z, u, v, nx, ny, nz, ...] */
  vertices: Float32Array; 
  /** Triangle draw indices */
  indices: Uint32Array; 
  /** Number of vertices (for draw calls) */
  vertexCount: number;
  /** Number of indices */
  indexCount: number;
}

export class QuadSphereGenerator {
  
  /**
   * Generates a High-Res Quad Sphere.
   * * @param radius - The radius of the sphere (e.g., 6371 for Earth scale, or 1.0 for normalized).
   * @param subdivisions - The resolution of the grid per face (e.g., 64 or 128 for high res).
   * @returns SphereGeometry containing interleaved buffer and indices.
   */
  public static create(radius: number, subdivisions: number): SphereGeometry {
    // 6 faces, (subdivisions + 1)^2 vertices per face, 8 floats per vertex (xyzuv nxnynz)
    const vertexCountPerFace = (subdivisions + 1) * (subdivisions + 1);
    const totalVertices = vertexCountPerFace * 6;
    const vertexStride = 8; // x, y, z, u, v, nx, ny, nz
    
    // 6 faces, subdivisions^2 quads per face, 2 triangles per quad, 3 indices per tri
    const indexCountPerFace = subdivisions * subdivisions * 6;
    const totalIndices = indexCountPerFace * 6;

    const vertices = new Float32Array(totalVertices * vertexStride);
    const indices = new Uint32Array(totalIndices);

    let vIndex = 0; // vertex array index
    let iIndex = 0; // index array index
    let vertexOffset = 0; // tracker for index offsets

    // The 6 directions of a cube
    const faces = [
      { origin: [1, 1, 1], right: [0, 0, -1], up: [0, -1, 0] }, // +X (Right)
      { origin: [-1, 1, -1], right: [0, 0, 1], up: [0, -1, 0] }, // -X (Left)
      { origin: [-1, 1, 1], right: [1, 0, 0], up: [0, 0, -1] }, // +Y (Top)
      { origin: [-1, -1, -1], right: [1, 0, 0], up: [0, 0, 1] }, // -Y (Bottom)
      { origin: [-1, 1, 1], right: [0, -1, 0], up: [1, 0, 0] }, // +Z (Front)
      { origin: [1, 1, -1], right: [0, -1, 0], up: [-1, 0, 0] }, // -Z (Back)
    ];

    for (const face of faces) {
      const faceStartVertex = vertexOffset;

      // 1. Generate Vertices for this face
      for (let j = 0; j <= subdivisions; j++) {
        for (let i = 0; i <= subdivisions; i++) {
          
          // Calculate grid position on the cube face (0.0 to 1.0)
          const uStep = i / subdivisions;
          const vStep = j / subdivisions;

          // Map to range [-1, 1] for cube math
          // P = origin + (right * u * 2) + (up * v * 2)
          // (We multiply by 2 because the cube face width is 2 units: -1 to 1)
          const px = face.origin[0] + (face.right[0] * uStep * 2.0) + (face.up[0] * vStep * 2.0);
          const py = face.origin[1] + (face.right[1] * uStep * 2.0) + (face.up[1] * vStep * 2.0);
          const pz = face.origin[2] + (face.right[2] * uStep * 2.0) + (face.up[2] * vStep * 2.0);

          // Normalize to turn cube into sphere
          // Length = sqrt(x*x + y*y + z*z)
          const len = Math.sqrt(px * px + py * py + pz * pz);
          const nx = px / len;
          const ny = py / len;
          const nz = pz / len;

          // Apply Radius
          const x = nx * radius;
          const y = ny * radius;
          const z = nz * radius;

          // Calculate UVs (Equirectangular / Spherical Mapping)
          let u = 0.5 + (Math.atan2(nz, nx) / (2 * Math.PI));
          const v = 0.5 - (Math.asin(ny) / Math.PI);

          // --- FIX START ---
          // Check if we are on the "Left" face (Index 1: -X direction)
          // This is the face that wraps around the date line.
          if (face.origin[0] === -1 && face.origin[1] === 1 && face.origin[2] === -1) {
            // If u is low (e.g. 0.0 to 0.25), it means we've wrapped around to the start.
            // We add 1.0 to make it continuous with the previous vertices (0.9 -> 1.1).
            if (u < 0.5) {
              u += 1.0;
            }
          }
          
          // Store Interleaved Data
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

      // 2. Generate Indices for this face
      for (let j = 0; j < subdivisions; j++) {
        for (let i = 0; i < subdivisions; i++) {
          const row1 = faceStartVertex + (j * (subdivisions + 1));
          const row2 = faceStartVertex + ((j + 1) * (subdivisions + 1));

          const a = row1 + i;
          const b = row1 + i + 1;
          const c = row2 + i;
          const d = row2 + i + 1;

          // Two triangles per quad
          // Triangle 1
          indices[iIndex++] = a;
          indices[iIndex++] = c;
          indices[iIndex++] = b;

          // Triangle 2
          indices[iIndex++] = b;
          indices[iIndex++] = c;
          indices[iIndex++] = d;
        }
      }

      // Update offset for the next face
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