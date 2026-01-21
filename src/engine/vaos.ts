export class VertexArray {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, configure: (gl: WebGL2RenderingContext) => void) {
    this.gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO');
    }
    this.vao = vao;

    gl.bindVertexArray(this.vao);
    configure(gl);
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

  destroy() {
    if (this.vao) {
      this.gl.deleteVertexArray(this.vao);
      // @ts-expect-error clear handle
      this.vao = null;
    }
  }
}
