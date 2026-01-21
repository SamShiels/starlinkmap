
const SENS = 0.001;
const DAMPING = 0.8;

export class CameraControls {
  private canvas: HTMLCanvasElement;

  public theta = 0; // azimuthal angle
  public phi = 0; // polar angle
  public radius = 2;

  private thetaSmooth = 0;
  private phiSmooth = 0;
  private radiusSmooth = 0;

  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', (event) => {
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      event.preventDefault();
    });

    this.canvas.addEventListener('mousemove', (event) => {
      if (this.isDragging) {
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        const sensitivity = SENS;
        this.thetaSmooth += deltaX * sensitivity;
        this.phiSmooth += deltaY * sensitivity;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        event.preventDefault();
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
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