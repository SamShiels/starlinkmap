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
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
  const response = await fetch(`${baseUrl}/satellites`);
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
  selectSatellite: (id: number | null) => void;
  setOverlayContext: (ctx: CanvasRenderingContext2D | null) => void;
};

export async function createEngine(
  canvas: HTMLCanvasElement,
  options: { onHoverChange?: (name: string | null) => void; overlayCanvas?: HTMLCanvasElement } = {},
): Promise<Engine> {
  const gl = getGLContext(canvas);
  gl.clearColor(0.01, 0.01, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Fetch real satellite data
  const satelliteData = await fetchSatellites();
  const satellites: Satellite[] = satelliteData.map(data => {
    // Scale positions and velocities for visualization (km to some unit)
    const scale = 0.00011; // e.g., 1 unit = 1 km
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
    return new Satellite(data.id, data.name, position, velocity, data.angular_velocity_rad_per_s);
  });

  const overlayCtx = options.overlayCanvas?.getContext('2d') ?? null;
  const sceneRenderer = new SceneRenderer(gl, satellites, options.onHoverChange, overlayCtx);

  let rafId: number | null = null;
  let destroyed = false;
  const canvasEl = gl.canvas as HTMLCanvasElement;

  const viewMatrix = new Float32Array(16);
  const projectionMatrix = new Float32Array(16);

  const setPointerFromEvent = (event: MouseEvent) => {
    const rect = canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (event.clientX - rect.left) * dpr;
    const y = (event.clientY - rect.top) * dpr;
    sceneRenderer.setPointer({ x, y });
  };

  const handleMouseMove = (event: MouseEvent) => {
    setPointerFromEvent(event);
  };

  const handleMouseLeave = () => {
    sceneRenderer.setPointer(null);
  };

  const handleClick = (event: MouseEvent) => {
    setPointerFromEvent(event);
    if (!controls.isDragging) {
      sceneRenderer.selectHoveredSatellite();
    }
  };

  canvasEl.addEventListener('mousemove', handleMouseMove);
  canvasEl.addEventListener('mouseleave', handleMouseLeave);
  canvasEl.addEventListener('mouseup', handleClick);

  const controls = new CameraControls(canvas);

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

    sceneRenderer.render(viewMatrix, projectionMatrix, timeMs, eye);
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
    canvasEl.removeEventListener('mousemove', handleMouseMove);
    canvasEl.removeEventListener('mouseleave', handleMouseLeave);
    canvasEl.removeEventListener('mouseup', handleClick);
    sceneRenderer.destroy();
    destroyed = true;
  }

  return {
    gl,
    start,
    stop,
    destroy,
    selectSatellite: (id: number | null) => sceneRenderer.setSelectedSatellite(id),
    setOverlayContext: (ctx: CanvasRenderingContext2D | null) => sceneRenderer.setOverlayContext(ctx),
  };
}
