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
  private gl: WebGL2RenderingContext;
  private texture: WebGLTexture | null;

  public width: number = 0;
  public height: number = 0;

  constructor(
    gl: WebGL2RenderingContext,
    { wrapS, wrapT, minFilter, magFilter }: TextureOptions = {},
  ) {
    this.gl = gl;
    const tex = gl.createTexture();
    if (!tex) {
      throw new Error('Failed to create texture');
    }
    this.texture = tex;
    this.bind();

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter ?? gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter ?? gl.LINEAR);

    this.unbind();
  }

  get handle(): WebGLTexture {
    if (!this.texture) {
      throw new Error('Texture has been destroyed');
    }
    return this.texture;
  }

  bind(unit: number = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }

  unbind(unit: number = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  uploadFromImage(image: TexImageSource & { width?: number; height?: number }): void {
    const gl = this.gl;
    this.width = image.width ?? 0;
    this.height = image.height ?? 0;
    this.bind();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.unbind();
  }

  uploadData({ width, height, format, type, data }: TextureDataOptions): void {
    const gl = this.gl;
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

  destroy(): void {
    if (!this.texture) {
      return;
    }
    this.gl.deleteTexture(this.texture);
    this.texture = null;
  }
}
