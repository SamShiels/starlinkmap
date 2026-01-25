import { mat4, vec4 } from 'gl-matrix';
import { Satellite } from './satellite';
import { EarthRenderer } from './earthRenderer';
import { SatelliteRenderer } from './satelliteRenderer';
import { OrbitRenderer } from './orbitRenderer';
import { OverlayLabels } from './screen/overlayLabels';

export class SceneRenderer {
  private gl: WebGL2RenderingContext;
  private earthRenderer: EarthRenderer;
  private satelliteRenderer: SatelliteRenderer;
  private orbitRenderer: OrbitRenderer;
  private overlayLabels: OverlayLabels | null = null;
  private satellites: Satellite[];
  private lastTime = 0;
  private pointer: { x: number; y: number } | null = null;
  private hoveredId: number | null = null;
  private selectedSatelliteId: number | null = null;
  private viewProj = mat4.create();
  private tempVec4 = vec4.create();
  private onHoverChange?: (name: string | null) => void;
  private readonly earthRadius = 0.7;
  private readonly orbitSegments = 128;

  constructor(
    gl: WebGL2RenderingContext,
    satellites: Satellite[],
    onHoverChange?: (name: string | null) => void,
    overlayCtx?: CanvasRenderingContext2D | null,
  ) {
    this.gl = gl;
    this.satellites = satellites;
    this.earthRenderer = new EarthRenderer(gl);
    this.satelliteRenderer = new SatelliteRenderer(gl, satellites);
    this.orbitRenderer = new OrbitRenderer(gl);
    this.overlayLabels = overlayCtx ? new OverlayLabels(overlayCtx) : null;
    this.onHoverChange = onHoverChange;
  }

  setPointer(position: { x: number; y: number } | null) {
    this.pointer = position;
  }

  setOverlayContext(ctx: CanvasRenderingContext2D | null) {
    if (!ctx) {
      this.overlayLabels = null;
      return;
    }
    if (this.overlayLabels) {
      this.overlayLabels.setContext(ctx);
    } else {
      this.overlayLabels = new OverlayLabels(ctx);
    }
  }

  render(
    viewMatrix: Float32Array,
    projectionMatrix: Float32Array,
    currentTime: number,
    eye: { x: number; y: number; z: number },
  ) {
    const dt = (currentTime - this.lastTime) / 1000; // seconds
    this.lastTime = currentTime;

    // Update satellites
    for (const sat of this.satellites) {
      sat.update(dt);
    }

    // Render Earth
    this.earthRenderer.render(viewMatrix, projectionMatrix);

    // Render satellites
    this.satelliteRenderer.render(viewMatrix, projectionMatrix, this.satellites);

    // Render selected orbit
    this.orbitRenderer.render(viewMatrix, projectionMatrix);

    this.overlayLabels?.render(viewMatrix, projectionMatrix, this.satellites, eye);

    this.updateHover(viewMatrix, projectionMatrix, eye);
  }

  setSelectedSatellite(id: number | null) {
    if (id === null) {
      this.selectedSatelliteId = null;
      this.orbitRenderer.clear();
      return;
    }

    const sat = this.satellites.find((s) => s.id === id);
    if (!sat) {
      this.selectedSatelliteId = null;
      this.orbitRenderer.clear();
      return;
    }

    this.selectedSatelliteId = id;
    const orbitPath = sat.getOrbitalPath(this.orbitSegments);
    this.orbitRenderer.setPath(orbitPath);
  }

  selectHoveredSatellite() {
    if (this.hoveredId === null) {
      this.setSelectedSatellite(null);
      return;
    }

    this.setSelectedSatellite(this.hoveredId);
  }

  destroy() {
    this.earthRenderer.destroy();
    this.satelliteRenderer.destroy();
    this.orbitRenderer.destroy();
    this.overlayLabels?.destroy();
  }

  private updateHover(
    viewMatrix: Float32Array,
    projectionMatrix: Float32Array,
    eye: { x: number; y: number; z: number },
  ) {
    if (!this.pointer) {
      if (this.hoveredId !== null) {
        this.hoveredId = null;
        this.onHoverChange?.(null);
      }
      return;
    }

    mat4.multiply(this.viewProj, projectionMatrix, viewMatrix);

    const width = this.gl.canvas.width;
    const height = this.gl.canvas.height;
    const pointerX = this.pointer.x;
    const pointerY = this.pointer.y;
    const thresholdPx = 15;
    const thresholdSq = thresholdPx * thresholdPx;

    let closestId: number | null = null;
    let closestName: string | null = null;
    let closestDistSq = Number.POSITIVE_INFINITY;

    for (const sat of this.satellites) {
      if (this.isOccludedByEarth(sat.position, eye)) continue;

      vec4.set(this.tempVec4, sat.position.x, sat.position.y, sat.position.z, 1.0);
      vec4.transformMat4(this.tempVec4, this.tempVec4, this.viewProj);
      const w = this.tempVec4[3];
      if (w <= 0.0) continue; // Behind camera

      const ndcX = this.tempVec4[0] / w;
      const ndcY = this.tempVec4[1] / w;
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

    if (closestId !== this.hoveredId) {
      this.hoveredId = closestId;
      this.onHoverChange?.(closestName);
    }
  }

  private isOccludedByEarth(
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
    return distSq < this.earthRadius * this.earthRadius;
  }
}
