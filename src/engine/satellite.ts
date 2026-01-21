export class Satellite {
  public position: { x: number; y: number; z: number };
  public velocity: { vx: number; vy: number; vz: number };

  constructor(
    position: { x: number; y: number; z: number },
    velocity: { vx: number; vy: number; vz: number }
  ) {
    this.position = { ...position };
    this.velocity = { ...velocity };
  }

  update(dtSeconds: number) {
    // Simple Euler integration: position += velocity * dt
    this.position.x += this.velocity.vx * dtSeconds;
    this.position.y += this.velocity.vy * dtSeconds;
    this.position.z += this.velocity.vz * dtSeconds;
  }
}