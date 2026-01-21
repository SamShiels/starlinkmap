import { setSizedCanvas } from './canvas';
import { CameraControls } from './cameraControls';
import { SceneRenderer } from './sceneRenderer';
import { Satellite } from './satellite';
import { getGLContext } from './helpers/context';
import { makeLookAtMatrix, makePerspectiveMatrix } from './helpers/matrices';

type SatelliteData = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  altitude_km: number;
  speed_kms: number;
  orbital_radius_km: number;
  angular_velocity_rad_per_s: number;
  direction: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  velocity: { vx: number; vy: number; vz: number };
};

async function fetchSatellites(): Promise<SatelliteData[]> {
  const response = await fetch('http://localhost:8000/satellites');
  if (!response.ok) {
    throw new Error('Failed to fetch satellites');
  }
  const data = await response.json();
  return data.satellites;
}

type Engine = {
  gl: WebGL2RenderingContext;
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  const gl = getGLContext(canvas);
  gl.clearColor(0.01, 0.01, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  const controls = new CameraControls(canvas);

  // Fetch real satellite data
  const satelliteData = await fetchSatellites();
  const satellites: Satellite[] = satelliteData.map(data => {
    // Scale positions and velocities for visualization (km to some unit)
    const scale = 0.00012; // e.g., 1 unit = 1 km
    const position = {
      x: data.position.x * scale,
      y: data.position.y * scale,
      z: data.position.z * scale,
    };
    const velocity = {
      x: data.velocity.vx * scale,
      y: data.velocity.vy * scale,
      z: data.velocity.vz * scale,
    };
    return new Satellite(position, velocity, data.angular_velocity_rad_per_s);
  });

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

