import { GLBuffer } from './buffers';
import { setSizedCanvas } from './canvas';
import { getGLContext } from './context';
import { QuadSphereGenerator } from './geometry/quadSphere';
import { Program, VERTEX_SHADER, FRAGMENT_SHADER } from './shaders';
import { VertexArray } from './vaos';
import { GLTexture2D } from './textures';
import { makeLookAtMatrix, makePerspectiveMatrix } from './matrices';

type Engine = {
  gl: WebGL2RenderingContext;
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const gl = getGLContext(canvas);
  gl.clearColor(0.05, 0.07, 0.12, 1.0);
  gl.enable(gl.DEPTH_TEST);

  const program = new Program(gl, VERTEX_SHADER, FRAGMENT_SHADER);

  const texture = new GLTexture2D(gl);
  const img = new Image();
  img.onload = () => {
    texture.uploadFromImage(img);
  };
  img.src = '/2k_earth_daymap.jpg';

  const earthGeo = QuadSphereGenerator.create(0.7, 64);

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

  const viewLocation = program.getUniformLocation('uView');
  const projectionLocation = program.getUniformLocation('uProjection');
  const textureLocation = program.getUniformLocation('uTexture');
  if (!viewLocation || !projectionLocation || !textureLocation) {
    throw new Error('Failed to find uniforms');
  }

  let rafId: number | null = null;
  let destroyed = false;

  const viewMatrix = new Float32Array(16);
  const projectionMatrix = new Float32Array(16);

  function render(timeMs: number) {
    const time = timeMs * 0.001;
    setSizedCanvas(gl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;
    makePerspectiveMatrix(projectionMatrix, (60 * Math.PI) / 180, aspect, 0.1, 100);

    const radius = 2;
    const eye = {
      x: Math.cos(time * 0.5) * radius,
      y: 0,
      z: Math.sin(time * 0.5) * radius,
    };
    const target = { x: 0, y: 0, z: 0 };
    makeLookAtMatrix(viewMatrix, eye, target);

    program.use();
    vao.bind();

    gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    texture.bind(0);
    gl.uniform1i(textureLocation, 0);
    gl.drawElements(gl.TRIANGLES, earthGeo.indexCount, gl.UNSIGNED_SHORT, 0);

    vao.unbind();
    texture.unbind(0);
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
    texture.destroy();
    program.destroy();
    destroyed = true;
  }

  return { gl, start, stop, destroy };
}


