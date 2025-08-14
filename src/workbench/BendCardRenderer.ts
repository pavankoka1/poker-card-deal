import { mat4 } from 'gl-matrix';

export type BendCardConfig = {
  floating: boolean;
  rotationDegrees: [number, number, number];
  bendRadius: number; // world units
  // Linear variation of radius along Y to create a conical bend.
  // Effective radius becomes: bendRadius + coneSlope * y
  // Use 0 for a perfect cylinder.
  coneSlope: number;
  // Optional target total bend across the full width, in degrees (0..360).
  // If > 0, this overrides bendRadius by computing an effective radius so that
  // the card spans this angular sweep on the cylinder.
  bendAngleDegrees?: number;
  // Geometry subdivisions to achieve a smooth bend. Higher => smoother.
  subdivisionsX?: number; // default 64
  subdivisionsY?: number; // default 8
  // World-space translation on the card plane before projection
  x?: number;
  y?: number;
  cardHeightPixels: number; // controls size on screen similar to CardRenderer
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: number; // 1..13
};

const VERT = `
attribute vec2 a_position; // -1..1 quad
uniform mat4 u_mvp_matrix;
uniform float u_halfWidth;  // world units
uniform float u_halfHeight; // world units
uniform float u_bendRadius; // world units, large -> flatter
uniform float u_coneSlope;  // world units per world Y; 0 => cylinder
uniform float u_bendSign;   // +1 or -1 to control bend direction
varying vec2 v_uv;

void main() {
  float x = a_position.x * u_halfWidth;
  float y = a_position.y * u_halfHeight;
  float z = 0.0;

  if (u_bendRadius > 0.0) {
    // Conical bend: radius varies linearly with Y.
    float localR = max(0.001, u_bendRadius + u_coneSlope * y);
    float angle = x / localR; // radians
    float bentX = sin(angle) * localR;
    float bentZ = u_bendSign * (localR - cos(angle) * localR);
    x = bentX;
    z = bentZ;
  }

  v_uv = a_position * 0.5 + 0.5;
  gl_Position = u_mvp_matrix * vec4(x, y, z, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform sampler2D u_backTexture;
uniform sampler2D u_suitTexture;
uniform bool u_isFrontFace;
uniform float u_cardValue;
uniform float u_isRedSuit;
varying vec2 v_uv;

float sdBox(vec2 p, vec2 b) { vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa=p-a; vec2 ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }

float drawHeart(vec2 p) { p.y+=0.1; p.x=abs(p.x); vec2 q=p-vec2(0.25,0.75); q=mat2(0.8,-0.6,0.6,0.8)*q; return min(sdCircle(p-vec2(0.0,0.25),0.25), sdBox(p-vec2(0.0,-0.1),vec2(0.5,0.35))) - 0.05; }
float drawDiamond(vec2 p) { p=abs(p); return sdSegment(p,vec2(0.0,0.4),vec2(0.3,0.0)) - 0.05; }
float drawClub(vec2 p) { float c1=sdCircle(p-vec2(0.0,0.15),0.25); float c2=sdCircle(p-vec2(-0.22,-0.1),0.25); float c3=sdCircle(p-vec2(0.22,-0.1),0.25); float s=sdBox(p-vec2(0.0,-0.2),vec2(0.05,0.3)); return min(min(min(c1,c2),c3),s); }
float drawSpade(vec2 p) { float h=drawHeart(p*vec2(1.0,-1.0)+vec2(0.0,-0.4)); float s=sdBox(p-vec2(0.0,-0.1),vec2(0.05,0.3)); return min(h,s); }

float draw_A(vec2 p) { float l1=sdSegment(p,vec2(-0.25,-0.3),vec2(0.0,0.3)); float l2=sdSegment(p,vec2(0.25,-0.3),vec2(0.0,0.3)); float l3=sdSegment(p,vec2(-0.15,0.0),vec2(0.15,0.0)); return min(min(l1,l2),l3); }
float draw_2(vec2 p) { float s1=sdSegment(p,vec2(0.2,-0.3),vec2(-0.2,-0.3)); float s2=sdSegment(p,vec2(-0.2,-0.3),vec2(-0.2,0.0)); float s3=sdSegment(p,vec2(-0.2,0.0),vec2(0.2,0.0)); float s4=sdSegment(p,vec2(0.2,0.0),vec2(0.2,0.3)); float s5=sdSegment(p,vec2(0.2,0.3),vec2(-0.2,0.3)); return min(min(min(min(s1,s2),s3),s4),s5); }
float draw_J(vec2 p) { float l1=sdSegment(p,vec2(0.0,0.3),vec2(0.0,-0.1)); float l2=sdSegment(p,vec2(0.0,-0.1),vec2(-0.2,-0.3)); return min(l1,l2); }
float draw_Q(vec2 p) { return sdCircle(p,0.25); }
float draw_K(vec2 p) { float l1=sdSegment(p,vec2(-0.2,0.3),vec2(-0.2,-0.3)); float l2=sdSegment(p,vec2(-0.2,0.0),vec2(0.2,0.0)); return min(l1,l2); }

void main() {
  if (sdBox(v_uv - 0.5, vec2(0.48, 0.48)) - 0.02 > 0.0) discard;

  if (u_isFrontFace) {
    vec3 color = vec3(1.0);
    vec3 engravingColor = u_isRedSuit > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 0.0);
    float thickness = 0.06;

    vec2 valUV_TR = (v_uv - vec2(0.88, 0.18)) * 7.0;
    vec2 valUV_BL = (v_uv - vec2(0.12, 0.82)) * 7.0;
    float valSDF = min(
      (u_cardValue == 1.0) ? draw_A(valUV_TR) :
      (u_cardValue > 1.5 && u_cardValue < 2.5) ? draw_2(valUV_TR) :
      (u_cardValue == 11.0) ? draw_J(valUV_TR) :
      (u_cardValue == 12.0) ? draw_Q(valUV_TR) :
      (u_cardValue == 13.0) ? draw_K(valUV_TR) : 1.0,

      (u_cardValue == 1.0) ? draw_A(valUV_BL) :
      (u_cardValue > 1.5 && u_cardValue < 2.5) ? draw_2(valUV_BL) :
      (u_cardValue == 11.0) ? draw_J(valUV_BL) :
      (u_cardValue == 12.0) ? draw_Q(valUV_BL) :
      (u_cardValue == 13.0) ? draw_K(valUV_BL) : 1.0
    );
    color = mix(engravingColor, color, smoothstep(0.0, thickness, valSDF));

    vec2 suitUV_TL = (v_uv - vec2(0.12, 0.18)) * 10.0;
    vec2 suitUV_BR = (v_uv - vec2(0.88, 0.82)) * 10.0;
    vec4 suitColor_TL = texture2D(u_suitTexture, suitUV_TL);
    if (suitUV_TL.x > 0.0 && suitUV_TL.x < 1.0 && suitUV_TL.y > 0.0 && suitUV_TL.y < 1.0) {
      if (suitColor_TL.a > 0.5) color = mix(color, suitColor_TL.rgb, suitColor_TL.a);
    }
    vec4 suitColor_BR = texture2D(u_suitTexture, suitUV_BR);
    if (suitUV_BR.x > 0.0 && suitUV_BR.x < 1.0 && suitUV_BR.y > 0.0 && suitUV_BR.y < 1.0) {
      if (suitColor_BR.a > 0.5) color = mix(color, suitColor_BR.rgb, suitColor_BR.a);
    }

    gl_FragColor = vec4(color, 1.0);
  } else {
    gl_FragColor = texture2D(u_backTexture, v_uv);
  }
}
`;

