import { GLBuffer } from './helpers/buffers';
import { Program } from './helpers/shaders';
import { VertexArray } from './helpers/vaos';
import { Satellite } from './satellite';

const POINT_VERTEX_SHADER = `#version 300 es
in vec3 aCenter;
in vec2 aCorner;
in float aIsSelected;
in float aIsHovered;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uSize;
uniform float uSelectedScale;
uniform float uHoverScale;
out vec2 vCorner;
out float vIsSelected;
out float vIsHovered;
void main() {
  // Extract camera right/up vectors from view matrix columns
  vec3 right = vec3(uView[0][0], uView[1][0], uView[2][0]);
  vec3 up = vec3(uView[0][1], uView[1][1], uView[2][1]);

  float size = uSize * mix(1.0, uSelectedScale, aIsSelected);
  size *= mix(1.0, uHoverScale, aIsHovered);
  vec3 worldPos = aCenter + (right * aCorner.x + up * aCorner.y) * size;
  gl_Position = uProjection * uView * vec4(worldPos, 1.0);
  vCorner = aCorner;
  vIsSelected = aIsSelected;
  vIsHovered = aIsHovered;
}
`;

const POINT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vCorner;
in float vIsSelected;
in float vIsHovered;
out vec4 outColor;
void main() {
  float r2 = dot(vCorner, vCorner);
  if (r2 > 1.0) {
    discard;
  }
  vec3 baseColor = vec3(1.0);
  vec3 selectedColor = vec3(1.0, 0.92, 0.2);
  vec3 hoverRingColor = vec3(1.0, 0.92, 0.2);

  float r = sqrt(r2);
  float ringInner = 0.65;
  float ringOuter = 0.95;
  float ringFeather = 0.08;
  float ringMaskInner = smoothstep(ringInner, ringInner + ringFeather, r);
  float ringMaskOuter = 1.0 - smoothstep(ringOuter, ringOuter + ringFeather, r);
  float ring = clamp(ringMaskInner * ringMaskOuter, 0.0, 1.0) * vIsHovered;

  vec3 color = mix(baseColor, selectedColor, vIsSelected);
  color = mix(color, hoverRingColor, ring);

  outColor = vec4(color, 1.0);
}
`;

export class SatelliteRenderer {
  private _gl: WebGL2RenderingContext;
  private _program: Program;
  private _vao: VertexArray;
  private _vertexBuffer: GLBuffer;
  private _indexBuffer: GLBuffer;
  private _viewLocation: WebGLUniformLocation | null;
  private _projectionLocation: WebGLUniformLocation | null;
  private _sizeLocation: WebGLUniformLocation | null;
  private _selectedScaleLocation: WebGLUniformLocation | null;
  private _hoverScaleLocation: WebGLUniformLocation | null;
  private readonly _quadSize = 0.0014;
  private readonly _selectedScale = 1.7;
  private readonly _hoverScale = 1.5;
  private _satellites: Satellite[];

  constructor(gl: WebGL2RenderingContext) {
    this._gl = gl;
    this._satellites = [];

    // Create program
    this._program = new Program(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);

    // Create minimal buffers; resize when data arrives
    this._vertexBuffer = new GLBuffer(gl, new Float32Array(4 * 7), { target: 'vertex', usage: gl.DYNAMIC_DRAW });
    this._indexBuffer = new GLBuffer(gl, new Uint32Array(6), { target: 'index', usage: gl.DYNAMIC_DRAW });

    const centerLoc = gl.getAttribLocation(this._program.handle, 'aCenter');
    const cornerLoc = gl.getAttribLocation(this._program.handle, 'aCorner');
    const selectedLoc = gl.getAttribLocation(this._program.handle, 'aIsSelected');
    const hoveredLoc = gl.getAttribLocation(this._program.handle, 'aIsHovered');

    this._vao = new VertexArray(gl, (builder) => {
      gl.bindBuffer(this._vertexBuffer.targetEnum, this._vertexBuffer.handle);
      const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
      builder.addPointer({ location: centerLoc, size: 3, stride });
      builder.addPointer({ location: cornerLoc, size: 2, stride });
      builder.addPointer({ location: selectedLoc, size: 1, stride });
      builder.addPointer({ location: hoveredLoc, size: 1, stride });
      gl.bindBuffer(this._indexBuffer.targetEnum, this._indexBuffer.handle);
    });

    // Get uniform locations
    this._viewLocation = this._program.getUniformLocation('uView');
    this._projectionLocation = this._program.getUniformLocation('uProjection');
    this._sizeLocation = this._program.getUniformLocation('uSize');
    this._selectedScaleLocation = this._program.getUniformLocation('uSelectedScale');
    this._hoverScaleLocation = this._program.getUniformLocation('uHoverScale');
  }

  public setSatellites(next: Satellite[]) {
    this._satellites.length = 0;
    this._satellites.push(...next);
    this._recreateBuffers();
  }

  private _recreateBuffers() {
    const count = Math.max(1, this._satellites.length);
    this._vao.destroy();
    this._vertexBuffer.destroy();
    this._indexBuffer.destroy();

    this._vertexBuffer = new GLBuffer(
      this._gl,
      new Float32Array(count * 4 * 7),
      { target: 'vertex', usage: this._gl.DYNAMIC_DRAW },
    );
    this._indexBuffer = new GLBuffer(
      this._gl,
      new Uint32Array(count * 6),
      { target: 'index', usage: this._gl.DYNAMIC_DRAW },
    );

    const centerLoc = this._gl.getAttribLocation(this._program.handle, 'aCenter');
    const cornerLoc = this._gl.getAttribLocation(this._program.handle, 'aCorner');
    const selectedLoc = this._gl.getAttribLocation(this._program.handle, 'aIsSelected');
    const hoveredLoc = this._gl.getAttribLocation(this._program.handle, 'aIsHovered');

    this._vao = new VertexArray(this._gl, (builder) => {
      this._gl.bindBuffer(this._vertexBuffer.targetEnum, this._vertexBuffer.handle);
      const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
      builder.addPointer({ location: centerLoc, size: 3, stride });
      builder.addPointer({ location: cornerLoc, size: 2, stride });
      builder.addPointer({ location: selectedLoc, size: 1, stride });
      builder.addPointer({ location: hoveredLoc, size: 1, stride });
      this._gl.bindBuffer(this._indexBuffer.targetEnum, this._indexBuffer.handle);
    });
  }

  public getSatellites(): Satellite[] {
    return this._satellites;
  }

  public render(
    viewMatrix: Float32Array,
    projectionMatrix: Float32Array,
    selectedId: number | null,
    hoveredId: number | null,
  ) {
    if (this._satellites.length === 0) return;

    // Build per-vertex data: center position + corner indicator
    const data = new Float32Array(this._satellites.length * 4 * 7);
    const indices = new Uint32Array(this._satellites.length * 6);
    for (let i = 0; i < this._satellites.length; i++) {
      const sat = this._satellites[i];
      const base = i * 28; // 4 verts * 7 floats
      const isSelected = selectedId !== null && sat.id === selectedId ? 1 : 0;
      const isHovered = hoveredId !== null && sat.id === hoveredId ? 1 : 0;
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
        data[offset + 5] = isSelected;
        data[offset + 6] = isHovered;
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
    this._vertexBuffer.updateData(data);
    this._indexBuffer.updateData(indices);

    this._program.use();
    this._vao.bind();

    this._gl.uniformMatrix4fv(this._viewLocation, false, viewMatrix);
    this._gl.uniformMatrix4fv(this._projectionLocation, false, projectionMatrix);
    this._gl.uniform1f(this._sizeLocation, this._quadSize * 0.5);
    this._gl.uniform1f(this._selectedScaleLocation, this._selectedScale);
    this._gl.uniform1f(this._hoverScaleLocation, this._hoverScale);
    this._gl.drawElements(this._gl.TRIANGLES, this._satellites.length * 6, this._gl.UNSIGNED_INT, 0);

    this._vao.unbind();
  }

  public destroy() {
    this._vao.destroy();
    this._vertexBuffer.destroy();
    this._indexBuffer.destroy();
    this._program.destroy();
  }
}
