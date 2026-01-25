import { setSizedCanvas } from './canvas';
import { CameraControls } from './cameraControls';
import { SceneRenderer } from './sceneRenderer';
import { getGLContext } from './helpers/context';
import { makeLookAtMatrix, makePerspectiveMatrix } from './helpers/matrices';
import { Satellite } from './satellite';
import { SatelliteRenderer } from './satelliteRenderer';

type SatelliteApiData = {
  id: number;
  name: string;
  orbital_radius_km: number;
  angular_velocity_rad_per_s: number;
  speed_kms: number;
  position: { x: number; y: number; z: number };
  velocity: { vx: number; vy: number; vz: number };
};

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const POSITION_SCALE = 0.00011;

async function fetchSatellitesFromApi(baseUrl: string = DEFAULT_BASE_URL): Promise<Satellite[]> {
  const response = await fetch(`${baseUrl}/satellites`);
  if (!response.ok) {
    throw new Error('Failed to load satellites');
  }
  const data = await response.json();
  return mapApiDataToSatellites(data.satellites);
}

function mapApiDataToSatellites(data: SatelliteApiData[]): Satellite[] {
  return data.map((entry) => {
    const position = {
      x: entry.position.x * POSITION_SCALE,
      y: entry.position.y * POSITION_SCALE,
      z: entry.position.z * POSITION_SCALE,
    };
    const velocity = {
      x: entry.velocity.vx * POSITION_SCALE,
      y: entry.velocity.vy * POSITION_SCALE,
      z: entry.velocity.vz * POSITION_SCALE,
    };

    return new Satellite(
      entry.id,
      entry.name,
      position,
      velocity,
      entry.angular_velocity_rad_per_s,
      { altitudeKm: entry.orbital_radius_km, speedKms: entry.speed_kms },
    );
  });
}

export type Engine = {
  gl: WebGL2RenderingContext;
  start: () => void;
  stop: () => void;
  destroy: () => void;
  selectSatellite: (id: number | null) => void;
  setOverlayContext: (ctx: CanvasRenderingContext2D | null) => void;
  getSatellites: () => Satellite[];
};

type EngineOptions = {
  onHoverChange?: (name: string | null) => void;
  onSelectChange?: (satellite: Satellite | null) => void;
  overlayCanvas?: HTMLCanvasElement;
  onSatellitesLoaded?: (satellites: Satellite[]) => void;
  onSatellitesError?: (message: string) => void;
};

export async function createEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions = {},
): Promise<Engine> {
  const gl = getGLContext(canvas);
  gl.clearColor(0.01, 0.01, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);
  // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Create renderer; satellites load asynchronously so earth can render immediately
  const satelliteRenderer = new SatelliteRenderer(gl);
  const satellites = satelliteRenderer.getSatellites();

  const overlayCtx = options.overlayCanvas?.getContext('2d') ?? null;
  const sceneRenderer = new SceneRenderer(
    gl,
    satelliteRenderer,
    options.onHoverChange,
    overlayCtx,
    options.onSelectChange,
  );

  // Kick off satellite fetch in background; update listeners when ready
  fetchSatellitesFromApi()
    .then((loaded) => {
      satelliteRenderer.setSatellites(loaded);
      options.onSatellitesLoaded?.(loaded);
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to load satellites';
      options.onSatellitesError?.(message);
    });

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

    const eye = controls.getEyePosition();
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
    getSatellites: () => satellites,
  };
}
