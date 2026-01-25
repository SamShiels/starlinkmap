import { mat4, vec4 } from 'gl-matrix';
import { Satellite } from './satellite';
import { EarthRenderer } from './earthRenderer';
import { SatelliteRenderer } from './satelliteRenderer';
import { OrbitRenderer } from './orbitRenderer';
import { OverlayLabels } from './screen/overlayLabels';

export class SceneRenderer {
  private _gl: WebGL2RenderingContext;
  private _earthRenderer: EarthRenderer;
  private _satelliteRenderer: SatelliteRenderer;
  private _orbitRenderer: OrbitRenderer;
  private _overlayLabels: OverlayLabels | null = null;
  private _satellites: Satellite[];
  private _lastTime = 0;
  private _pointer: { x: number; y: number } | null = null;
  private _hoveredId: number | null = null;
  private _selectedSatelliteId: number | null = null;
  private _viewProj = mat4.create();
  private _tempVec4 = vec4.create();
  private _onHoverChange?: (name: string | null) => void;
  private _onSelectChange?: (satellite: Satellite | null) => void;
  private readonly _earthRadius = 0.7;
  private readonly _orbitSegments = 128;

  constructor(
    gl: WebGL2RenderingContext,
    satelliteRenderer: SatelliteRenderer,
    onHoverChange?: (name: string | null) => void,
    overlayCtx?: CanvasRenderingContext2D | null,
    onSelectChange?: (satellite: Satellite | null) => void,
  ) {
    this._gl = gl;
    this._satelliteRenderer = satelliteRenderer;
    this._satellites = satelliteRenderer.getSatellites();
    this._earthRenderer = new EarthRenderer(gl);
    this._orbitRenderer = new OrbitRenderer(gl);
    this._overlayLabels = overlayCtx ? new OverlayLabels(overlayCtx) : null;
    this._onHoverChange = onHoverChange;
    this._onSelectChange = onSelectChange;
  }

  public setPointer(position: { x: number; y: number } | null) {
    this._pointer = position;
  }

  public setOverlayContext(ctx: CanvasRenderingContext2D | null) {
    if (!ctx) {
      this._overlayLabels = null;
      return;
    }
    if (this._overlayLabels) {
      this._overlayLabels.setContext(ctx);
    } else {
      this._overlayLabels = new OverlayLabels(ctx);
    }
  }

  public render(
    viewMatrix: Float32Array,
    projectionMatrix: Float32Array,
    currentTime: number,
    eye: { x: number; y: number; z: number },
  ) {
    const dt = (currentTime - this._lastTime) / 1000; // seconds
    this._lastTime = currentTime;

    // Update satellites
    for (const sat of this._satellites) {
      sat.update(dt);
    }

    // Render Earth
    this._earthRenderer.render(viewMatrix, projectionMatrix);

    // Render satellites
    this._satelliteRenderer.render(
      viewMatrix,
      projectionMatrix,
      this._selectedSatelliteId,
      this._hoveredId,
    );

    // Render selected orbit
    this._orbitRenderer.render(viewMatrix, projectionMatrix);

    this._overlayLabels?.render(viewMatrix, projectionMatrix, this._satellites, eye, this._selectedSatelliteId);

    this._updateHover(viewMatrix, projectionMatrix, eye);
  }

  public setSelectedSatellite(id: number | null) {
    const previousSelectedId = this._selectedSatelliteId;

    if (id === null) {
      this._selectedSatelliteId = null;
      this._orbitRenderer.clear();
      if (this._onSelectChange && previousSelectedId !== null) {
        this._onSelectChange(null);
      }
      return;
    }

    const sat = this._satellites.find((s) => s.id === id);
    if (!sat) {
      this._selectedSatelliteId = null;
      this._orbitRenderer.clear();
      if (this._onSelectChange && previousSelectedId !== null) {
        this._onSelectChange(null);
      }
      return;
    }

    this._selectedSatelliteId = id;
    const orbitPath = sat.getOrbitalPath(this._orbitSegments);
    this._orbitRenderer.setPath(orbitPath);
    if (this._onSelectChange && previousSelectedId !== this._selectedSatelliteId) {
      this._onSelectChange(sat);
    }
  }

  public selectHoveredSatellite() {
    if (this._hoveredId === null) {
      this.setSelectedSatellite(null);
      return;
    }

    this.setSelectedSatellite(this._hoveredId);
  }

  public destroy() {
    this._earthRenderer.destroy();
    this._satelliteRenderer.destroy();
    this._orbitRenderer.destroy();
    this._overlayLabels?.destroy();
  }

  private _updateHover(
    viewMatrix: Float32Array,
    projectionMatrix: Float32Array,
    eye: { x: number; y: number; z: number },
  ) {
    if (!this._pointer) {
      if (this._hoveredId !== null) {
        this._hoveredId = null;
        this._onHoverChange?.(null);
      }
      return;
    }

    mat4.multiply(this._viewProj, projectionMatrix, viewMatrix);

    const width = this._gl.canvas.width;
    const height = this._gl.canvas.height;
    const pointerX = this._pointer.x;
    const pointerY = this._pointer.y;
    const thresholdPx = 15;
    const thresholdSq = thresholdPx * thresholdPx;

    let closestId: number | null = null;
    let closestName: string | null = null;
    let closestDistSq = Number.POSITIVE_INFINITY;

    for (const sat of this._satellites) {
      if (this._isOccludedByEarth(sat.position, eye)) continue;

      vec4.set(this._tempVec4, sat.position.x, sat.position.y, sat.position.z, 1.0);
      vec4.transformMat4(this._tempVec4, this._tempVec4, this._viewProj);
      const w = this._tempVec4[3];
      if (w <= 0.0) continue; // Behind camera

      const ndcX = this._tempVec4[0] / w;
      const ndcY = this._tempVec4[1] / w;
      if (Math.abs(ndcX) > 1.0 || Math.abs(ndcY) > 1.0) continue;

      const screenX = (ndcX * 0.5 + 0.5) * width;
      const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * height;

      const dx = screenX - pointerX;
      const dy = screenY - pointerY;
      const distSq = dx * dx + dy * dy;

      if (distSq < thresholdSq && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestId = sat.id;
        closestName = sat.name;
      }
    }

    if (closestId !== this._hoveredId) {
      this._hoveredId = closestId;
      this._onHoverChange?.(closestName);
    }
  }

  private _isOccludedByEarth(
    satPos: { x: number; y: number; z: number },
    eye: { x: number; y: number; z: number },
  ): boolean {
    // Segment test from eye to satellite against sphere at origin with radius earthRadius
    const vx = satPos.x - eye.x;
    const vy = satPos.y - eye.y;
    const vz = satPos.z - eye.z;

    const segLenSq = vx * vx + vy * vy + vz * vz;
    if (segLenSq === 0) return false;

    const t = Math.max(0, Math.min(1, -(eye.x * vx + eye.y * vy + eye.z * vz) / segLenSq));
    const closestX = eye.x + vx * t;
    const closestY = eye.y + vy * t;
    const closestZ = eye.z + vz * t;

    const distSq = closestX * closestX + closestY * closestY + closestZ * closestZ;
    return distSq < this._earthRadius * this._earthRadius;
  }
}
