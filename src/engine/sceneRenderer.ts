import { Satellite } from './satellite';
import { EarthRenderer } from './earthRenderer';
import { SatelliteRenderer } from './satelliteRenderer';
import { OrbitRenderer } from './orbitRenderer';

export class SceneRenderer {
  private gl: WebGL2RenderingContext;
  private earthRenderer: EarthRenderer;
  private satelliteRenderer: SatelliteRenderer;
  private orbitRenderer: OrbitRenderer;
  private satellites: Satellite[];
  private lastTime = 0;
  private pointer: { x: number; y: number } | null = null;
  private hoveredId: number | null = null;
  private selectedSatelliteId: number | null = null;
  private viewProj = new Float32Array(16);
  private onHoverChange?: (name: string | null) => void;
  private readonly earthRadius = 0.7;
  private readonly orbitSegments = 128;

  constructor(gl: WebGL2RenderingContext, satellites: Satellite[], onHoverChange?: (name: string | null) => void) {
    this.gl = gl;
    this.satellites = satellites;
    this.earthRenderer = new EarthRenderer(gl);
    this.satelliteRenderer = new SatelliteRenderer(gl, satellites);
    this.orbitRenderer = new OrbitRenderer(gl);
    this.onHoverChange = onHoverChange;
  }

  setPointer(position: { x: number; y: number } | null) {
    this.pointer = position;
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
    const orbitPath = sat.getOrbitPath(this.orbitSegments);
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

    this.multiplyMat4(this.viewProj, projectionMatrix, viewMatrix);

    const width = this.gl.canvas.width;
    const height = this.gl.canvas.height;
    const pointerX = this.pointer.x;
    const pointerY = this.pointer.y;
    const thresholdPx = 12;
    const thresholdSq = thresholdPx * thresholdPx;

    let closestId: number | null = null;
    let closestName: string | null = null;
    let closestDistSq = Number.POSITIVE_INFINITY;

    for (const sat of this.satellites) {
      if (this.isOccludedByEarth(sat.position, eye)) continue;

      const clip = this.transformPoint(this.viewProj, sat.position);
      if (clip.w <= 0.0) continue; // Behind camera

      const ndcX = clip.x / clip.w;
      const ndcY = clip.y / clip.w;
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

  private transformPoint(
    m: Float32Array,
    v: { x: number; y: number; z: number },
  ): { x: number; y: number; z: number; w: number } {
    return {
      x: m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12],
      y: m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13],
      z: m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14],
      w: m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15],
    };
  }

  private multiplyMat4(out: Float32Array, a: Float32Array, b: Float32Array) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
    const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
    const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
    const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

    out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

    out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

    out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

    out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
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
