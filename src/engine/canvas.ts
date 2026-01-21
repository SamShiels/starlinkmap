export function setSizedCanvas(gl: WebGL2RenderingContext) {
  const canvas = gl.canvas as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
}
