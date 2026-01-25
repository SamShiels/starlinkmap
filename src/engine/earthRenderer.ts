import { GLBuffer } from './helpers/buffers';
import { QuadSphereGenerator, SphereGeometry } from './geometry/quadSphere';
import { Program } from './helpers/shaders';
import { GLTexture2D } from './helpers/textures';
import { VertexArray } from './helpers/vaos';

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec2 aUv;
in vec3 aNormal;
uniform mat4 uView;
uniform mat4 uProjection;
out vec2 vUv;
out vec3 vNormal;

void main() {
  vec3 world = aPosition;
  gl_Position = uProjection * uView * vec4(world, 1.0);
  vUv = aUv;
  vNormal = aNormal;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vNormal;
uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform vec3 uSunDirection;
out vec4 outColor;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 sunDir = normalize(uSunDirection);

  float sunAmount = clamp(dot(normal, sunDir), 0.0, 1.0);

  vec3 dayColor = texture(uDayTexture, vUv).rgb;
  vec3 nightColor = texture(uNightTexture, vUv).rgb;

  vec3 color = mix(nightColor, dayColor, sunAmount);
  outColor = vec4(color, 1.0);
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
    dayImg.src = '/8k_earth_daymap.jpg';

    // Load night texture
    this.nightTexture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
    const nightImg = new Image();
    nightImg.onload = () => {
      this.nightTexture.uploadFromImage(nightImg);
    };
    nightImg.src = '/8k_earth_nightmap.jpg';

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

    const sunDirection = this.getSunDirection();
    this.gl.uniform3f(this.sunDirectionLocation, sunDirection[0], sunDirection[1], sunDirection[2]);

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

  private getSunDirection(): [number, number, number] {
    const now = new Date();
    const millisecondsInADay = 86400000;

    const dayProgress = (now.getTime() % millisecondsInADay) / millisecondsInADay;
    const sunAngle = dayProgress * Math.PI * 2 - Math.PI / 2;

    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const startOfNextYear = new Date(now.getFullYear() + 1, 0, 0);
    const msIntoYear = now.getTime() - startOfYear.getTime();
    const msPerYear = startOfNextYear.getTime() - startOfYear.getTime();
    const yearProgress = msIntoYear / msPerYear;

    const axialTilt = (23.44 * Math.PI) / 180;
    const declination = Math.sin(yearProgress * Math.PI * 2) * axialTilt;

    const x = Math.cos(declination) * Math.cos(sunAngle);
    const y = Math.sin(declination);
    const z = Math.cos(declination) * Math.sin(sunAngle);

    return [x, y, z];
  }
}
