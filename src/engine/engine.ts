import { createBuffer, destroyBuffer } from './buffers';
import { setSizedCanvas } from './canvas';
import { getGLContext } from './context';
import { createProgram, destroyProgram } from './shaders';
import { createVertexArray, destroyVertexArray } from './vaos';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
in vec3 aColor;
uniform float uTime;
out vec3 vColor;

void main() {
  float angle = uTime * 0.6;
  mat2 rot = mat2(
    cos(angle), -sin(angle),
    sin(angle),  cos(angle)
  );
  vec2 pos = rot * aPosition;
  gl_Position = vec4(pos, 0.0, 1.0);
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

  const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);

  const vertexData = new Float32Array([
    // x,     y,     r,    g,    b
     0.0,   0.7,   1.0,  0.45, 0.3,
    -0.8,  -0.6,   0.3,  0.85, 1.0,
     0.8,  -0.6,   0.4,  1.0,  0.6,
  ]);

  const indexData = new Uint16Array([0, 1, 2]);

  const vertexBuffer = createBuffer(gl, vertexData, { target: 'vertex' });
  const indexBuffer = createBuffer(gl, indexData, { target: 'index' });

  const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
  const positionOffset = 0;
  const colorOffset = 2 * Float32Array.BYTES_PER_ELEMENT;

  const positionLoc = gl.getAttribLocation(program, 'aPosition');
  const colorLoc = gl.getAttribLocation(program, 'aColor');

  const vao = createVertexArray(gl, () => {
    gl.bindBuffer(vertexBuffer.target, vertexBuffer.buffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, stride, positionOffset);

    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, stride, colorOffset);

    gl.bindBuffer(indexBuffer.target, indexBuffer.buffer);
  });

  const timeLocation = gl.getUniformLocation(program, 'uTime');
  if (!timeLocation) {
    throw new Error('Failed to find uTime uniform');
  }

  let rafId: number | null = null;
  let destroyed = false;

  function render(timeMs: number) {
    const time = timeMs * 0.001;
    setSizedCanvas(gl);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform1f(timeLocation, time);
    gl.drawElements(gl.TRIANGLES, indexData.length, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
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
    destroyVertexArray(gl, vao);
    destroyBuffer(gl, vertexBuffer.buffer);
    destroyBuffer(gl, indexBuffer.buffer);
    destroyProgram(gl, program);
    destroyed = true;
  }

  return { gl, start, stop, destroy };
}
