import { GLBuffer } from './buffers';
import { setSizedCanvas } from './canvas';
import { getGLContext } from './context';
import { Program } from './shaders';
import { VertexArray } from './vaos';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
in vec3 aColor;
uniform float uTime;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vColor;

void main() {
  float angle = uTime * 0.6;
  mat2 rot = mat2(
    cos(angle), -sin(angle),
    sin(angle),  cos(angle)
  );
  vec2 pos = rot * aPosition;
  vec4 worldPos = vec4(pos, 0.0, 1.0);
  gl_Position = uProjection * uView * worldPos;
  vColor = aColor;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;

void main() {
  outColor = vec4(vColor, 1.0);
}
`;

type Engine = {
  gl: WebGL2RenderingContext;
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const gl = getGLContext(canvas);
  gl.clearColor(0.05, 0.07, 0.12, 1.0);

  const program = new Program(gl, VERTEX_SHADER, FRAGMENT_SHADER);

  const vertexData = new Float32Array([
    // x,     y,     r,    g,    b
     0.0,   0.7,   1.0,  0.45, 0.3,
    -0.8,  -0.6,   0.3,  0.85, 1.0,
     0.8,  -0.6,   0.4,  1.0,  0.6,
  ]);

  const indexData = new Uint16Array([0, 1, 2]);

  const vertexBuffer = new GLBuffer(gl, vertexData, { target: 'vertex' });
  const indexBuffer = new GLBuffer(gl, indexData, { target: 'index' });

  const stride = 5 * Float32Array.BYTES_PER_ELEMENT;

  const positionLoc = gl.getAttribLocation(program.handle, 'aPosition');
  const colorLoc = gl.getAttribLocation(program.handle, 'aColor');

  const vao = new VertexArray(gl, (builder) => {
    gl.bindBuffer(vertexBuffer.targetEnum, vertexBuffer.handle);
    builder.addPointer({ location: positionLoc, size: 2, stride });
    builder.addPointer({ location: colorLoc, size: 3, stride });

    gl.bindBuffer(indexBuffer.targetEnum, indexBuffer.handle);
  });

  const timeLocation = program.getUniformLocation('uTime');
  if (!timeLocation) {
    throw new Error('Failed to find uTime uniform');
  }
  const viewLocation = program.getUniformLocation('uView');
  const projectionLocation = program.getUniformLocation('uProjection');
  if (!viewLocation || !projectionLocation) {
    throw new Error('Failed to find matrix uniforms');
  }

  let rafId: number | null = null;
  let destroyed = false;

  const viewMatrix = makeViewMatrix({ x: 0, y: 0, z: -2 });
  const projectionMatrix = new Float32Array(16);

  function render(timeMs: number) {
    const time = timeMs * 0.001;
    setSizedCanvas(gl);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;
    makePerspectiveMatrix(projectionMatrix, (60 * Math.PI) / 180, aspect, 0.1, 100);

    program.use();
    vao.bind();

    gl.uniform1f(timeLocation, time);
    gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    gl.drawElements(gl.TRIANGLES, indexData.length, gl.UNSIGNED_SHORT, 0);

    vao.unbind();
    rafId = window.requestAnimationFrame(render);
  }

  function start() {
    if (rafId === null) {
      rafId = window.requestAnimationFrame(render);
    }
  }

  function stop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function destroy() {
    if (destroyed) {
      return;
    }
    stop();
    vao.destroy();
    vertexBuffer.destroy();
    indexBuffer.destroy();
    program.destroy();
    destroyed = true;
  }

  return { gl, start, stop, destroy };
}

function makeViewMatrix(position: { x: number; y: number; z: number }): Float32Array {
  const m = new Float32Array(16);
  m.set([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    position.x, position.y, position.z, 1,
  ]);
  return m;
}

function makePerspectiveMatrix(
  out: Float32Array,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
) {
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);

  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;

  out[12] = 0;
  out[13] = 0;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
}
