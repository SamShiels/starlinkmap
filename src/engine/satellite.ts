export class Satellite {
  public position: { x: number; y: number; z: number };
  public velocity: { x: number; y: number; z: number };
  private orbitNormal: { x: number; y: number; z: number };
  private orbitRadius: number;
  private angularSpeed: number;

  constructor(
    position: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    angularVelocityRadPerS: number
  ) {
    this.position = { ...position };
    this.velocity = { ...velocity };

    this.orbitRadius = Math.hypot(position.x, position.y, position.z);
    let orbitNormal = this.normalize(this.cross(position, velocity));
    if (orbitNormal.x === 0 && orbitNormal.y === 0 && orbitNormal.z === 0) {
      orbitNormal = { x: 0, y: 1, z: 0 };
    }
    this.orbitNormal = orbitNormal;
    this.angularSpeed = angularVelocityRadPerS;
  }

  update(dtSeconds: number) {
    if (this.orbitRadius === 0 || this.angularSpeed === 0) {
      // Fallback to linear motion if orbit parameters are invalid
      this.position.x += this.velocity.x * dtSeconds;
      this.position.y += this.velocity.y * dtSeconds;
      this.position.z += this.velocity.z * dtSeconds;
      return;
    }

    const angle = this.angularSpeed * dtSeconds;
    const axis = this.orbitNormal;

    // Rotate current position around orbit normal to advance along the orbit
    const rotated = this.rotateAroundAxis(this.position, axis, angle);
    this.position = rotated;

    // Velocity is tangential: ω × r (axis is unit length)
    const tangent = this.cross(axis, rotated);
    const speedScale = this.angularSpeed;
    this.velocity = {
      x: tangent.x * speedScale,
      y: tangent.y * speedScale,
      z: tangent.z * speedScale,
    };
  }

  private cross(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  private normalize(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const len = Math.hypot(v.x, v.y, v.z);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  private rotateAroundAxis(
    v: { x: number; y: number; z: number },
    axis: { x: number; y: number; z: number },
    angle: number
  ): { x: number; y: number; z: number } {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const dot = v.x * axis.x + v.y * axis.y + v.z * axis.z;
    const cross = this.cross(axis, v);

    return {
      x: v.x * cosA + cross.x * sinA + axis.x * dot * (1.0 - cosA),
      y: v.y * cosA + cross.y * sinA + axis.y * dot * (1.0 - cosA),
      z: v.z * cosA + cross.z * sinA + axis.z * dot * (1.0 - cosA),
    };
  }
}
