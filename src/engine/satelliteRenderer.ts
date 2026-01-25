import { GLBuffer } from './helpers/buffers';
import { Program } from './helpers/shaders';
import { VertexArray } from './helpers/vaos';
import { Satellite } from './satellite';

const POINT_VERTEX_SHADER = `#version 300 es
in vec3 aCenter;
in vec2 aCorner;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uSize;
out vec2 vCorner;
void main() {
  // Extract camera right/up vectors from view matrix columns
  vec3 right = vec3(uView[0][0], uView[1][0], uView[2][0]);
  vec3 up = vec3(uView[0][1], uView[1][1], uView[2][1]);

  vec3 worldPos = aCenter + (right * aCorner.x + up * aCorner.y) * uSize;
  gl_Position = uProjection * uView * vec4(worldPos, 1.0);
  vCorner = aCorner;
}
`;

const POINT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vCorner;
out vec4 outColor;
void main() {
  float r2 = dot(vCorner, vCorner);
  if (r2 > 1.0) {
    discard;
  }
  outColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

export class SatelliteRenderer {
  private gl: WebGL2RenderingContext;
  private program: Program;
  private vao: VertexArray;
  private vertexBuffer: GLBuffer;
  private indexBuffer: GLBuffer;
  private viewLocation: WebGLUniformLocation | null;
  private projectionLocation: WebGLUniformLocation | null;
  private sizeLocation: WebGLUniformLocation | null;
  private readonly quadSize = 0.002;

  constructor(gl: WebGL2RenderingContext, satellites: Satellite[]) {
    this.gl = gl;

    // Create program
    this.program = new Program(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);

    // Create buffers: 4 verts per satellite, 6 indices per satellite
    this.vertexBuffer = new GLBuffer(
      gl,
      new Float32Array(Math.max(1, satellites.length) * 4 * 5),
      { target: 'vertex', usage: gl.DYNAMIC_DRAW },
    );
    this.indexBuffer = new GLBuffer(
      gl,
      new Uint32Array(Math.max(1, satellites.length) * 6),
      { target: 'index', usage: gl.DYNAMIC_DRAW },
    );

    const centerLoc = gl.getAttribLocation(this.program.handle, 'aCenter');
    const cornerLoc = gl.getAttribLocation(this.program.handle, 'aCorner');

    this.vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(this.vertexBuffer.targetEnum, this.vertexBuffer.handle);
      const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
      builder.addPointer({ location: centerLoc, size: 3, stride });
      builder.addPointer({ location: cornerLoc, size: 2, stride });
      gl.bindBuffer(this.indexBuffer.targetEnum, this.indexBuffer.handle);
    });

    // Get uniform locations
    this.viewLocation = this.program.getUniformLocation('uView');
    this.projectionLocation = this.program.getUniformLocation('uProjection');
    this.sizeLocation = this.program.getUniformLocation('uSize');
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array, satellites: Satellite[]) {
    if (satellites.length === 0) return;

    // Build per-vertex data: center position + corner indicator
    const data = new Float32Array(satellites.length * 4 * 5);
    const indices = new Uint32Array(satellites.length * 6);
    for (let i = 0; i < satellites.length; i++) {
      const sat = satellites[i];
      const base = i * 20; // 4 verts * 5 floats
      const corners = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];
      for (let c = 0; c < 4; c++) {
        const offset = base + c * 5;
        data[offset] = sat.position.x;
        data[offset + 1] = sat.position.y;
        data[offset + 2] = sat.position.z;
        data[offset + 3] = corners[c][0];
        data[offset + 4] = corners[c][1];
      }

      const iBase = i * 6;
      const vBase = i * 4;
      indices[iBase] = vBase;
      indices[iBase + 1] = vBase + 1;
      indices[iBase + 2] = vBase + 2;
      indices[iBase + 3] = vBase + 2;
      indices[iBase + 4] = vBase + 1;
      indices[iBase + 5] = vBase + 3;
    }
    this.vertexBuffer.updateData(data);
    this.indexBuffer.updateData(indices);

    this.program.use();
    this.vao.bind();

    this.gl.uniformMatrix4fv(this.viewLocation, false, viewMatrix);
    this.gl.uniformMatrix4fv(this.projectionLocation, false, projectionMatrix);
    this.gl.uniform1f(this.sizeLocation, this.quadSize * 0.5);
    this.gl.drawElements(this.gl.TRIANGLES, satellites.length * 6, this.gl.UNSIGNED_INT, 0);

    this.vao.unbind();
  }

  destroy() {
    this.vao.destroy();
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.program.destroy();
  }
}
