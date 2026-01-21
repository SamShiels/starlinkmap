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

  const texture = new GLTexture2D(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE });
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

  // Camera controls
  let theta = 0; // azimuthal angle
  let phi = 0; // polar angle
  let radius = 2;

  // Smoothing deltas
  let thetaSmooth = 0;
  let phiSmooth = 0;
  let radiusSmooth = 0;

  // Mouse drag state
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Mouse event listeners
  canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    event.preventDefault();
  });

  canvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
      const deltaX = event.clientX - lastMouseX;
      const deltaY = event.clientY - lastMouseY;
      const sensitivity = 0.001;
      thetaSmooth += deltaX * sensitivity;
      phiSmooth += deltaY * sensitivity;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      event.preventDefault();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  canvas.addEventListener('wheel', (event) => {
    const zoomSensitivity = 0.001;
    radiusSmooth += event.deltaY * zoomSensitivity;
    event.preventDefault();
  });

  // Prevent page scrolling
  document.addEventListener('wheel', (event) => {
    event.preventDefault();
  }, { passive: false });

  function render() {
    setSizedCanvas(gl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;
    makePerspectiveMatrix(projectionMatrix, (60 * Math.PI) / 180, aspect, 0.1, 100);

    theta += thetaSmooth;
    phi += phiSmooth;
    radius += radiusSmooth;

    thetaSmooth *= 0.8;
    phiSmooth *= 0.8;
    radiusSmooth *= 0.8;

    // Clamp phi and radius to avoid flipping/extremes
    phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, phi));
    radius = Math.max(1.0, Math.min(10, radius));

    const eye = {
      x: radius * Math.cos(phi) * Math.cos(theta),
      y: radius * Math.sin(phi),
      z: radius * Math.cos(phi) * Math.sin(theta),
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


