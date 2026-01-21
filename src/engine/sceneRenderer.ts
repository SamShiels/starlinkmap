import { Satellite } from './satellite';
import { EarthRenderer } from './earthRenderer';
import { SatelliteRenderer } from './satelliteRenderer';

export class SceneRenderer {
  private gl: WebGL2RenderingContext;
  private earthRenderer: EarthRenderer;
  private satelliteRenderer: SatelliteRenderer;
  private satellites: Satellite[];
  private lastTime = 0;

  constructor(gl: WebGL2RenderingContext, satellites: Satellite[]) {
    this.gl = gl;
    this.satellites = satellites;
    this.earthRenderer = new EarthRenderer(gl);
    this.satelliteRenderer = new SatelliteRenderer(gl, satellites);
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array, currentTime: number) {
    const dt = (currentTime - this.lastTime) / 100; // seconds
    this.lastTime = currentTime;

    // Update satellites
    for (const sat of this.satellites) {
      sat.update(dt);
    }

    // Render Earth
    this.earthRenderer.render(viewMatrix, projectionMatrix);

    // Render satellites
    this.satelliteRenderer.render(viewMatrix, projectionMatrix, this.satellites);
  }

  destroy() {
    this.earthRenderer.destroy();
    this.satelliteRenderer.destroy();
  }
}