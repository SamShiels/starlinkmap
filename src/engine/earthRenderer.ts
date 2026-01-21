import { GLBuffer } from './helpers/buffers';
import { QuadSphereGenerator, SphereGeometry } from './geometry/quadSphere';
import { Program } from './helpers/shaders';
import { GLTexture2D } from './helpers/textures';
import { VertexArray } from './helpers/vaos';

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec2 aUv;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vColor;
out vec2 vUv;

void main() {
  vec3 world = aPosition;
  vec3 normal = normalize(world);
  gl_Position = uProjection * uView * vec4(world, 1.0);
  vColor = normal * 0.5 + 0.5;
  vUv = aUv;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 outColor;

void main() {
  vec3 texColor = texture(uTexture, vUv).rgb;
  outColor = vec4(texColor, 1.0);
}
`;

export class EarthRenderer {
  private gl: WebGL2RenderingContext;
  private program: Program;
  private dayTexture: GLTexture2D;
  private nightTexture: GLTexture2D;
  private vao: VertexArray;
  private geo: SphereGeometry;
  private viewLocation: WebGLUniformLocation | null;
  private projectionLocation: WebGLUniformLocation | null;
  private dayTextureLocation: WebGLUniformLocation | null;
  private nightTextureLocation: WebGLUniformLocation | null;
  private sunDirectionLocation: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    // Create program
    this.program = new Program(gl, VERTEX_SHADER, FRAGMENT_SHADER);

    // Load day texture
    this.dayTexture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
    const dayImg = new Image();
    dayImg.onload = () => {
      this.dayTexture.uploadFromImage(dayImg);
    };
    dayImg.src = '/2k_earth_daymap.jpg';

    // Load night texture
    this.nightTexture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
    const nightImg = new Image();
    nightImg.onload = () => {
      this.nightTexture.uploadFromImage(nightImg);
    };
    nightImg.src = '/8k_earth_night.jpg';

    // Create geometry
    this.geo = QuadSphereGenerator.create(0.7, 64);

    // Create buffers
    const vertexBuffer = new GLBuffer(gl, new Float32Array(this.geo.vertices), { target: 'vertex' });
    const indexBuffer = new GLBuffer(gl, new Int16Array(this.geo.indices), { target: 'index' });

    const stride = 8 * Float32Array.BYTES_PER_ELEMENT;

    const positionLoc = gl.getAttribLocation(this.program.handle, 'aPosition');
    const uvLoc = gl.getAttribLocation(this.program.handle, 'aUv');
    const normalLoc = gl.getAttribLocation(this.program.handle, 'aNormal');

    this.vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(vertexBuffer.targetEnum, vertexBuffer.handle);
      builder.addPointer({ location: positionLoc, size: 3, stride});
      builder.addPointer({ location: uvLoc, size: 2, stride });
      builder.addPointer({ location: normalLoc, size: 3, stride });

      gl.bindBuffer(indexBuffer.targetEnum, indexBuffer.handle);
    });

    // Get uniform locations
    this.viewLocation = this.program.getUniformLocation('uView');
    this.projectionLocation = this.program.getUniformLocation('uProjection');
    this.dayTextureLocation = this.program.getUniformLocation('uDayTexture');
    this.nightTextureLocation = this.program.getUniformLocation('uNightTexture');
    this.sunDirectionLocation = this.program.getUniformLocation('uSunDirection');
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array) {
    this.program.use();
    this.vao.bind();

    this.gl.uniformMatrix4fv(this.viewLocation, false, viewMatrix);
    this.gl.uniformMatrix4fv(this.projectionLocation, false, projectionMatrix);

    this.dayTexture.bind(0);
    this.gl.uniform1i(this.dayTextureLocation, 0);
    this.nightTexture.bind(1);
    this.gl.uniform1i(this.nightTextureLocation, 1);

    // Fixed sun direction (can be made dynamic later)
    this.gl.uniform3f(this.sunDirectionLocation, 1.0, 0.0, 0.0);

    this.gl.drawElements(this.gl.TRIANGLES, this.geo.indexCount, this.gl.UNSIGNED_SHORT, 0);

    this.vao.unbind();
    this.dayTexture.unbind(0);
    this.nightTexture.unbind(1);
  }

  destroy() {
    this.vao.destroy();
    this.dayTexture.destroy();
    this.nightTexture.destroy();
    this.program.destroy();
  }
}