import { FragmentShaderSource, VertexShaderSource } from "./shaders";
import { mat4, vec3 } from "gl-matrix";

export interface CardConfig {
    suit: 'diamonds' | 'clubs' | 'spades' | 'hearts';
    value: number; // 1=A, 2-10, 11=J, 12=Q, 13=K
    cardHeightPixels?: number;

    // Base transform (world space fallback)
    x?: number;
    y?: number;
    rotationDegrees?: [number, number, number];

    // Camera controls
    cameraXNorm?: number; // 0..1 across screen, 0 left, 1 right
    cameraYNorm?: number; // 0..1 across screen, 0 top, 1 bottom
    cameraZ?: number;     // distance in world units (default 3)

    // Deal Animation (legacy world-space retained)
    dealFrom?: vec3;
    dealTo?: vec3;
    dealDuration?: number;

    // Flip Animation
    flipDuration?: number;
    flipElevation?: number;
    flipYPeak?: number;

    // Settle Animation
    settleTo?: vec3;             // world fallback
    settleDuration?: number;

    // Swipe Animation (world fallback)
    swipeDuration?: number;
    swipeBendAngleDeg?: number;
    swipeLiftZ?: number;
    swipeSlideX?: number;
    swipeSlideY?: number;
    swipeStartX?: number;
    swipeStartY?: number;

    // Normalized coordinate system 0..1 (preferred). If provided, overrides world fallbacks above.
    // 0,0 = top-left, 1,1 = bottom-right, mapping is done each frame using current camera & viewport.
    swipeStartNormX?: number;
    swipeStartNormY?: number;
    swipeEndNormX?: number;
    swipeEndNormY?: number;

    dealEndNormX?: number;
    dealEndNormY?: number; // if omitted, defaults to swipeEndNormY

    settleEndNormX?: number;
    settleEndNormY?: number;

    // Deal Animation (start is end of swipe) world fallbacks
    dealEndX?: number;
    dealEndY?: number;
    dealEndRotationDegrees?: [number, number, number];
}

