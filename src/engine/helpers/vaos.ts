export class VertexArray {
  private _gl: WebGL2RenderingContext;
  private _vao: WebGLVertexArrayObject | null;
  private _offsetBytes = 0;

  constructor(
    gl: WebGL2RenderingContext,
    configure: (vao: VertexArray, gl: WebGL2RenderingContext) => void,
  ) {
    this._gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO');
    }
    this._vao = vao;

    gl.bindVertexArray(this._vao);
    configure(this, gl);
    gl.bindVertexArray(null);
  }

  public get handle(): WebGLVertexArrayObject {
    if (!this._vao) {
      throw new Error('VAO has been destroyed');
    }
    return this._vao;
  }

  public bind() {
    this._gl.bindVertexArray(this._vao);
  }

  public unbind() {
    this._gl.bindVertexArray(null);
  }

  public addPointer({
    location,
    size,
    stride,
    type = this._gl.FLOAT,
    normalized = false,
  }: {
    location: number;
    size: number;
    stride: number;
    type?: number;
    normalized?: boolean;
  }) {
    this._gl.enableVertexAttribArray(location);
    this._gl.vertexAttribPointer(location, size, type, normalized, stride, this._offsetBytes);
    this._offsetBytes += size * this._bytesPerType(type);
  }

  private _bytesPerType(type: number): number {
    switch (type) {
      case this._gl.FLOAT:
      case this._gl.INT:
      case this._gl.UNSIGNED_INT:
        return 4;
      case this._gl.SHORT:
      case this._gl.UNSIGNED_SHORT:
        return 2;
      case this._gl.BYTE:
      case this._gl.UNSIGNED_BYTE:
        return 1;
      default:
        throw new Error(`Unsupported attribute type: ${type}`);
    }
  }

  public destroy() {
    if (this._vao) {
      this._gl.deleteVertexArray(this._vao);
      this._vao = null;
    }
  }
}
