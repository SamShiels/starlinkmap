import { GLBuffer } from './helpers/buffers';
import { QuadSphereGenerator, SphereGeometry } from './geometry/quadSphere';
import { Program, VERTEX_SHADER, FRAGMENT_SHADER } from './helpers/shaders';
import { GLTexture2D } from './helpers/textures';
import { VertexArray } from './helpers/vaos';

export class EarthRenderer {
  private gl: WebGL2RenderingContext;
  private program: Program;
  private texture: GLTexture2D;
  private vao: VertexArray;
  private earthGeo: SphereGeometry;
  private viewLocation: WebGLUniformLocation | null;
  private projectionLocation: WebGLUniformLocation | null;
  private textureLocation: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    // Create program
    this.program = new Program(gl, VERTEX_SHADER, FRAGMENT_SHADER);

    // Load texture
    this.texture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
    const img = new Image();
    img.onload = () => {
      this.texture.uploadFromImage(img);
    };
    img.src = '/2k_earth_daymap.jpg';

    // Create geometry
    this.earthGeo = QuadSphereGenerator.create(0.7, 64);

    // Create buffers
    const vertexBuffer = new GLBuffer(gl, new Float32Array(this.earthGeo.vertices), { target: 'vertex' });
    const indexBuffer = new GLBuffer(gl, new Int16Array(this.earthGeo.indices), { target: 'index' });

    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;

    const positionLoc = gl.getAttribLocation(this.program.handle, 'aPosition');
    const uvLoc = gl.getAttribLocation(this.program.handle, 'aUv');

    this.vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(vertexBuffer.targetEnum, vertexBuffer.handle);
      builder.addPointer({ location: positionLoc, size: 3, stride });
      builder.addPointer({ location: uvLoc, size: 2, stride });

      gl.bindBuffer(indexBuffer.targetEnum, indexBuffer.handle);
    });

    // Get uniform locations
    this.viewLocation = this.program.getUniformLocation('uView');
    this.projectionLocation = this.program.getUniformLocation('uProjection');
    this.textureLocation = this.program.getUniformLocation('uTexture');
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array) {
    this.program.use();
    this.vao.bind();

    this.gl.uniformMatrix4fv(this.viewLocation, false, viewMatrix);
    this.gl.uniformMatrix4fv(this.projectionLocation, false, projectionMatrix);
    this.texture.bind(0);
    this.gl.uniform1i(this.textureLocation, 0);
    this.gl.drawElements(this.gl.TRIANGLES, this.earthGeo.indexCount, this.gl.UNSIGNED_SHORT, 0);

    this.vao.unbind();
    this.texture.unbind(0);
  }

  destroy() {
    this.vao.destroy();
    this.texture.destroy();
    this.program.destroy();
  }
}