// --- Easing Helpers ---
function easeOutQuint(t: number) { return 1 - Math.pow(1 - t, 5); }
function easeInQuint(t: number) { return t * t * t * t * t; }
function easeInOutQuint(t: number) { return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; }
function easeInOutCubic(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeInOutSine(t: number) { return -(Math.cos(Math.PI * t) - 1) / 2; }
function easeInOutPow(t: number, p: number) { const a = Math.max(0.000001, p); return t < 0.5 ? Math.pow(2 * t, a) / 2 : 1 - Math.pow(2 * (1 - t), a) / 2; }

// Linear interpolation for vectors
function lerp(out: vec3, a: vec3, b: vec3, t: number) {
    out[0] = a[0] + t * (b[0] - a[0]);
    out[1] = a[1] + t * (b[1] - a[1]);
    out[2] = a[2] + t * (b[2] - a[2]);
    return out;
}

export class CardRenderer {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private animationId: number | null = null;
    private dimensions: { width: number, height: number };

    // Animation state
    private startTime: number = 0;
    private animationPhase: 'swipe' | 'deal' | 'flip' | 'settle' | 'idle' = 'swipe';

    // Card state (defaults)
    private cardConfig: CardConfig = {
        suit: 'hearts',
        value: 1,
        cardHeightPixels: 140,
        x: 1.13,
        y: -0.29,
        rotationDegrees: [147, 35, -39],

        cameraXNorm: 0.5,
        cameraYNorm: 1.0,
        cameraZ: 3,

        // Swipe defaults
        swipeDuration: 900,
        swipeBendAngleDeg: -20,
        swipeLiftZ: -0.15,
        swipeSlideX: -0.8,
        swipeSlideY: -0.4,

        // Deal/Flip/Settle defaults
        dealDuration: 1000,
        dealEndX: 0.4,
        dealEndY: -0.7,
        dealEndRotationDegrees: [135, 0, 0],
        flipDuration: 800,
        settleDuration: 700,
        flipElevation: 1.5,
        flipYPeak: 1.0,
        settleTo: vec3.fromValues(0, -1.8, 0),

        // Normalized path defaults (none by default)
    };

    // Animation path caches
    private currentPosition: vec3 = vec3.fromValues(this.cardConfig.x ?? 0, this.cardConfig.y ?? 0, 0);
    private postSwipePosition: vec3 = vec3.fromValues(0, 0, 0);
    private positionAtDealEnd: vec3 = vec3.fromValues(0, 0, 0);
    private positionAtFlipEnd: vec3 = vec3.fromValues(0, 0, 0);

    // Uniform locations
    private mvpMatrixUniformLocation: WebGLUniformLocation | null = null;
    private halfWidthUniformLocation: WebGLUniformLocation | null = null;
    private halfHeightUniformLocation: WebGLUniformLocation | null = null;
    private bendRadiusUniformLocation: WebGLUniformLocation | null = null;
    private coneSlopeUniformLocation: WebGLUniformLocation | null = null;
    private bendSignUniformLocation: WebGLUniformLocation | null = null;
    private textureUniformLocation: WebGLUniformLocation | null = null;
    private cardValueUniformLocation: WebGLUniformLocation | null = null;
    private isRedSuitUniformLocation: WebGLUniformLocation | null = null;
    private isFrontFaceUniformLocation: WebGLUniformLocation | null = null;
    private suitIndexUniformLocation: WebGLUniformLocation | null = null;
    private useFrontTextureUniformLocation: WebGLUniformLocation | null = null;
    private frontTextureUniformLocation: WebGLUniformLocation | null = null;
    private backUVScaleUniformLocation: WebGLUniformLocation | null = null;
    private backUVOffsetUniformLocation: WebGLUniformLocation | null = null;

    // Textures
    private imageTexture: WebGLTexture | null = null; // back
    private whiteTexture: WebGLTexture | null = null;
    private frontTexture: WebGLTexture | null = null;

    // Back texture aspect/crop
    private backTextureAspect: number = 1.0;

    // Geometry
    private vertexCount: number = 6;

    constructor(gl: WebGLRenderingContext, dimensions: { width: number, height: number }) {
        this.gl = gl;
        this.dimensions = dimensions;
        const vertexShader = this.createShader(gl.VERTEX_SHADER, VertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, FragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);
        this.init();
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

    private init() {
        const positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.mvpMatrixUniformLocation = this.gl.getUniformLocation(this.program, "u_mvp_matrix");
        this.textureUniformLocation = this.gl.getUniformLocation(this.program, "u_texture");
        this.cardValueUniformLocation = this.gl.getUniformLocation(this.program, "u_cardValue");
        this.isRedSuitUniformLocation = this.gl.getUniformLocation(this.program, "u_isRedSuit");
        this.isFrontFaceUniformLocation = this.gl.getUniformLocation(this.program, "u_isFrontFace");
        this.halfWidthUniformLocation = this.gl.getUniformLocation(this.program, "u_halfWidth");
        this.halfHeightUniformLocation = this.gl.getUniformLocation(this.program, "u_halfHeight");
        this.bendRadiusUniformLocation = this.gl.getUniformLocation(this.program, "u_bendRadius");
        this.coneSlopeUniformLocation = this.gl.getUniformLocation(this.program, "u_coneSlope");
        this.bendSignUniformLocation = this.gl.getUniformLocation(this.program, "u_bendSign");
        this.suitIndexUniformLocation = this.gl.getUniformLocation(this.program, "u_suitIndex");
        this.useFrontTextureUniformLocation = this.gl.getUniformLocation(this.program, "u_useFrontTexture");
        this.frontTextureUniformLocation = this.gl.getUniformLocation(this.program, "u_frontTexture");
        this.backUVScaleUniformLocation = this.gl.getUniformLocation(this.program, "u_backUVScale");
        this.backUVOffsetUniformLocation = this.gl.getUniformLocation(this.program, "u_backUVOffset");

        // Tessellated quad
        const segX = 64;
        const segY = 8;
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const verts: number[] = [];
        for (let y = 0; y < segY; y++) {
            const v0 = -1 + (2 * y) / segY;
            const v1 = -1 + (2 * (y + 1)) / segY;
            for (let x = 0; x < segX; x++) {
                const u0 = -1 + (2 * x) / segX;
                const u1 = -1 + (2 * (x + 1)) / segX;
                verts.push(u0, v0, u1, v0, u1, v1);
                verts.push(u0, v0, u1, v1, u0, v1);
            }
        }
        const positions = new Float32Array(verts);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        this.vertexCount = positions.length / 2;

        // Attribute pointer
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Textures
        this.imageTexture = this.loadBackTexture('/images/card-back.jpeg');
        this.whiteTexture = this.createWhiteTexture();
        this.frontTexture = this.loadImageTexture('/images/ace-hearts.png');

        // GL state
        this.gl.useProgram(this.program);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    public updateCardConfig(config: Partial<CardConfig>) {
        this.cardConfig = { ...this.cardConfig, ...config };
        this.replayAnimation();
    }

    public replayAnimation() {
        this.startTime = performance.now();
        this.animationPhase = 'swipe';
        if (!this.animationId) {
            this.animate();
        }
    }

    public resize(newDimensions: { width: number, height: number }) {
        this.dimensions = newDimensions;
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    private isRedSuit(suit: string): boolean { return suit === 'hearts' || suit === 'diamonds'; }
    private getSuitValue(suit: string): number { switch (suit) { case 'hearts': return 0.0; case 'diamonds': return 1.0; case 'clubs': return 2.0; case 'spades': return 3.0; default: return 0.0; } }

    private createWhiteTexture(): WebGLTexture {
        const texture = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        return texture;
    }

    private static isPowerOf2(value: number): boolean { return (value & (value - 1)) === 0; }

    private loadImageTexture(url: string): WebGLTexture {
        const texture = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            let source: HTMLImageElement | HTMLCanvasElement = image;
            let potW = image.width, potH = image.height;
            const isPOT = CardRenderer.isPowerOf2(image.width) && CardRenderer.isPowerOf2(image.height);
            if (!isPOT) {
                potW = 1; while (potW < image.width) potW <<= 1;
                potH = 1; while (potH < image.height) potH <<= 1;
                const off = document.createElement('canvas');
                off.width = potW; off.height = potH;
                const ctx = off.getContext('2d');
                if (ctx) {
                    (ctx as any).imageSmoothingEnabled = true;
                    (ctx as any).imageSmoothingQuality = 'high';
                    ctx.drawImage(image, 0, 0, potW, potH);
                    source = off;
                }
            }
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
            if (CardRenderer.isPowerOf2(potW) && CardRenderer.isPowerOf2(potH)) {
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
            } else {
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            }
            const ext = this.gl.getExtension('EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
            if (ext) {
                const max = this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
                this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
            }
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        };
        image.src = url;
        return texture;
    }

    private loadBackTexture(url: string): WebGLTexture {
        const texture = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.backTextureAspect = image.width / image.height;
            let source: HTMLImageElement | HTMLCanvasElement = image;
            let potW = image.width, potH = image.height;
            const isPOT = CardRenderer.isPowerOf2(image.width) && CardRenderer.isPowerOf2(image.height);
            if (!isPOT) {
                potW = 1; while (potW < image.width) potW <<= 1;
                potH = 1; while (potH < image.height) potH <<= 1;
                const off = document.createElement('canvas');
                off.width = potW; off.height = potH;
                const ctx = off.getContext('2d');
                if (ctx) {
                    (ctx as any).imageSmoothingEnabled = true;
                    (ctx as any).imageSmoothingQuality = 'high';
                    ctx.drawImage(image, 0, 0, potW, potH);
                    source = off;
                }
            }
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
            if (CardRenderer.isPowerOf2(potW) && CardRenderer.isPowerOf2(potH)) {
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
            } else {
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            }
            const ext = this.gl.getExtension('EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
            if (ext) {
                const max = this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
                this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
            }
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        };
        image.src = url;
        return texture;
    }

    private animate = (currentTime: number = 0) => {
        if (!this.startTime) this.startTime = currentTime;
        const elapsedTime = currentTime - this.startTime;

        const cfg = this.cardConfig;
        const cardHeightPixels = cfg.cardHeightPixels ?? 140;
        const rotationDegrees = cfg.rotationDegrees ?? [147, 35, -39];
        const swipeDuration = cfg.swipeDuration ?? 900;
        const swipeBendAngleDeg = cfg.swipeBendAngleDeg ?? -20;
        const swipeLiftZ = cfg.swipeLiftZ ?? 0.0;
        const flipDuration = cfg.flipDuration ?? 800;
        const settleDuration = cfg.settleDuration ?? 700;
        const flipYPeak = cfg.flipYPeak ?? 1.0;

        // --- Projection ---
        const fieldOfView = 45 * Math.PI / 180;
        const aspect = this.dimensions.width / this.dimensions.height;
        const cameraZ = cfg.cameraZ ?? 3;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

        // World extents at card plane
        const worldHeight = 2 * Math.tan(fieldOfView / 2) * cameraZ;
        const worldWidth = worldHeight * aspect;

        // Map normalized [0..1] to world with camera fixed at center (0,0 top-left)
        const normToWorld = (nx: number, ny: number): [number, number] => {
            const wx = (nx - 0.5) * worldWidth;
            const wy = -(ny - 0.5) * worldHeight;
            return [wx, wy];
        };

        // --- Build View and Model (camera fixed at center) ---
        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -cameraZ]);
        const modelMatrix = mat4.create();

        // Determine progress and positions
        let tx = 0, ty = 0;
        let localZOffset = 0.0;
        let rotXDeg = rotationDegrees[0], rotYDeg = rotationDegrees[1], rotZDeg = rotationDegrees[2];

        // Compute swipe start/end in world (prefer normalized)
        const hasNormSwipe = cfg.swipeStartNormX !== undefined && cfg.swipeStartNormY !== undefined && cfg.swipeEndNormX !== undefined && cfg.swipeEndNormY !== undefined;
        const [swipeStartWX, swipeStartWY] = hasNormSwipe
            ? normToWorld(cfg.swipeStartNormX as number, cfg.swipeStartNormY as number)
            : [cfg.swipeStartX ?? cfg.x ?? 0, cfg.swipeStartY ?? cfg.y ?? 0];
        const [swipeEndWX, swipeEndWY] = hasNormSwipe
            ? normToWorld(cfg.swipeEndNormX as number, cfg.swipeEndNormY as number)
            : [swipeStartWX + (cfg.swipeSlideX ?? 0), swipeStartWY + (cfg.swipeSlideY ?? 0)];

        if (this.animationPhase === 'swipe') {
            const p = Math.min(elapsedTime / swipeDuration, 1.0);
            const moveX = easeInOutCubic(p);
            const moveY = easeInOutQuint(p);
            tx = swipeStartWX + (swipeEndWX - swipeStartWX) * moveX;
            ty = swipeStartWY + (swipeEndWY - swipeStartWY) * moveY;

            const bendProgress = easeInOutQuint(p);
            const bendCurve = Math.sin(Math.PI * bendProgress);
            const bendSign = (swipeBendAngleDeg < 0 ? -1.0 : 1.0);
            this.gl.uniform1f(this.bendSignUniformLocation, bendSign);
            const cardAspectRatio = 0.8; // keep consistent with UI
            const halfHeightTemp = ((cardHeightPixels / this.dimensions.height) * worldHeight) / 2;
            const halfWidthTemp = halfHeightTemp * cardAspectRatio;
            let effectiveRadius = 0.0;
            if (bendCurve > 0.0001) {
                const angleRad = Math.abs(swipeBendAngleDeg) * bendCurve * Math.PI / 180.0;
                const fullWidth = 2.0 * halfWidthTemp;
                effectiveRadius = Math.max(0.001, fullWidth / angleRad);
            }
            this.gl.uniform1f(this.bendRadiusUniformLocation, effectiveRadius);

            localZOffset = (swipeLiftZ ?? 0) * bendCurve;

            if (p >= 1.0) {
                vec3.set(this.postSwipePosition, tx, ty, 0);
                vec3.copy(this.currentPosition, this.postSwipePosition);
                this.animationPhase = 'deal';
                this.startTime = currentTime;
            }
        } else if (this.animationPhase === 'deal') {
            const p = Math.min(elapsedTime / (cfg.dealDuration ?? 1000), 1.0);
            const eased = easeInOutQuint(p);
            // Deal end in world (prefer normalized)
            let endWX: number, endWY: number;
            if (cfg.dealEndNormX !== undefined) {
                const yNorm = cfg.dealEndNormY !== undefined ? cfg.dealEndNormY : (cfg.swipeEndNormY !== undefined ? cfg.swipeEndNormY : 0.5);
                [endWX, endWY] = normToWorld(cfg.dealEndNormX, yNorm);
            } else {
                endWX = (cfg.dealEndX !== undefined) ? cfg.dealEndX : this.postSwipePosition[0];
                endWY = (cfg.dealEndY !== undefined) ? cfg.dealEndY : this.postSwipePosition[1];
            }
            const endPos = vec3.fromValues(endWX, endWY, 0);
            lerp(this.currentPosition, this.postSwipePosition, endPos, eased);
            tx = this.currentPosition[0];
            ty = this.currentPosition[1];
            const dRot = cfg.dealEndRotationDegrees ?? [135, 0, 0];
            rotXDeg = rotationDegrees[0] + (dRot[0] - rotationDegrees[0]) * eased;
            rotYDeg = rotationDegrees[1] + (dRot[1] - rotationDegrees[1]) * eased;
            rotZDeg = rotationDegrees[2] + (dRot[2] - rotationDegrees[2]) * eased;
            if (p >= 1.0) {
                vec3.copy(this.positionAtDealEnd, this.currentPosition);
                this.animationPhase = 'flip';
                this.startTime = currentTime;
            }
        } else if (this.animationPhase === 'flip') {
            const p = Math.min(elapsedTime / flipDuration, 1.0);
            const eased = easeOutQuint(p);
            tx = this.positionAtDealEnd[0];
            ty = this.positionAtDealEnd[1] + flipYPeak * Math.sin(eased * Math.PI);
            const dRot = cfg.dealEndRotationDegrees ?? [135, 0, 0];
            rotXDeg = dRot[0] + 180 * eased;
            rotYDeg = dRot[1];
            rotZDeg = dRot[2];
            if (p >= 1.0) {
                vec3.set(this.positionAtFlipEnd, this.positionAtDealEnd[0], this.positionAtDealEnd[1], 0);
                this.animationPhase = 'settle';
                this.startTime = currentTime;
            }
        } else if (this.animationPhase === 'settle') {
            const p = Math.min(elapsedTime / settleDuration, 1.0);
            const eased = easeOutQuint(p);
            // Settle end in world (prefer normalized)
            let endWX: number, endWY: number;
            if (cfg.settleEndNormX !== undefined || cfg.settleEndNormY !== undefined) {
                const xNorm = cfg.settleEndNormX !== undefined ? cfg.settleEndNormX : 0.5;
                const yNorm = cfg.settleEndNormY !== undefined ? cfg.settleEndNormY : 1.0;
                [endWX, endWY] = normToWorld(xNorm, yNorm);
            } else {
                endWX = cfg.settleTo ? cfg.settleTo[0] : this.positionAtFlipEnd[0];
                endWY = cfg.settleTo ? cfg.settleTo[1] : -worldHeight / 2 + 0.01;
            }
            lerp(this.currentPosition, this.positionAtFlipEnd, vec3.fromValues(endWX, endWY, 0), eased);
            tx = this.currentPosition[0];
            ty = this.currentPosition[1];
            const dRot = cfg.dealEndRotationDegrees ?? [135, 0, 0];
            rotXDeg = dRot[0] + 180;
            rotYDeg = dRot[1];
            rotZDeg = dRot[2];
            if (p >= 1.0) {
                this.animationPhase = 'idle';
            }
        } else {
            // idle: keep last position
            tx = this.currentPosition[0] ?? 0;
            ty = this.currentPosition[1] ?? 0;
        }

        // Build model matrix from tx,ty and rotation
        mat4.translate(modelMatrix, modelMatrix, [tx, ty, 0]);
        mat4.rotateX(modelMatrix, modelMatrix, (rotXDeg * Math.PI) / 180);
        mat4.rotateY(modelMatrix, modelMatrix, (rotYDeg * Math.PI) / 180);
        mat4.rotateZ(modelMatrix, modelMatrix, (rotZDeg * Math.PI) / 180);

        // Card size in world units (apparent size constant)
        const desiredWorldHeight = (cardHeightPixels / this.dimensions.height) * worldHeight;
        const halfHeight = desiredWorldHeight / 2;
        const cardAspectRatio = 0.8; // aligned with UI
        const halfWidth = halfHeight * cardAspectRatio;

        // Compute MVP
        const mvpMatrix = mat4.create();
        const pv = mat4.create();
        mat4.multiply(pv, projectionMatrix, viewMatrix);
        mat4.multiply(mvpMatrix, pv, modelMatrix);
        this.gl.uniformMatrix4fv(this.mvpMatrixUniformLocation, false, mvpMatrix);

        // Bending uniforms (already set during swipe for dynamic change; set defaults otherwise)
        if (this.animationPhase !== 'swipe') {
            this.gl.uniform1f(this.bendRadiusUniformLocation, 0.0);
            this.gl.uniform1f(this.bendSignUniformLocation, 0.0);
        }
        this.gl.uniform1f(this.halfWidthUniformLocation, halfWidth);
        this.gl.uniform1f(this.halfHeightUniformLocation, halfHeight);
        this.gl.uniform1f(this.coneSlopeUniformLocation, 0.0);

        // Back texture cover-fit UV mapping to square
        const A = this.backTextureAspect;
        let backScaleX = 1.0, backScaleY = 1.0, backOffsetX = 0.0, backOffsetY = 0.0;
        if (A >= 1.0) { backScaleX = 1.0 / A; backOffsetX = (1.0 - backScaleX) * 0.5; }
        else { backScaleY = A; backOffsetY = (1.0 - backScaleY) * 0.5; }
        if (this.backUVScaleUniformLocation) this.gl.uniform2f(this.backUVScaleUniformLocation, backScaleX, backScaleY);
        if (this.backUVOffsetUniformLocation) this.gl.uniform2f(this.backUVOffsetUniformLocation, backOffsetX, backOffsetY);

        // Clear and draw
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Back face
        this.gl.cullFace(this.gl.FRONT);
        this.gl.uniform1i(this.isFrontFaceUniformLocation, 0);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.imageTexture);
        this.gl.uniform1i(this.textureUniformLocation, 0);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertexCount);

        // Front face
        this.gl.cullFace(this.gl.BACK);
        this.gl.uniform1i(this.isFrontFaceUniformLocation, 1);
        if (this.useFrontTextureUniformLocation) this.gl.uniform1i(this.useFrontTextureUniformLocation, 1);
        if (this.frontTextureUniformLocation) {
            this.gl.activeTexture(this.gl.TEXTURE2);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.frontTexture);
            this.gl.uniform1i(this.frontTextureUniformLocation, 2);
        }
        if (this.cardValueUniformLocation) this.gl.uniform1f(this.cardValueUniformLocation, cfg.value);
        if (this.isRedSuitUniformLocation) this.gl.uniform1f(this.isRedSuitUniformLocation, this.isRedSuit(cfg.suit) ? 1.0 : 0.0);
        if (this.suitIndexUniformLocation) this.gl.uniform1f(this.suitIndexUniformLocation, this.getSuitValue(cfg.suit));
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertexCount);

        if (this.animationPhase !== 'idle') {
            this.animationId = requestAnimationFrame(this.animate);
        } else {
            this.animationId = null;
        }
    }

    public start() { if (!this.animationId) { this.replayAnimation(); } }
    public stop() { if (this.animationId) cancelAnimationFrame(this.animationId); }
} 