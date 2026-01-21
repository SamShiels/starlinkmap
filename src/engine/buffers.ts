type BufferTarget = 'vertex' | 'index';

export class GLBuffer {
  private gl: WebGL2RenderingContext;
  private buffer: WebGLBuffer;
  private target: number;

  constructor(
    gl: WebGL2RenderingContext,
    data: BufferSource,
    { target = 'vertex', usage }: { target?: BufferTarget; usage?: number } = {},
  ) {
    this.gl = gl;
    this.target = target === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

    const handle = gl.createBuffer();
    const bufferUsage = usage ?? gl.STATIC_DRAW;
    if (!handle) {
      throw new Error('Failed to create buffer');
    }
    this.buffer = handle;

    gl.bindBuffer(this.target, this.buffer);
    gl.bufferData(this.target, data, bufferUsage);
    gl.bindBuffer(this.target, null);
  }

  get handle(): WebGLBuffer {
    return this.buffer;
  }

  get targetEnum(): number {
    return this.target;
  }

  bind() {
    this.gl.bindBuffer(this.target, this.buffer);
  }

  unbind() {
    this.gl.bindBuffer(this.target, null);
  }

  destroy() {
    if (this.buffer) {
      this.gl.deleteBuffer(this.buffer);
      // @ts-expect-error clear handle
      this.buffer = null;
    }
  }
}
