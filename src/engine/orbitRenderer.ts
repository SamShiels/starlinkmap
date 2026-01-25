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
  private _gl: WebGL2RenderingContext;
  private _program: Program;
  private _vao: VertexArray;
  private _buffer: GLBuffer;
  private _vertexCount = 0;
  private _viewLocation: WebGLUniformLocation | null;
  private _projectionLocation: WebGLUniformLocation | null;
  private _colorLocation: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this._gl = gl;
    this._program = new Program(gl, ORBIT_VERTEX_SHADER, ORBIT_FRAGMENT_SHADER);

    // Buffer holds pairs of vertices per orbit segment
    this._buffer = new GLBuffer(gl, new Float32Array(0), { target: 'vertex', usage: gl.DYNAMIC_DRAW });

    const positionLoc = gl.getAttribLocation(this._program.handle, 'aPosition');

    this._vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(this._buffer.targetEnum, this._buffer.handle);
      builder.addPointer({ location: positionLoc, size: 3, stride: 3 * Float32Array.BYTES_PER_ELEMENT });
    });

    this._viewLocation = this._program.getUniformLocation('uView');
    this._projectionLocation = this._program.getUniformLocation('uProjection');
    this._colorLocation = this._program.getUniformLocation('uColor');
  }

  public setPath(points: { x: number; y: number; z: number }[]) {
    if (!points.length) {
      this._vertexCount = 0;
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

    this._buffer.updateData(vertices);
    this._vertexCount = segmentCount * 2;
  }

  public clear() {
    this._vertexCount = 0;
  }

  public render(viewMatrix: Float32Array, projectionMatrix: Float32Array) {
    if (this._vertexCount === 0) return;

    this._program.use();
    this._vao.bind();

    this._gl.uniformMatrix4fv(this._viewLocation, false, viewMatrix);
    this._gl.uniformMatrix4fv(this._projectionLocation, false, projectionMatrix);

    // Soft cyan for orbit lines
    this._gl.uniform3f(this._colorLocation, 0.3, 0.8, 1.0);

    this._gl.drawArrays(this._gl.LINES, 0, this._vertexCount);

    this._vao.unbind();
  }

  public destroy() {
    this._vao.destroy();
    this._buffer.destroy();
    this._program.destroy();
  }
}
