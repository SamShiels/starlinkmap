export class VertexArray {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private offsetBytes = 0;

  constructor(
    gl: WebGL2RenderingContext,
    configure: (vao: VertexArray, gl: WebGL2RenderingContext) => void,
  ) {
    this.gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO');
    }
    this.vao = vao;

    gl.bindVertexArray(this.vao);
    configure(this, gl);
    gl.bindVertexArray(null);
  }

  get handle(): WebGLVertexArrayObject {
    return this.vao;
  }

  bind() {
    this.gl.bindVertexArray(this.vao);
  }

  unbind() {
    this.gl.bindVertexArray(null);
  }

  addPointer({
    location,
    size,
    stride,
    type = this.gl.FLOAT,
    normalized = false,
  }: {
    location: number;
    size: number;
    stride: number;
    type?: number;
    normalized?: boolean;
  }) {
    this.gl.enableVertexAttribArray(location);
    this.gl.vertexAttribPointer(location, size, type, normalized, stride, this.offsetBytes);
    this.offsetBytes += size * this.bytesPerType(type);
  }

  private bytesPerType(type: number): number {
    switch (type) {
      case this.gl.FLOAT:
      case this.gl.INT:
      case this.gl.UNSIGNED_INT:
        return 4;
      case this.gl.SHORT:
      case this.gl.UNSIGNED_SHORT:
        return 2;
      case this.gl.BYTE:
      case this.gl.UNSIGNED_BYTE:
        return 1;
      default:
        throw new Error(`Unsupported attribute type: ${type}`);
    }
  }

  destroy() {
    if (this.vao) {
      this.gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
  }
}
