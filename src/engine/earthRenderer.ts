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
  vec3 nightColor = min(texture(uNightTexture, vUv).rgb, 0.3);

  vec3 color = mix(nightColor, dayColor, sunAmount);
  outColor = vec4(color, 1.0);
}
`;

export class EarthRenderer {
  private _gl: WebGL2RenderingContext;
  private _program: Program;
  private _dayTexture: GLTexture2D;
  private _nightTexture: GLTexture2D;
  private _vao: VertexArray;
  private _geo: SphereGeometry;
  private _viewLocation: WebGLUniformLocation | null;
  private _projectionLocation: WebGLUniformLocation | null;
  private _dayTextureLocation: WebGLUniformLocation | null;
  private _nightTextureLocation: WebGLUniformLocation | null;
  private _sunDirectionLocation: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this._gl = gl;

    // Create program
    this._program = new Program(gl, VERTEX_SHADER, FRAGMENT_SHADER);

    // Load day texture
    this._dayTexture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
    const dayImg = new Image();
    dayImg.onload = () => {
      this._dayTexture.uploadFromImage(dayImg);
    };
    dayImg.src = '/8k_earth_daymap.jpg';

    // Load night texture
    this._nightTexture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
    const nightImg = new Image();
    nightImg.onload = () => {
      this._nightTexture.uploadFromImage(nightImg);
    };
    nightImg.src = '/8k_earth_nightmap.jpg';

    // Create geometry
    this._geo = QuadSphereGenerator.create(0.7, 64);

    // Create buffers
    const vertexBuffer = new GLBuffer(gl, new Float32Array(this._geo.vertices), { target: 'vertex' });
    const indexBuffer = new GLBuffer(gl, new Int16Array(this._geo.indices), { target: 'index' });

    const stride = 8 * Float32Array.BYTES_PER_ELEMENT;

    const positionLoc = gl.getAttribLocation(this._program.handle, 'aPosition');
    const uvLoc = gl.getAttribLocation(this._program.handle, 'aUv');
    const normalLoc = gl.getAttribLocation(this._program.handle, 'aNormal');

    this._vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(vertexBuffer.targetEnum, vertexBuffer.handle);
      builder.addPointer({ location: positionLoc, size: 3, stride});
      builder.addPointer({ location: uvLoc, size: 2, stride });
      builder.addPointer({ location: normalLoc, size: 3, stride });

      gl.bindBuffer(indexBuffer.targetEnum, indexBuffer.handle);
    });

    // Get uniform locations
    this._viewLocation = this._program.getUniformLocation('uView');
    this._projectionLocation = this._program.getUniformLocation('uProjection');
    this._dayTextureLocation = this._program.getUniformLocation('uDayTexture');
    this._nightTextureLocation = this._program.getUniformLocation('uNightTexture');
    this._sunDirectionLocation = this._program.getUniformLocation('uSunDirection');
  }

  public render(viewMatrix: Float32Array, projectionMatrix: Float32Array) {
    this._program.use();
    this._vao.bind();

    this._gl.uniformMatrix4fv(this._viewLocation, false, viewMatrix);
    this._gl.uniformMatrix4fv(this._projectionLocation, false, projectionMatrix);

    this._dayTexture.bind(0);
    this._gl.uniform1i(this._dayTextureLocation, 0);
    this._nightTexture.bind(1);
    this._gl.uniform1i(this._nightTextureLocation, 1);

    const sunDirection = this._getSunDirection();
    this._gl.uniform3f(this._sunDirectionLocation, sunDirection[0], sunDirection[1], sunDirection[2]);

    this._gl.drawElements(this._gl.TRIANGLES, this._geo.indexCount, this._gl.UNSIGNED_SHORT, 0);

    this._vao.unbind();
    this._dayTexture.unbind(0);
    this._nightTexture.unbind(1);
  }

  public destroy() {
    this._vao.destroy();
    this._dayTexture.destroy();
    this._nightTexture.destroy();
    this._program.destroy();
  }

  private _getSunDirection(): [number, number, number] {
    const now = new Date();
    const millisecondsInADay = 86400000;

    const dayProgress = (now.getTime() % millisecondsInADay) / millisecondsInADay - 0.25;
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
