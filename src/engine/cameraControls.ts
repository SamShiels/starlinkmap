
const SENS = 0.001;
const DAMPING = 0.8;
const DRAG_THRESHOLD_PX = 3;

export class CameraControls {
  private _canvas: HTMLCanvasElement;

  public theta = 0; // azimuthal angle
  public phi = 0; // polar angle
  public radius = 2;

  private _thetaSmooth = 0;
  private _phiSmooth = 0;
  private _radiusSmooth = 0;

  private _mouseDown = false;
  private _isDragging = false;
  private _lastMouseX = 0;
  private _lastMouseY = 0;
  private _touchMode: 'none' | 'rotate' | 'pinch' = 'none';
  private _lastTouchDistance = 0;

  public get isDragging(): boolean {
    return this._isDragging;
  }

  public get isPinching(): boolean {
    return this._touchMode === 'pinch';
  }

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._setupEventListeners();
  }

  private _setupEventListeners() {
    this._canvas.addEventListener('mousedown', (event) => {
      this._mouseDown = true;
      this._isDragging = false;
      this._lastMouseX = event.clientX;
      this._lastMouseY = event.clientY;
      event.preventDefault();
    });

    this._canvas.addEventListener('mousemove', (event) => {
      if (!this._mouseDown) return;

      const deltaX = event.clientX - this._lastMouseX;
      const deltaY = event.clientY - this._lastMouseY;

      if (!this._isDragging) {
        const distSq = deltaX * deltaX + deltaY * deltaY;
        if (distSq < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
        this._isDragging = true;
      }

      const sensitivity = SENS;
      this._thetaSmooth += deltaX * sensitivity;
      this._phiSmooth += deltaY * sensitivity;
      this._lastMouseX = event.clientX;
      this._lastMouseY = event.clientY;
      event.preventDefault();
    });

    this._canvas.addEventListener('mouseup', () => {
      this._mouseDown = false;
      this._isDragging = false;
    });

    this._canvas.addEventListener('mouseleave', () => {
      this._mouseDown = false;
      this._isDragging = false;
    });

    this._canvas.addEventListener('wheel', (event) => {
      const zoomSensitivity = SENS;
      this._radiusSmooth += event.deltaY * zoomSensitivity;
      event.preventDefault();
    });

    this._canvas.addEventListener(
      'touchstart',
      (event) => {
        if (event.touches.length === 1) {
          const touch = event.touches[0];
          this._touchMode = 'rotate';
          this._mouseDown = true;
          this._isDragging = false;
          this._lastMouseX = touch.clientX;
          this._lastMouseY = touch.clientY;
        } else if (event.touches.length >= 2) {
          this._touchMode = 'pinch';
          this._mouseDown = false;
          this._isDragging = false;
          this._lastTouchDistance = -this._touchDistance(event.touches[0], event.touches[1]);
        }
        event.preventDefault();
      },
      { passive: false },
    );

    this._canvas.addEventListener(
      'touchmove',
      (event) => {
        if (this._touchMode === 'rotate' && event.touches.length === 1) {
          const touch = event.touches[0];
          const deltaX = touch.clientX - this._lastMouseX;
          const deltaY = touch.clientY - this._lastMouseY;

          if (!this._isDragging) {
            const distSq = deltaX * deltaX + deltaY * deltaY;
            if (distSq >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
              this._isDragging = true;
            }
          }

          const sensitivity = SENS;
          this._thetaSmooth += deltaX * sensitivity;
          this._phiSmooth += deltaY * sensitivity;
          this._lastMouseX = touch.clientX;
          this._lastMouseY = touch.clientY;
        } else if (this._touchMode === 'pinch' && event.touches.length >= 2) {
          const distance = this._touchDistance(event.touches[0], event.touches[1]);
          const delta = distance - this._lastTouchDistance;
          const zoomSensitivity = SENS * 0.5;
          this._radiusSmooth += delta * zoomSensitivity;
          this._lastTouchDistance = distance;
        }
        event.preventDefault();
      },
      { passive: false },
    );

    const endTouch = () => {
      this._touchMode = 'none';
      this._mouseDown = false;
      this._isDragging = false;
      this._lastTouchDistance = 0;
    };

    this._canvas.addEventListener('touchend', endTouch);
    this._canvas.addEventListener('touchcancel', endTouch);
  }

  public update() {
    this.theta += this._thetaSmooth;
    this.phi += this._phiSmooth;
    this.radius += this._radiusSmooth;

    this._thetaSmooth *= DAMPING;
    this._phiSmooth *= DAMPING;
    this._radiusSmooth *= DAMPING;

    // Clamp phi and radius to avoid flipping/extremes
    this.phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.phi));
    this.radius = Math.max(0.9, Math.min(10, this.radius));
  }

  public getEyePosition(): { x: number; y: number; z: number } {
    return {
      x: this.radius * Math.cos(this.phi) * Math.cos(this.theta),
      y: this.radius * Math.sin(this.phi),
      z: this.radius * Math.cos(this.phi) * Math.sin(this.theta),
    };
  }

  private _touchDistance(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }
}
