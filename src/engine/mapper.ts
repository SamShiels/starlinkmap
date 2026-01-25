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
  private readonly _options: MapperOptions;
  private readonly _satelliteRenderer: SatelliteRenderer;
  private readonly _sceneRenderer: SceneRenderer;
  private readonly _controls: CameraControls;
  private readonly _canvasEl: HTMLCanvasElement;
  private readonly _viewMatrix = new Float32Array(16);
  private readonly _projectionMatrix = new Float32Array(16);
  private _rafId: number | null = null;
  private _destroyed = false;
  private _preventScroll = (event: WheelEvent) => {
    event.preventDefault();
  };

  constructor(canvas: HTMLCanvasElement, options: MapperOptions = {}) {
    this._options = options;
    this.gl = getGLContext(canvas);
    this.gl.clearColor(0.01, 0.01, 0.1, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);

    this._satelliteRenderer = new SatelliteRenderer(this.gl);
    const overlayCtx = options.overlayCanvas?.getContext('2d') ?? null;
    this._sceneRenderer = new SceneRenderer(
      this.gl,
      this._satelliteRenderer,
      options.onHoverChange,
      overlayCtx,
      options.onSelectChange,
    );

    this._canvasEl = this.gl.canvas as HTMLCanvasElement;

    this._canvasEl.addEventListener('mousemove', this._handleMouseMove);
    this._canvasEl.addEventListener('mouseleave', this._handleMouseLeave);
    this._canvasEl.addEventListener('mouseup', this._handleClick);
    document.addEventListener('wheel', this._preventScroll, { passive: false });

    this._loadSatellites();
    this._controls = new CameraControls(canvas);
  }

  public start() {
    if (this._destroyed || this._rafId !== null) {
      return;
    }
    this._rafId = window.requestAnimationFrame(this._render);
  }

  public stop() {
    if (this._rafId !== null) {
      window.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  public destroy() {
    if (this._destroyed) {
      return;
    }
    this.stop();
    this._canvasEl.removeEventListener('mousemove', this._handleMouseMove);
    this._canvasEl.removeEventListener('mouseleave', this._handleMouseLeave);
    this._canvasEl.removeEventListener('mouseup', this._handleClick);
    document.removeEventListener('wheel', this._preventScroll);
    this._sceneRenderer.destroy();
    this._destroyed = true;
  }

  public selectSatellite(id: number | null) {
    this._sceneRenderer.setSelectedSatellite(id);
  }

  public setOverlayContext(ctx: CanvasRenderingContext2D | null) {
    this._sceneRenderer.setOverlayContext(ctx);
  }

  public getSatellites(): Satellite[] {
    return this._satelliteRenderer.getSatellites();
  }

  private _loadSatellites() {
    fetchSatellitesFromApi(undefined, (partial) => {
      this._satelliteRenderer.setSatellites(partial);
    })
      .then((loaded) => {
      this._satelliteRenderer.setSatellites(loaded);
      this._options.onSatellitesLoaded?.(loaded);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load satellites';
        this._options.onSatellitesError?.(message);
      });
  }

  private _setPointerFromEvent = (event: MouseEvent) => {
    const rect = this._canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (event.clientX - rect.left) * dpr;
    const y = (event.clientY - rect.top) * dpr;
    this._sceneRenderer.setPointer({ x, y });
  };

  private _handleMouseMove = (event: MouseEvent) => {
    this._setPointerFromEvent(event);
  };

  private _handleMouseLeave = () => {
    this._sceneRenderer.setPointer(null);
  };

  private _handleClick = (event: MouseEvent) => {
    this._setPointerFromEvent(event);
    if (!this._controls.isDragging) {
      this._sceneRenderer.selectHoveredSatellite();
    }
  };

  private _render = (timeMs: number) => {
    setSizedCanvas(this.gl);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    const aspect = this.gl.canvas.width / this.gl.canvas.height;
    makePerspectiveMatrix(this._projectionMatrix, (60 * Math.PI) / 180, aspect, 0.1, 100);

    this._controls.update();

    const eye = this._controls.getEyePosition();
    const target = { x: 0, y: 0, z: 0 };
    makeLookAtMatrix(this._viewMatrix, eye, target);

    this._sceneRenderer.render(this._viewMatrix, this._projectionMatrix, timeMs, eye);
    this._rafId = window.requestAnimationFrame(this._render);
  };
}
