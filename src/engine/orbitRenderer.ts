import { GLBuffer } from './helpers/buffers';
import { Program } from './helpers/shaders';
import { VertexArray } from './helpers/vaos';

const ORBIT_VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
uniform mat4 uView;
uniform mat4 uProjection;
void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}
`;

const ORBIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  outColor = vec4(uColor, 1.0);
}
`;

export class OrbitRenderer {
  private gl: WebGL2RenderingContext;
  private program: Program;
  private vao: VertexArray;
  private buffer: GLBuffer;
  private vertexCount = 0;
  private viewLocation: WebGLUniformLocation | null;
  private projectionLocation: WebGLUniformLocation | null;
  private colorLocation: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = new Program(gl, ORBIT_VERTEX_SHADER, ORBIT_FRAGMENT_SHADER);

    // Buffer holds pairs of vertices per orbit segment
    this.buffer = new GLBuffer(gl, new Float32Array(0), { target: 'vertex', usage: gl.DYNAMIC_DRAW });

    const positionLoc = gl.getAttribLocation(this.program.handle, 'aPosition');

    this.vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(this.buffer.targetEnum, this.buffer.handle);
      builder.addPointer({ location: positionLoc, size: 3, stride: 3 * Float32Array.BYTES_PER_ELEMENT });
    });

    this.viewLocation = this.program.getUniformLocation('uView');
    this.projectionLocation = this.program.getUniformLocation('uProjection');
    this.colorLocation = this.program.getUniformLocation('uColor');
  }

  setPath(points: { x: number; y: number; z: number }[]) {
    if (!points.length) {
      this.vertexCount = 0;
      return;
    }

    // GL.LINES draws disjoint segments, so create start/end pairs for each arc step
    const segmentCount = points.length;
    const vertices = new Float32Array(segmentCount * 2 * 3);
    for (let i = 0; i < segmentCount; i++) {
      const start = points[i];
      const end = points[(i + 1) % segmentCount];
      const base = i * 6;
      vertices[base] = start.x;
      vertices[base + 1] = start.y;
      vertices[base + 2] = start.z;
      vertices[base + 3] = end.x;
      vertices[base + 4] = end.y;
      vertices[base + 5] = end.z;
    }

    this.buffer.updateData(vertices);
    this.vertexCount = segmentCount * 2;
  }

  clear() {
    this.vertexCount = 0;
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array) {
    if (this.vertexCount === 0) return;

    this.program.use();
    this.vao.bind();

    this.gl.uniformMatrix4fv(this.viewLocation, false, viewMatrix);
    this.gl.uniformMatrix4fv(this.projectionLocation, false, projectionMatrix);

    // Soft cyan for orbit lines
    this.gl.uniform3f(this.colorLocation, 0.3, 0.8, 1.0);

    this.gl.drawArrays(this.gl.LINES, 0, this.vertexCount);

    this.vao.unbind();
  }

  destroy() {
    this.vao.destroy();
    this.buffer.destroy();
    this.program.destroy();
  }
}
