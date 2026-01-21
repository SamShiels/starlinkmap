import { setSizedCanvas } from './canvas';
import { CameraControls } from './cameraControls';
import { SceneRenderer } from './sceneRenderer';
import { Satellite } from './satellite';
import { getGLContext } from './helpers/context';
import { makeLookAtMatrix, makePerspectiveMatrix } from './helpers/matrices';

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

  const controls = new CameraControls(canvas);

  // Create some test satellites (will be replaced with real data)
  const satellites: Satellite[] = [
    new Satellite(1.1, 0.5, 0), // radius, angular vel, initial angle
    new Satellite(1.2, -0.3, Math.PI / 2), // opposite direction
  ];

  const sceneRenderer = new SceneRenderer(gl, satellites);

  let rafId: number | null = null;
  let destroyed = false;

  const viewMatrix = new Float32Array(16);
  const projectionMatrix = new Float32Array(16);

  // Prevent page scrolling
  document.addEventListener('wheel', (event) => {
    event.preventDefault();
  }, { passive: false });

  function render(timeMs: number) {
    setSizedCanvas(gl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;
    makePerspectiveMatrix(projectionMatrix, (60 * Math.PI) / 180, aspect, 0.1, 100);

    controls.update();

    const eye = {
      x: controls.radius * Math.cos(controls.phi) * Math.cos(controls.theta),
      y: controls.radius * Math.sin(controls.phi),
      z: controls.radius * Math.cos(controls.phi) * Math.sin(controls.theta),
    };
    const target = { x: 0, y: 0, z: 0 };
    makeLookAtMatrix(viewMatrix, eye, target);

    sceneRenderer.render(viewMatrix, projectionMatrix, timeMs);
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
    sceneRenderer.destroy();
    destroyed = true;
  }

  return { gl, start, stop, destroy };
}


