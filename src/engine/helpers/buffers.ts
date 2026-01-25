type BufferTarget = 'vertex' | 'index';

export class GLBuffer {
  private _gl: WebGL2RenderingContext;
  private _buffer: WebGLBuffer | null;
  private _target: number;

  constructor(
    gl: WebGL2RenderingContext,
    data: BufferSource,
    { target = 'vertex', usage }: { target?: BufferTarget; usage?: number } = {},
  ) {
    this._gl = gl;
    this._target = target === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

    const handle = gl.createBuffer();
    const bufferUsage = usage ?? gl.STATIC_DRAW;
    if (!handle) {
      throw new Error('Failed to create buffer');
    }
    this._buffer = handle;

    gl.bindBuffer(this._target, this._buffer);
    gl.bufferData(this._target, data, bufferUsage);
    gl.bindBuffer(this._target, null);
  }

  public get handle(): WebGLBuffer {
    if (!this._buffer) {
      throw new Error('Buffer has been destroyed');
    }
    return this._buffer;
  }

  public get targetEnum(): number {
    return this._target;
  }

  public bind() {
    this._gl.bindBuffer(this._target, this._buffer);
  }

  public unbind() {
    this._gl.bindBuffer(this._target, null);
  }

  public updateData(data: BufferSource) {
    this.bind();
    this._gl.bufferData(this._target, data, this._gl.DYNAMIC_DRAW);
    this.unbind();
  }

  public destroy() {
    if (this._buffer) {
      this._gl.deleteBuffer(this._buffer);
      this._buffer = null;
    }
  }
}
