// Shader and program helpers

export const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec2 aUv;
in vec3 aNormal;

uniform mat4 uView;
uniform mat4 uProjection;

out vec2 vUv;
out vec3 vNormal;

void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  vUv = aUv;
  vNormal = aNormal;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
in vec3 vNormal;

uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform vec3 uSunDirection;

out vec4 outColor;

void main() {
  vec3 normal = normalize(vNormal);
  float dotSun = dot(normal, uSunDirection);

  // Smooth blend: day when dot > 0, night when dot < 0, mix in between
  float blend = smoothstep(-0.1, 0.1, dotSun);

  vec4 dayColor = texture(uDayTexture, vUv);
  vec4 nightColor = texture(uNightTexture, vUv);

  outColor = mix(nightColor, dayColor, blend);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info ?? 'unknown'}`);
  }

  return shader;
}

export class Program {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;

  constructor(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
    this.gl = gl;
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program');
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${info ?? 'unknown'}`);
    }

    this.program = program;
  }

  get handle(): WebGLProgram {
    return this.program;
  }

  use() {
    this.gl.useProgram(this.program);
  }

  getUniformLocation(name: string): WebGLUniformLocation | null {
    return this.gl.getUniformLocation(this.program, name);
  }

  destroy() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
  }
}
