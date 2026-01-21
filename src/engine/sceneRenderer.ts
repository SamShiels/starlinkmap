import { GLBuffer } from './helpers/buffers';
import { QuadSphereGenerator, SphereGeometry } from './geometry/quadSphere';
import { Program, VERTEX_SHADER, FRAGMENT_SHADER } from './helpers/shaders';
import { GLTexture2D } from './helpers/textures';
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

export class SceneRenderer {
  private gl: WebGL2RenderingContext;
  private earthProgram: Program;
  private earthTexture: GLTexture2D;
  private earthVao: VertexArray;
  private earthGeo: SphereGeometry;
  private earthViewLocation: WebGLUniformLocation | null;
  private earthProjectionLocation: WebGLUniformLocation | null;
  private earthTextureLocation: WebGLUniformLocation | null;

  private pointProgram: Program;
  private pointVao: VertexArray;
  private pointBuffer: GLBuffer;
  private pointViewLocation: WebGLUniformLocation | null;
  private pointProjectionLocation: WebGLUniformLocation | null;

  private satellites: Satellite[];
  private lastTime = 0;

  constructor(gl: WebGL2RenderingContext, satellites: Satellite[]) {
    this.gl = gl;
    this.satellites = satellites;

    // Create Earth program
    this.earthProgram = new Program(gl, VERTEX_SHADER, FRAGMENT_SHADER);

    // Load Earth texture
    this.earthTexture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
    const img = new Image();
    img.onload = () => {
      this.earthTexture.uploadFromImage(img);
    };
    img.src = '/2k_earth_daymap.jpg';

    // Create geometry
    this.earthGeo = QuadSphereGenerator.create(0.7, 64);

    // Create buffers
    const vertexBuffer = new GLBuffer(gl, new Float32Array(this.earthGeo.vertices), { target: 'vertex' });
    const indexBuffer = new GLBuffer(gl, new Int16Array(this.earthGeo.indices), { target: 'index' });

    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;

    const positionLoc = gl.getAttribLocation(this.earthProgram.handle, 'aPosition');
    const uvLoc = gl.getAttribLocation(this.earthProgram.handle, 'aUv');

    this.earthVao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(vertexBuffer.targetEnum, vertexBuffer.handle);
      builder.addPointer({ location: positionLoc, size: 3, stride });
      builder.addPointer({ location: uvLoc, size: 2, stride });

      gl.bindBuffer(indexBuffer.targetEnum, indexBuffer.handle);
    });

    // Get Earth uniform locations
    this.earthViewLocation = this.earthProgram.getUniformLocation('uView');
    this.earthProjectionLocation = this.earthProgram.getUniformLocation('uProjection');
    this.earthTextureLocation = this.earthProgram.getUniformLocation('uTexture');

    // Create point program
    this.pointProgram = new Program(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);

    // Create point buffer (initially empty)
    this.pointBuffer = new GLBuffer(gl, new Float32Array(this.satellites.length * 3), { target: 'vertex', usage: gl.DYNAMIC_DRAW });

    const pointPositionLoc = gl.getAttribLocation(this.pointProgram.handle, 'aPosition');

    this.pointVao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(this.pointBuffer.targetEnum, this.pointBuffer.handle);
      builder.addPointer({ location: pointPositionLoc, size: 3, stride: 3 * Float32Array.BYTES_PER_ELEMENT });
    });

    // Get point uniform locations
    this.pointViewLocation = this.pointProgram.getUniformLocation('uView');
    this.pointProjectionLocation = this.pointProgram.getUniformLocation('uProjection');
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array, currentTime: number) {
    const dt = (currentTime - this.lastTime) / 1000; // seconds
    this.lastTime = currentTime;

    // Update satellites
    for (const sat of this.satellites) {
      sat.update(dt);
    }

    // Render Earth
    this.earthProgram.use();
    this.earthVao.bind();

    this.gl.uniformMatrix4fv(this.earthViewLocation, false, viewMatrix);
    this.gl.uniformMatrix4fv(this.earthProjectionLocation, false, projectionMatrix);
    this.earthTexture.bind(0);
    this.gl.uniform1i(this.earthTextureLocation, 0);
    this.gl.drawElements(this.gl.TRIANGLES, this.earthGeo.indexCount, this.gl.UNSIGNED_SHORT, 0);

    this.earthVao.unbind();
    this.earthTexture.unbind(0);

    // Render satellites
    if (this.satellites.length > 0) {
      // Update point buffer
      const positions = new Float32Array(this.satellites.length * 3);
      for (let i = 0; i < this.satellites.length; i++) {
        const sat = this.satellites[i];
        positions[i * 3] = sat.position.x;
        positions[i * 3 + 1] = sat.position.y;
        positions[i * 3 + 2] = sat.position.z;
      }
      this.pointBuffer.updateData(positions);

      this.pointProgram.use();
      this.pointVao.bind();

      this.gl.uniformMatrix4fv(this.pointViewLocation, false, viewMatrix);
      this.gl.uniformMatrix4fv(this.pointProjectionLocation, false, projectionMatrix);
      this.gl.drawArrays(this.gl.POINTS, 0, this.satellites.length);

      this.pointVao.unbind();
    }
  }

  destroy() {
    this.earthVao.destroy();
    this.earthTexture.destroy();
    this.earthProgram.destroy();
    this.pointVao.destroy();
    this.pointBuffer.destroy();
    this.pointProgram.destroy();
  }
}