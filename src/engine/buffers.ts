type BufferTarget = 'vertex' | 'index';

export function createBuffer(
  gl: WebGL2RenderingContext,
  data: BufferSource,
  { target = 'vertex', usage }: { target?: BufferTarget; usage?: number } = {},
): { buffer: WebGLBuffer; target: number } {
  const bufferTarget = target === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
  const buffer = gl.createBuffer();
  const bufferUsage = usage ?? gl.STATIC_DRAW;

  if (!buffer) {
    throw new Error('Failed to create buffer');
  }

  gl.bindBuffer(bufferTarget, buffer);
  gl.bufferData(bufferTarget, data, bufferUsage);
  gl.bindBuffer(bufferTarget, null);

  return { buffer, target: bufferTarget };
}

export function destroyBuffer(gl: WebGL2RenderingContext, buffer: WebGLBuffer | null) {
  if (buffer) {
    gl.deleteBuffer(buffer);
  }
}
