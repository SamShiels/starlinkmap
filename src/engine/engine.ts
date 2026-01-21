import { GLBuffer } from './buffers';
import { setSizedCanvas } from './canvas';
import { getGLContext } from './context';
import { QuadSphereGenerator } from './geometry/quadSphere';
import { Program } from './shaders';
import { VertexArray } from './vaos';

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec2 aUv;
uniform float uTime;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vColor;
out vec2 vUv;

void main() {
  float angle = uTime * 0.5;
  mat3 rotY = mat3(
    cos(angle), 0.0, sin(angle),
    0.0,        1.0, 0.0,
   -sin(angle), 0.0, cos(angle)
  );
  vec3 world = rotY * aPosition;
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
out vec4 outColor;

void main() {
  vec3 uvTint = vec3(vUv, 0.6);
  outColor = vec4(mix(vColor, uvTint, 0.35), 1.0);
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

  const earthGeo = QuadSphereGenerator.create(1.0, 64);

  const vertexBuffer = new GLBuffer(gl, new Float32Array(earthGeo.vertices), { target: 'vertex' });
  const indexBuffer = new GLBuffer(gl, new Int16Array(earthGeo.indices), { target: 'index' });

  const stride = 5 * Float32Array.BYTES_PER_ELEMENT;

  const positionLoc = gl.getAttribLocation(program.handle, 'aPosition');
  const uvLoc = gl.getAttribLocation(program.handle, 'aUv');

  const vao = new VertexArray(gl, (builder) => {
    gl.bindBuffer(vertexBuffer.targetEnum, vertexBuffer.handle);
    builder.addPointer({ location: positionLoc, size: 3, stride });
    builder.addPointer({ location: uvLoc, size: 2, stride });

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
    gl.drawElements(gl.TRIANGLES, earthGeo.indexCount, gl.UNSIGNED_SHORT, 0);

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
