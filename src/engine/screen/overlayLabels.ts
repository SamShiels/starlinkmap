import { mat4, vec3, vec4 } from 'gl-matrix';
import { Satellite } from '../satellite';

export class OverlayLabels {
  private context: CanvasRenderingContext2D;
  private viewProjectionMatrix = mat4.create();
  private clipSpacePosition = vec4.create();

  private readonly _distanceThreshold: number = 0.3;
  // private readonly _centerThresholdNormalizedDeviceCoordinates: number = 0.3;

  constructor(context: CanvasRenderingContext2D) {
    this.context = context;
  }

  render(
    viewMatrix: Float32Array,
    projectionMatrix: Float32Array,
    satellites: Satellite[],
    eye: { x: number; y: number; z: number },
  ) {
    const { canvas } = this.context;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * devicePixelRatio;
    const height = canvas.clientHeight * devicePixelRatio;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    this.context.clearRect(0, 0, canvas.width, canvas.height);
    this.context.textBaseline = 'bottom';
    this.context.textAlign = 'center';
    this.context.font = `${14 * devicePixelRatio}px "Helvetica Neue", Arial, sans-serif`;
    this.context.fillStyle = 'rgba(255,255,255,0.9)';
    this.context.strokeStyle = 'rgba(0,0,0,0.6)';
    this.context.lineWidth = 2 * devicePixelRatio;

    mat4.multiply(this.viewProjectionMatrix, projectionMatrix, viewMatrix);

    const entries: { x: number; y: number; name: string }[] = [];
    const eyeVector = vec3.fromValues(eye.x, eye.y, eye.z);

    for (const satellite of satellites) {
      const satellitePosition = vec3.fromValues(satellite.position.x, satellite.position.y, satellite.position.z);

      if (vec3.sqrDist(satellitePosition, eyeVector) > this._distanceThreshold * this._distanceThreshold) {
        continue;
      }
      vec4.set(this.clipSpacePosition, satellite.position.x, satellite.position.y, satellite.position.z, 1.0);
      vec4.transformMat4(this.clipSpacePosition, this.clipSpacePosition, this.viewProjectionMatrix);
      const clipW = this.clipSpacePosition[3];
      if (clipW <= 0) continue;
      const normalizedDeviceX = this.clipSpacePosition[0] / clipW;
      const normalizedDeviceY = this.clipSpacePosition[1] / clipW;
      if (Math.abs(normalizedDeviceX) > 1 || Math.abs(normalizedDeviceY) > 1) continue;

      // const normalizedDeviceDistanceSquared =
      //   normalizedDeviceX * normalizedDeviceX + normalizedDeviceY * normalizedDeviceY;
      // if (
      //   normalizedDeviceDistanceSquared >
      //   this._centerThresholdNormalizedDeviceCoordinates * this._centerThresholdNormalizedDeviceCoordinates
      // ) {
      //   continue;
      // }

      const screenX = (normalizedDeviceX * 0.5 + 0.5) * canvas.width;
      const screenY = (1 - (normalizedDeviceY * 0.5 + 0.5)) * canvas.height;
      entries.push({ x: screenX, y: screenY, name: satellite.name });
    }

    for (const { x, y, name } of entries) {
      this.context.strokeText(name, x, y - 12 * devicePixelRatio);
      this.context.fillText(name, x, y - 12 * devicePixelRatio);
    }
  }

  destroy() {
    // Nothing to clean for a 2D context, but keep method for parity
  }

  setContext(context: CanvasRenderingContext2D | null) {
    if (context) {
      this.context = context;
    }
  }
}
