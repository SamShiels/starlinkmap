
const SENS = 0.001;
const DAMPING = 0.8;
const DRAG_THRESHOLD_PX = 3;

export class CameraControls {
  private canvas: HTMLCanvasElement;

  public theta = 0; // azimuthal angle
  public phi = 0; // polar angle
  public radius = 2;

  private thetaSmooth = 0;
  private phiSmooth = 0;
  private radiusSmooth = 0;

  private _mouseDown = false;
  private _isDragging = false;
  private _lastMouseX = 0;
  private _lastMouseY = 0;

  public get isDragging(): boolean {
    return this._isDragging;
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', (event) => {
      this._mouseDown = true;
      this._isDragging = false;
      this._lastMouseX = event.clientX;
      this._lastMouseY = event.clientY;
      event.preventDefault();
    });

    this.canvas.addEventListener('mousemove', (event) => {
      if (!this._mouseDown) return;

      const deltaX = event.clientX - this._lastMouseX;
      const deltaY = event.clientY - this._lastMouseY;

      if (!this._isDragging) {
        const distSq = deltaX * deltaX + deltaY * deltaY;
        if (distSq < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
        this._isDragging = true;
      }

      const sensitivity = SENS;
      this.thetaSmooth += deltaX * sensitivity;
      this.phiSmooth += deltaY * sensitivity;
      this._lastMouseX = event.clientX;
      this._lastMouseY = event.clientY;
      event.preventDefault();
    });

    this.canvas.addEventListener('mouseup', () => {
      this._mouseDown = false;
      this._isDragging = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this._mouseDown = false;
      this._isDragging = false;
    });

    this.canvas.addEventListener('wheel', (event) => {
      const zoomSensitivity = SENS;
      this.radiusSmooth += event.deltaY * zoomSensitivity;
      event.preventDefault();
    });
  }

  public update() {
    this.theta += this.thetaSmooth;
    this.phi += this.phiSmooth;
    this.radius += this.radiusSmooth;

    this.thetaSmooth *= DAMPING;
    this.phiSmooth *= DAMPING;
    this.radiusSmooth *= DAMPING;

    // Clamp phi and radius to avoid flipping/extremes
    this.phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.phi));
    this.radius = Math.max(1.0, Math.min(10, this.radius));
  }
}
