export function createVertexArray(
  gl: WebGL2RenderingContext,
  configure: (gl: WebGL2RenderingContext) => void,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error('Failed to create VAO');
  }

  gl.bindVertexArray(vao);
  configure(gl);
  gl.bindVertexArray(null);

  return vao;
}

export function destroyVertexArray(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject | null) {
  if (vao) {
    gl.deleteVertexArray(vao);
  }
}
