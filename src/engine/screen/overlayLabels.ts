import { mat4, vec3, vec4 } from 'gl-matrix';
import { Satellite } from '../satellite';

export class OverlayLabels {
  private ctx: CanvasRenderingContext2D;
  private viewProj = mat4.create();
  private clip = vec4.create();

  private readonly _distanceThreshold: number = 0.4;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(view: Float32Array, proj: Float32Array, satellites: Satellite[], eye: { x: number, y: number, z: number }) {
    const { canvas } = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.textBaseline = 'bottom';
    this.ctx.textAlign = 'center';
    this.ctx.font = `${14 * dpr}px "Helvetica Neue", Arial, sans-serif`;
    this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
    this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    this.ctx.lineWidth = 2 * dpr;

    mat4.multiply(this.viewProj, proj, view);

    const entries: { x: number; y: number; name: string }[] = [];
    const eyeVec = vec3.fromValues(eye.x, eye.y, eye.z);

    for (const sat of satellites) {
      const satPosition = vec3.fromValues(sat.position.x, sat.position.y, sat.position.z);

      if (vec3.sqrDist(satPosition, eyeVec) > Math.pow(this._distanceThreshold, 2)) {
        continue;
      }
      vec4.set(this.clip, sat.position.x, sat.position.y, sat.position.z, 1.0);
      vec4.transformMat4(this.clip, this.clip, this.viewProj);
      const w = this.clip[3];
      if (w <= 0) continue;
      const ndcX = this.clip[0] / w;
      const ndcY = this.clip[1] / w;
      if (Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1) continue;
      const sx = (ndcX * 0.5 + 0.5) * canvas.width;
      const sy = (1 - (ndcY * 0.5 + 0.5)) * canvas.height;
      entries.push({ x: sx, y: sy, name: sat.name });
    }

    for (const { x, y, name } of entries) {
      this.ctx.strokeText(name, x, y - 12 * dpr);
      this.ctx.fillText(name, x, y - 12 * dpr);
    }
  }

  destroy() {
    // Nothing to clean for a 2D context, but keep method for parity
  }

  setContext(ctx: CanvasRenderingContext2D | null) {
    if (ctx) {
      this.ctx = ctx;
    }
  }
}
