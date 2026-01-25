export class Satellite {
  private _id: number;
  private _name: string;
  private _initialPosition: { x: number; y: number; z: number };
  private _position: { x: number; y: number; z: number };
  private _velocity: { x: number; y: number; z: number };
  private _orbitNormal: { x: number; y: number; z: number };
  private _orbitRadius: number;
  private _angularSpeed: number;

  public get id(): number {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public get initialPosition(): { x: number; y: number; z: number } {
    return this._initialPosition;
  }

  public get position(): { x: number; y: number; z: number } {
    return this._position;
  }

  public get velocity(): { x: number; y: number; z: number } {
    return this._velocity;
  }

  constructor(
    id: number,
    name: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    angularVelocityRadPerS: number
  ) {
    this._id = id;
    this._name = name;
    this._initialPosition = { ...position };
    this._position = { ...position };
    this._velocity = { ...velocity };

    this._orbitRadius = Math.hypot(position.x, position.y, position.z);
    let orbitNormal = this._normalize(this._cross(position, velocity));
    if (orbitNormal.x === 0 && orbitNormal.y === 0 && orbitNormal.z === 0) {
      orbitNormal = { x: 0, y: 1, z: 0 };
    }
    this._orbitNormal = orbitNormal;
    this._angularSpeed = angularVelocityRadPerS;
  }

  public update(dtSeconds: number) {
    if (this._orbitRadius === 0 || this._angularSpeed === 0) {
      // Fallback to linear motion if orbit parameters are invalid
      this._position.x += this._velocity.x * dtSeconds;
      this._position.y += this._velocity.y * dtSeconds;
      this._position.z += this._velocity.z * dtSeconds;
      return;
    }

    const angle = this._angularSpeed * dtSeconds;
    const axis = this._orbitNormal;

    // Rotate current position around orbit normal to advance along the orbit
    const rotated = this._rotateAroundAxis(this._position, axis, angle);
    this._position = rotated;

    // Velocity is tangential: ω × r (axis is unit length)
    const tangent = this._cross(axis, rotated);
    const speedScale = this._angularSpeed;
    this._velocity = {
      x: tangent.x * speedScale,
      y: tangent.y * speedScale,
      z: tangent.z * speedScale,
    };
  }

  public getOrbitalPath(points: number): { x: number; y: number; z: number }[] {
    const positions = [];
    const axis = this._orbitNormal;

    for (let i = 0; i < points; i++) {
      const theta = i / points * Math.PI * 2;
      const tiltedPoint = this._rotateAroundAxis(this._initialPosition, axis, theta);

      positions.push(tiltedPoint);
    }

    return positions;
  }

  private _cross(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  private _normalize(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const len = Math.hypot(v.x, v.y, v.z);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  private _rotateAroundAxis(
    v: { x: number; y: number; z: number },
    axis: { x: number; y: number; z: number },
    angle: number
  ): { x: number; y: number; z: number } {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const dot = v.x * axis.x + v.y * axis.y + v.z * axis.z;
    const cross = this._cross(axis, v);

    return {
      x: v.x * cosA + cross.x * sinA + axis.x * dot * (1.0 - cosA),
      y: v.y * cosA + cross.y * sinA + axis.y * dot * (1.0 - cosA),
      z: v.z * cosA + cross.z * sinA + axis.z * dot * (1.0 - cosA),
    };
  }
}
