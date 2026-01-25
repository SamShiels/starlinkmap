// Minimal texture helper for WebGL2 2D textures.

type TextureOptions = {
  wrapS?: number;
  wrapT?: number;
  minFilter?: number;
  magFilter?: number;
};

type TextureDataOptions = {
  width: number;
  height: number;
  format?: number;
  type?: number;
  data?: ArrayBufferView | null;
};

export class GLTexture2D {
  private _gl: WebGL2RenderingContext;
  private _texture: WebGLTexture | null;

  public width: number = 0;
  public height: number = 0;

  constructor(
    gl: WebGL2RenderingContext,
    { wrapS, wrapT, minFilter, magFilter }: TextureOptions = {},
  ) {
    this._gl = gl;
    const tex = gl.createTexture();
    if (!tex) {
      throw new Error('Failed to create texture');
    }
    this._texture = tex;
    this.bind();

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter ?? gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter ?? gl.LINEAR);

    this.unbind();
  }

  public get handle(): WebGLTexture {
    if (!this._texture) {
      throw new Error('Texture has been destroyed');
    }
    return this._texture;
  }

  public bind(unit: number = 0): void {
    this._gl.activeTexture(this._gl.TEXTURE0 + unit);
    this._gl.bindTexture(this._gl.TEXTURE_2D, this._texture);
  }

  public unbind(unit: number = 0): void {
    this._gl.activeTexture(this._gl.TEXTURE0 + unit);
    this._gl.bindTexture(this._gl.TEXTURE_2D, null);
  }

  public uploadFromImage(image: TexImageSource & { width?: number; height?: number }): void {
    const gl = this._gl;
    this.width = image.width ?? 0;
    this.height = image.height ?? 0;
    this.bind();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.unbind();
  }

  public uploadData({ width, height, format, type, data }: TextureDataOptions): void {
    const gl = this._gl;
    this.width = width;
    this.height = height;
    this.bind();
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      format ?? gl.RGBA,
      width,
      height,
      0,
      format ?? gl.RGBA,
      type ?? gl.UNSIGNED_BYTE,
      data ?? null,
    );
    this.unbind();
  }

  public destroy(): void {
    if (!this._texture) {
      return;
    }
    this._gl.deleteTexture(this._texture);
    this._texture = null;
  }
}
