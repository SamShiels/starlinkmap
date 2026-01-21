import { GLBuffer } from './helpers/buffers';
import { Program } from './helpers/shaders';
import { VertexArray } from './helpers/vaos';
import { Satellite } from './satellite';

const POINT_VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
uniform mat4 uView;
uniform mat4 uProjection;
void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  gl_PointSize = 5.0;
}
`;

const POINT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(1.0, 1.0, 0.0, 1.0);
}
`;

export class SatelliteRenderer {
  private gl: WebGL2RenderingContext;
  private program: Program;
  private vao: VertexArray;
  private buffer: GLBuffer;
  private viewLocation: WebGLUniformLocation | null;
  private projectionLocation: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext, satellites: Satellite[]) {
    this.gl = gl;

    // Create program
    this.program = new Program(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);

    // Create buffer (initially empty)
    this.buffer = new GLBuffer(gl, new Float32Array(satellites.length * 3), { target: 'vertex', usage: gl.DYNAMIC_DRAW });

    const positionLoc = gl.getAttribLocation(this.program.handle, 'aPosition');

    this.vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(this.buffer.targetEnum, this.buffer.handle);
      builder.addPointer({ location: positionLoc, size: 3, stride: 3 * Float32Array.BYTES_PER_ELEMENT });
    });

    // Get uniform locations
    this.viewLocation = this.program.getUniformLocation('uView');
    this.projectionLocation = this.program.getUniformLocation('uProjection');
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array, satellites: Satellite[]) {
    if (satellites.length === 0) return;

    // Update buffer
    const positions = new Float32Array(satellites.length * 3);
    for (let i = 0; i < satellites.length; i++) {
      const sat = satellites[i];
      positions[i * 3] = sat.position.x;
      positions[i * 3 + 1] = sat.position.y;
      positions[i * 3 + 2] = sat.position.z;
    }
    this.buffer.updateData(positions);

    this.program.use();
    this.vao.bind();

    this.gl.uniformMatrix4fv(this.viewLocation, false, viewMatrix);
    this.gl.uniformMatrix4fv(this.projectionLocation, false, projectionMatrix);
    this.gl.drawArrays(this.gl.POINTS, 0, satellites.length);

    this.vao.unbind();
  }

  destroy() {
    this.vao.destroy();
    this.buffer.destroy();
    this.program.destroy();
  }
}