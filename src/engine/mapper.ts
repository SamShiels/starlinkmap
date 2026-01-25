import { setSizedCanvas } from './canvas';
import { CameraControls } from './cameraControls';
import { SceneRenderer } from './sceneRenderer';
import { getGLContext } from './helpers/context';
import { makeLookAtMatrix, makePerspectiveMatrix } from './helpers/matrices';
import { fetchSatellitesFromApi } from './api/satellite';
import { Satellite } from './satellite';
import { SatelliteRenderer } from './satelliteRenderer';

export type MapperOptions = {
  onHoverChange?: (name: string | null) => void;
  onSelectChange?: (satellite: Satellite | null) => void;
  overlayCanvas?: HTMLCanvasElement;
  onSatellitesLoaded?: (satellites: Satellite[]) => void;
  onSatellitesError?: (message: string) => void;
};

export class Mapper {
  public readonly gl: WebGL2RenderingContext;
  private readonly options: MapperOptions;
  private readonly satelliteRenderer: SatelliteRenderer;
  private readonly sceneRenderer: SceneRenderer;
  private readonly controls: CameraControls;
  private readonly canvasEl: HTMLCanvasElement;
  private readonly viewMatrix = new Float32Array(16);
  private readonly projectionMatrix = new Float32Array(16);
  private rafId: number | null = null;
  private destroyed = false;
  private preventScroll = (event: WheelEvent) => {
    event.preventDefault();
  };

  constructor(canvas: HTMLCanvasElement, options: MapperOptions = {}) {
    this.options = options;
    this.gl = getGLContext(canvas);
    this.gl.clearColor(0.01, 0.01, 0.1, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);

    this.satelliteRenderer = new SatelliteRenderer(this.gl);
    const overlayCtx = options.overlayCanvas?.getContext('2d') ?? null;
    this.sceneRenderer = new SceneRenderer(
      this.gl,
      this.satelliteRenderer,
      options.onHoverChange,
      overlayCtx,
      options.onSelectChange,
    );

    this.controls = new CameraControls(canvas);
    this.canvasEl = this.gl.canvas as HTMLCanvasElement;

    this.canvasEl.addEventListener('mousemove', this.handleMouseMove);
    this.canvasEl.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvasEl.addEventListener('mouseup', this.handleClick);
    document.addEventListener('wheel', this.preventScroll, { passive: false });

    this.loadSatellites();
  }

  start() {
    if (this.destroyed || this.rafId !== null) {
      return;
    }
    this.rafId = window.requestAnimationFrame(this.render);
  }

  stop() {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.stop();
    this.canvasEl.removeEventListener('mousemove', this.handleMouseMove);
    this.canvasEl.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvasEl.removeEventListener('mouseup', this.handleClick);
    document.removeEventListener('wheel', this.preventScroll);
    this.sceneRenderer.destroy();
    this.destroyed = true;
  }

  selectSatellite(id: number | null) {
    this.sceneRenderer.setSelectedSatellite(id);
  }

  setOverlayContext(ctx: CanvasRenderingContext2D | null) {
    this.sceneRenderer.setOverlayContext(ctx);
  }

  getSatellites(): Satellite[] {
    return this.satelliteRenderer.getSatellites();
  }

  private loadSatellites() {
    fetchSatellitesFromApi()
      .then((loaded) => {
        this.satelliteRenderer.setSatellites(loaded);
        this.options.onSatellitesLoaded?.(loaded);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load satellites';
        this.options.onSatellitesError?.(message);
      });
  }

  private setPointerFromEvent = (event: MouseEvent) => {
    const rect = this.canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (event.clientX - rect.left) * dpr;
    const y = (event.clientY - rect.top) * dpr;
    this.sceneRenderer.setPointer({ x, y });
  };

  private handleMouseMove = (event: MouseEvent) => {
    this.setPointerFromEvent(event);
  };

  private handleMouseLeave = () => {
    this.sceneRenderer.setPointer(null);
  };

  private handleClick = (event: MouseEvent) => {
    this.setPointerFromEvent(event);
    if (!this.controls.isDragging) {
      this.sceneRenderer.selectHoveredSatellite();
    }
  };

  private render = (timeMs: number) => {
    setSizedCanvas(this.gl);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    const aspect = this.gl.canvas.width / this.gl.canvas.height;
    makePerspectiveMatrix(this.projectionMatrix, (60 * Math.PI) / 180, aspect, 0.1, 100);

    this.controls.update();

    const eye = this.controls.getEyePosition();
    const target = { x: 0, y: 0, z: 0 };
    makeLookAtMatrix(this.viewMatrix, eye, target);

    this.sceneRenderer.render(this.viewMatrix, this.projectionMatrix, timeMs, eye);
    this.rafId = window.requestAnimationFrame(this.render);
  };
}