export class BendCardRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private animationId: number | null = null;
  private dimensions: { width: number; height: number };
  private config: BendCardConfig = {
    floating: false,
    rotationDegrees: [147, 35, -39],
    bendRadius: 1000,
    coneSlope: 0,
    // Do not set by default so bendRadius works as expected
    bendAngleDegrees: undefined,
    subdivisionsX: 64,
    subdivisionsY: 8,
    x: 1.13,
    y: -0.29,
    cardHeightPixels: 90,
    suit: 'hearts',
    value: 1,
  };

  private mvpMatrixLocation: WebGLUniformLocation | null = null;
  private halfWidthLocation: WebGLUniformLocation | null = null;
  private halfHeightLocation: WebGLUniformLocation | null = null;
  private bendRadiusLocation: WebGLUniformLocation | null = null;
  private coneSlopeLocation: WebGLUniformLocation | null = null;
  private bendSignLocation: WebGLUniformLocation | null = null;
  private isFrontFaceLocation: WebGLUniformLocation | null = null;
  private cardValueLocation: WebGLUniformLocation | null = null;
  private isRedSuitLocation: WebGLUniformLocation | null = null;
  private backTextureLocation: WebGLUniformLocation | null = null;
  private suitTextureLocation: WebGLUniformLocation | null = null;

  private backTexture: WebGLTexture | null = null;
  private suitTexture: WebGLTexture | null = null;

  private lastTime: number = 0;
  private rotationRad: [number, number, number] = [0, 0, 0];
  private vertexCount: number = 6;

  constructor(gl: WebGLRenderingContext, dimensions: { width: number; height: number }) {
    this.gl = gl;
    this.dimensions = dimensions;

    const vs = this.createShader(gl.VERTEX_SHADER, VERT);
    const fs = this.createShader(gl.FRAGMENT_SHADER, FRAG);
    this.program = this.createProgram(vs, fs);
    this.init();
  }

  public updateConfig(partial: Partial<BendCardConfig>) {
    this.config = { ...this.config, ...partial };
  }

  public getRotationDegrees(): [number, number, number] {
    const deg = (r: number) => (r * 180) / Math.PI;
    return [deg(this.rotationRad[0]), deg(this.rotationRad[1]), deg(this.rotationRad[2])];
  }

  public resize(newDimensions: { width: number; height: number }) {
    this.dimensions = newDimensions;
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  public start() {
    if (!this.animationId) this.animate();
  }

  public stop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }

  private init() {
    const gl = this.gl;
    gl.useProgram(this.program);

    const positionLocation = gl.getAttribLocation(this.program, 'a_position');

    this.mvpMatrixLocation = gl.getUniformLocation(this.program, 'u_mvp_matrix');
    this.halfWidthLocation = gl.getUniformLocation(this.program, 'u_halfWidth');
    this.halfHeightLocation = gl.getUniformLocation(this.program, 'u_halfHeight');
    this.bendRadiusLocation = gl.getUniformLocation(this.program, 'u_bendRadius');
    this.coneSlopeLocation = gl.getUniformLocation(this.program, 'u_coneSlope');
    this.bendSignLocation = gl.getUniformLocation(this.program, 'u_bendSign');
    this.isFrontFaceLocation = gl.getUniformLocation(this.program, 'u_isFrontFace');
    this.cardValueLocation = gl.getUniformLocation(this.program, 'u_cardValue');
    this.isRedSuitLocation = gl.getUniformLocation(this.program, 'u_isRedSuit');
    this.backTextureLocation = gl.getUniformLocation(this.program, 'u_backTexture');
    this.suitTextureLocation = gl.getUniformLocation(this.program, 'u_suitTexture');

    // Build a tessellated quad so the bend is smooth across the card
    const segX = this.config.subdivisionsX ?? 64;
    const segY = this.config.subdivisionsY ?? 8;
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const verts: number[] = [];
    for (let y = 0; y < segY; y++) {
      const v0 = -1 + (2 * y) / segY;
      const v1 = -1 + (2 * (y + 1)) / segY;
      for (let x = 0; x < segX; x++) {
        const u0 = -1 + (2 * x) / segX;
        const u1 = -1 + (2 * (x + 1)) / segX;
        // Two triangles per cell
        // tri 1: (u0,v0) -> (u1,v0) -> (u1,v1)
        verts.push(u0, v0, u1, v0, u1, v1);
        // tri 2: (u0,v0) -> (u1,v1) -> (u0,v1)
        verts.push(u0, v0, u1, v1, u0, v1);
      }
    }
    const positions = new Float32Array(verts);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    this.vertexCount = positions.length / 2;

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    this.backTexture = this.loadImageTexture('/images/card-back.jpg');
    this.suitTexture = this.loadImageTexture('/heart.webp');

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      throw new Error('Shader compilation failed');
    }
    return shader;
  }

  private createProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(program));
      throw new Error('Program linking failed');
    }
    return program;
  }

  private static isPowerOf2(value: number): boolean {
    return (value & (value - 1)) === 0;
  }

  private loadImageTexture(url: string): WebGLTexture {
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

      // If non-POT, resample to POT offscreen to enable mipmaps (reduces shimmer)
      let source: HTMLImageElement | HTMLCanvasElement = image;
      let potW = image.width, potH = image.height;
      const isPOT = BendCardRenderer.isPowerOf2(image.width) && BendCardRenderer.isPowerOf2(image.height);
      if (!isPOT) {
        potW = 1; while (potW < image.width) potW <<= 1;
        potH = 1; while (potH < image.height) potH <<= 1;
        const off = document.createElement('canvas');
        off.width = potW; off.height = potH;
        const ctx = off.getContext('2d');
        if (ctx) {
          // Use high quality scaling
          (ctx as any).imageSmoothingEnabled = true;
          (ctx as any).imageSmoothingQuality = 'high';
          ctx.drawImage(image, 0, 0, potW, potH);
          source = off;
        }
      }

      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
      // Use mipmapping and anisotropy when available to reduce shimmering
      const gl = this.gl;
      if (BendCardRenderer.isPowerOf2(potW) && BendCardRenderer.isPowerOf2(potH)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      // Anisotropic filtering extension
      const ext = gl.getExtension('EXT_texture_filter_anisotropic') ||
        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
        gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
      if (ext) {
        const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
      }
      // Improve magnification stability
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.src = url;
    return texture;
  }

  private animate = (time: number = 0) => {
    const gl = this.gl;

    const dt = this.lastTime ? (time - this.lastTime) / 1000.0 : 0;
    this.lastTime = time;

    if (this.config.floating) {
      this.rotationRad[0] += dt * 0.4; // x
      this.rotationRad[1] += dt * 0.6; // y
      this.rotationRad[2] += dt * 0.2; // z
    } else {
      this.rotationRad = this.config.rotationDegrees.map(d => d * Math.PI / 180) as [number, number, number];
    }

    const fieldOfView = 45 * Math.PI / 180;
    const aspect = this.dimensions.width / this.dimensions.height;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    const modelViewMatrix = mat4.create();
    const cameraDistance = 3;
    mat4.translate(modelViewMatrix, modelViewMatrix, [this.config.x ?? 0.0, this.config.y ?? -1.0, -cameraDistance]);

    // rotations around center
    mat4.rotateX(modelViewMatrix, modelViewMatrix, this.rotationRad[0]);
    mat4.rotateY(modelViewMatrix, modelViewMatrix, this.rotationRad[1]);
    mat4.rotateZ(modelViewMatrix, modelViewMatrix, this.rotationRad[2]);

    // Compute world size for given pixel height
    const worldHeight = 2 * Math.tan(fieldOfView / 2) * cameraDistance; // height of view at z=cameraDistance
    const desiredWorldHeight = (this.config.cardHeightPixels / this.dimensions.height) * worldHeight;
    const halfHeight = desiredWorldHeight / 2;
    const cardAspectRatio = 0.714; // consistent with CardRenderer
    const halfWidth = halfHeight * cardAspectRatio;

    const mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, projectionMatrix, modelViewMatrix);

    gl.useProgram(this.program);

    // clear
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Back face
    gl.cullFace(gl.FRONT);
    gl.uniform1i(this.isFrontFaceLocation, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.backTexture);
    gl.uniform1i(this.backTextureLocation, 0);

    gl.uniformMatrix4fv(this.mvpMatrixLocation, false, mvpMatrix);
    gl.uniform1f(this.halfWidthLocation, halfWidth);
    gl.uniform1f(this.halfHeightLocation, halfHeight);
    // Decide effective radius
    // If bendAngleDegrees provided, compute radius from desired angular sweep across full width.
    // Else, treat bendRadius as pixel radius and convert to world units so UI slider works intuitively.
    const hasAngle = (this.config.bendAngleDegrees ?? 0) !== 0;
    const angleSweepRad: number = hasAngle
      ? (Math.abs(this.config.bendAngleDegrees as number) * Math.PI / 180)
      : 0;
    const pixelToWorld = desiredWorldHeight / this.config.cardHeightPixels; // world units per pixel at card depth
    const radiusFromPixels = Math.max(0.001, this.config.bendRadius * pixelToWorld);
    const effectiveRadius: number = hasAngle
      ? Math.max(0.001, (2 * halfWidth) / angleSweepRad)
      : radiusFromPixels;
    const bendSignFromAngle = hasAngle ? Math.sign(this.config.bendAngleDegrees as number) : 0;
    const bendSignFromRadius = Math.sign(this.config.bendRadius);
    const bendSign = (bendSignFromAngle !== 0 ? bendSignFromAngle : (bendSignFromRadius !== 0 ? bendSignFromRadius : 1));
    gl.uniform1f(this.bendRadiusLocation, effectiveRadius);
    gl.uniform1f(this.coneSlopeLocation, this.config.coneSlope);
    gl.uniform1f(this.bendSignLocation, bendSign);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);

    // Front face
    gl.cullFace(gl.BACK);
    gl.uniform1i(this.isFrontFaceLocation, 1);
    gl.uniform1f(this.cardValueLocation, this.config.value);
    const isRed = this.config.suit === 'hearts' || this.config.suit === 'diamonds' ? 1.0 : 0.0;
    gl.uniform1f(this.isRedSuitLocation, isRed);
    // Front face shares the same transform uniforms; ensure they're set for safety
    gl.uniformMatrix4fv(this.mvpMatrixLocation, false, mvpMatrix);
    gl.uniform1f(this.halfWidthLocation, halfWidth);
    gl.uniform1f(this.halfHeightLocation, halfHeight);
    gl.uniform1f(this.bendRadiusLocation, effectiveRadius);
    gl.uniform1f(this.coneSlopeLocation, this.config.coneSlope);
    gl.uniform1f(this.bendSignLocation, bendSign);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.suitTexture);
    gl.uniform1i(this.suitTextureLocation, 1);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);

    this.animationId = requestAnimationFrame(this.animate);
  };
}