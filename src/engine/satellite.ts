export class Satellite {
  public position: { x: number; y: number; z: number };
  public velocity: { vx: number; vy: number; vz: number };

  private angle = 0;
  private orbitalRadius: number;
  private angularVelocity: number;

  constructor(
    orbitalRadius: number,
    angularVelocity: number,
    initialAngle = 0
  ) {
    this.orbitalRadius = orbitalRadius;
    this.angularVelocity = angularVelocity;
    this.angle = initialAngle;

    this.updatePositionAndVelocity();
  }

  private updatePositionAndVelocity() {
    this.position = {
      x: this.orbitalRadius * Math.cos(this.angle),
      y: 0,
      z: this.orbitalRadius * Math.sin(this.angle),
    };

    this.velocity = {
      vx: -this.orbitalRadius * this.angularVelocity * Math.sin(this.angle),
      vy: 0,
      vz: this.orbitalRadius * this.angularVelocity * Math.cos(this.angle),
    };
  }

  update(dtSeconds: number) {
    this.angle += this.angularVelocity * dtSeconds;
    this.updatePositionAndVelocity();
  }
}