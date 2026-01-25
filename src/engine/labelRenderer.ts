import { GLBuffer } from './helpers/buffers';
import { Program } from './helpers/shaders';
import { VertexArray } from './helpers/vaos';
import { GLTexture2D } from './helpers/textures';
import { Satellite } from './satellite';

const LABEL_VERTEX_SHADER = `#version 300 es
in vec3 aCenter;
in vec2 aCorner;
in vec2 aHalfSize;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uOffset;
out vec2 vUv;
void main() {
  vec3 right = vec3(uView[0][0], uView[1][0], uView[2][0]);
  vec3 up = vec3(uView[0][1], uView[1][1], uView[2][1]);

  vec3 worldPos = aCenter + up * uOffset + right * (aCorner.x * aHalfSize.x) + up * (aCorner.y * aHalfSize.y);
  gl_Position = uProjection * uView * vec4(worldPos, 1.0);
  vUv = aCorner * 0.5 + 0.5;
}
`;

const LABEL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 c = texture(uTexture, vUv);
  if (c.a < 0.01) discard;
  outColor = c;
}
`;

type LabelInfo = {
  texture: GLTexture2D;
  halfSize: { x: number; y: number };
};

export class LabelRenderer {
  private gl: WebGL2RenderingContext;
  private program: Program;
  private vao: VertexArray;
  private vertexBuffer: GLBuffer;
  private indexBuffer: GLBuffer;
  private viewLocation: WebGLUniformLocation | null;
  private projectionLocation: WebGLUniformLocation | null;
  private offsetLocation: WebGLUniformLocation | null;
  private textureLocation: WebGLUniformLocation | null;
  private labels: Map<number, LabelInfo> = new Map();
  private readonly pixelScale = 0.0001;
  private readonly offset = 0.005;
  private readonly maxLabels = 20;
  private readonly hideDistance = 0.9;

  constructor(gl: WebGL2RenderingContext, satellites: Satellite[]) {
    this.gl = gl;
    this.program = new Program(gl, LABEL_VERTEX_SHADER, LABEL_FRAGMENT_SHADER);

    this.vertexBuffer = new GLBuffer(
      gl,
      new Float32Array(Math.max(1, satellites.length) * 4 * 7),
      { target: 'vertex', usage: gl.DYNAMIC_DRAW },
    );
    this.indexBuffer = new GLBuffer(
      gl,
      new Uint32Array(Math.max(1, satellites.length) * 6),
      { target: 'index', usage: gl.DYNAMIC_DRAW },
    );

    const centerLoc = gl.getAttribLocation(this.program.handle, 'aCenter');
    const cornerLoc = gl.getAttribLocation(this.program.handle, 'aCorner');
    const halfSizeLoc = gl.getAttribLocation(this.program.handle, 'aHalfSize');

    this.vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(this.vertexBuffer.targetEnum, this.vertexBuffer.handle);
      const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
      builder.addPointer({ location: centerLoc, size: 3, stride });
      builder.addPointer({ location: cornerLoc, size: 2, stride });
      builder.addPointer({ location: halfSizeLoc, size: 2, stride });
      gl.bindBuffer(this.indexBuffer.targetEnum, this.indexBuffer.handle);
    });

    this.viewLocation = this.program.getUniformLocation('uView');
    this.projectionLocation = this.program.getUniformLocation('uProjection');
    this.offsetLocation = this.program.getUniformLocation('uOffset');
    this.textureLocation = this.program.getUniformLocation('uTexture');

    for (const sat of satellites) {
      this.labels.set(sat.id, this.createLabel(sat.name));
    }
  }

  render(viewMatrix: Float32Array, projectionMatrix: Float32Array, satellites: Satellite[]) {
    if (satellites.length === 0) return;

    const eyeDistance = this.getEyeDistance(viewMatrix);
    if (eyeDistance < this.hideDistance) return;

    const viewProj = new Float32Array(16);
    this.multiplyMat4(viewProj, projectionMatrix, viewMatrix);

    const candidates: { sat: Satellite; distSq: number }[] = [];
    for (const sat of satellites) {
      const clip = this.transformPoint(viewProj, sat.position);
      if (clip.w <= 0.0) continue;
      const ndcX = clip.x / clip.w;
      const ndcY = clip.y / clip.w;
      if (Math.abs(ndcX) > 1.0 || Math.abs(ndcY) > 1.0) continue;
      candidates.push({ sat, distSq: ndcX * ndcX + ndcY * ndcY });
    }

    candidates.sort((a, b) => a.distSq - b.distSq);
    const selected = candidates.slice(0, this.maxLabels).filter((c) => this.labels.has(c.sat.id));
    if (selected.length === 0) return;

    const data = new Float32Array(selected.length * 4 * 7);
    const indices = new Uint32Array(selected.length * 6);

    for (let i = 0; i < selected.length; i++) {
      const sat = selected[i].sat;
      const label = this.labels.get(sat.id);
      if (!label) continue;

      const base = i * 28; // 4 verts * 7 floats
      const corners = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];

      for (let c = 0; c < 4; c++) {
        const offset = base + c * 7;
        data[offset] = sat.position.x;
        data[offset + 1] = sat.position.y;
        data[offset + 2] = sat.position.z;
        data[offset + 3] = corners[c][0];
        data[offset + 4] = corners[c][1];
        data[offset + 5] = label.halfSize.x;
        data[offset + 6] = label.halfSize.y;
      }

      const iBase = i * 6;
      const vBase = i * 4;
      indices[iBase] = vBase;
      indices[iBase + 1] = vBase + 1;
      indices[iBase + 2] = vBase + 2;
      indices[iBase + 3] = vBase + 2;
      indices[iBase + 4] = vBase + 1;
      indices[iBase + 5] = vBase + 3;
    }

    this.vertexBuffer.updateData(data);
    this.indexBuffer.updateData(indices);

    this.program.use();
    this.vao.bind();
    this.gl.uniformMatrix4fv(this.viewLocation, false, viewMatrix);
    this.gl.uniformMatrix4fv(this.projectionLocation, false, projectionMatrix);
    this.gl.uniform1f(this.offsetLocation, this.offset);
    this.gl.uniform1i(this.textureLocation, 0);

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.depthMask(false);

    for (let i = 0; i < selected.length; i++) {
      const label = this.labels.get(selected[i].sat.id);
      if (!label) continue;
      label.texture.bind(0);
      const indexOffsetBytes = i * 6 * Uint32Array.BYTES_PER_ELEMENT;
      this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_INT, indexOffsetBytes);
    }

    this.gl.depthMask(true);
    this.gl.disable(this.gl.BLEND);
    this.vao.unbind();
  }

  destroy() {
    this.vao.destroy();
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.program.destroy();
    for (const label of this.labels.values()) {
      label.texture.destroy();
    }
    this.labels.clear();
  }

  private createLabel(text: string): LabelInfo {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D context for label');
    }

    const fontSize = 28;
    const padding = 8;
    ctx.font = `600 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.2;

    canvas.width = Math.ceil(textWidth + padding * 2);
    canvas.height = Math.ceil(textHeight + padding * 2);

    ctx.font = `600 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, padding, canvas.height / 2);

    const texture = new GLTexture2D(this.gl, { wrapS: this.gl.CLAMP_TO_EDGE, wrapT: this.gl.CLAMP_TO_EDGE });
    texture.uploadFromImage(canvas);

    const halfWidth = (canvas.width * this.pixelScale) * 0.5;
    const halfHeight = (canvas.height * this.pixelScale) * 0.5;

    return {
      texture,
      halfSize: { x: halfWidth, y: halfHeight },
    };
  }

  private transformPoint(
    m: Float32Array,
    v: { x: number; y: number; z: number },
  ): { x: number; y: number; z: number; w: number } {
    return {
      x: m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12],
      y: m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13],
      z: m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14],
      w: m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15],
    };
  }

  private multiplyMat4(out: Float32Array, a: Float32Array, b: Float32Array) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
    const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
    const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
    const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

    out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

    out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

    out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

    out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
  }

  private getEyeDistance(viewMatrix: Float32Array): number {
    // view matrix is orthonormal; camera position = -R^T * t
    const r00 = viewMatrix[0], r01 = viewMatrix[1], r02 = viewMatrix[2];
    const r10 = viewMatrix[4], r11 = viewMatrix[5], r12 = viewMatrix[6];
    const r20 = viewMatrix[8], r21 = viewMatrix[9], r22 = viewMatrix[10];
    const tx = viewMatrix[12], ty = viewMatrix[13], tz = viewMatrix[14];

    const eyeX = -(r00 * tx + r10 * ty + r20 * tz);
    const eyeY = -(r01 * tx + r11 * ty + r21 * tz);
    const eyeZ = -(r02 * tx + r12 * ty + r22 * tz);

    return Math.hypot(eyeX, eyeY, eyeZ);
  }
}
