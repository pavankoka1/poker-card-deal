import { mat4 } from "gl-matrix";
import { CARD_HEIGHT_PX } from "./core/constants";
import { FragmentShaderSource, VertexShaderSource } from "./shaders";

export type EasingFunction = (t: number) => number;

export interface PropertyEasing {
    x?: EasingFunction;
    y?: EasingFunction;
    z?: EasingFunction;
    rotateX?: EasingFunction;
    rotateY?: EasingFunction;
    rotateZ?: EasingFunction;
    bendAngleDeg?: EasingFunction;
}

export interface TransitionSpec {
    duration: number; // ms
    x?: number;
    y?: number;
    z?: number;
    rotateX?: number; // degrees
    rotateY?: number; // degrees
    rotateZ?: number; // degrees
    bendAngleDeg?: number; // degrees, + right bend, - left bend
    easing?: PropertyEasing; // per-property easing, default linear
    dealToPlayer?: number; // 1..7; if set, overrides x/y/z for this transition
    // Pixel-space targets (converted to world internally)
    xPx?: number;
    yPx?: number;
    zPx?: number;
}

export interface CardInitConfig {
    id: string;
    suit: 'diamonds' | 'clubs' | 'spades' | 'hearts';
    value: number; // 1=A, 11=J, 12=Q, 13=K
    x: number;
    y: number;
    rotateX: number; // degrees
    rotateY: number; // degrees
    rotateZ: number; // degrees
    cardHeightPixels?: number;
    cardWidthPixels?: number;
    cardAspectWH?: number; // width:height
    transitions?: TransitionSpec[];
}

type InternalCardState = {
    id: string;
    suit: CardInitConfig['suit'];
    value: number;
    x: number;
    y: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    z: number;
    cardHeightPixels: number;
    cardWidthPixels?: number;
    cardAspectWH?: number;
    queue: TransitionSpec[];
    // Active transition bookkeeping
    active?: {
        spec: TransitionSpec;
        startAtMs: number;
        startX: number;
        startY: number;
        startZ: number;
        startRX: number;
        startRY: number;
        startRZ: number;
        // Bend uses target angle; start is implicitly 0 unless previous transition left bend
        startBendAngleDeg: number;
    };
    lastBendAngleDeg: number;
};

// Easing helpers
const linear: EasingFunction = (t) => t;
// const easeInOutCubic: EasingFunction = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class MultiCardRenderer {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private animationId: number | null = null;
    private dimensions: { width: number, height: number };

    // Geometry
    private vertexCount: number = 6;

    // Uniforms
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
    private frontUVScaleUniformLocation: WebGLUniformLocation | null = null;
    private frontUVOffsetUniformLocation: WebGLUniformLocation | null = null;
    private backUVScaleUniformLocation: WebGLUniformLocation | null = null;
    private backUVOffsetUniformLocation: WebGLUniformLocation | null = null;
    private cornerRadiusUniformLocation: WebGLUniformLocation | null = null;
    private debugLogged: Set<string> = new Set();

    // Textures
    private backTexture: WebGLTexture | null = null;
    private frontTexture: WebGLTexture | null = null;
    private backTextureAspect: number = 1.0;
    private frontTextureAspect: number = 1.0;

    // Cards
    private cards: Map<string, InternalCardState> = new Map();

    // Player slots and stacking state
    private playerCentersWorld: Array<{ x: number, y: number }> = [];
    private playerStacks: Map<number, number> = new Map(); // playerIndex (1..7) -> count
    private stackOverlapRatio: number = 0.8; // 80% covered, 20% visible

    constructor(gl: WebGLRenderingContext, dimensions: { width: number, height: number }) {
        this.gl = gl;
        this.dimensions = dimensions;
        const vs = this.createShader(gl.VERTEX_SHADER, VertexShaderSource);
        const fs = this.createShader(gl.FRAGMENT_SHADER, FragmentShaderSource);
        this.program = this.createProgram(vs, fs);
        this.init();
    }

    // Public API
    public addCard(init: CardInitConfig) {
        const state: InternalCardState = {
            id: init.id,
            suit: init.suit,
            value: init.value,
            x: init.x,
            y: init.y,
            rotateX: init.rotateX,
            rotateY: init.rotateY,
            rotateZ: init.rotateZ,
            z: 0,
            cardHeightPixels: init.cardHeightPixels ?? 140,
            cardWidthPixels: init.cardWidthPixels,
            cardAspectWH: init.cardAspectWH,
            queue: [...(init.transitions ?? [])],
            lastBendAngleDeg: 0,
        };
        this.cards.set(init.id, state);
    }

    public enqueueTransition(cardId: string, transition: TransitionSpec) {
        const card = this.cards.get(cardId);
        if (!card) return;
        card.queue.push(transition);
        // If idle (no active), start immediately
        if (!card.active) {
            this.startNextTransition(card, performance.now());
        }
    }

    public setTransitions(cardId: string, transitions: TransitionSpec[]) {
        const card = this.cards.get(cardId);
        if (!card) return;
        card.queue = [...transitions];
        card.active = undefined;
    }

    public setPlayerSlots(slotsWorld: Array<{ x: number, y: number }>, stackOverlapRatio: number = 0.8) {
        // Expect slotsWorld in world coordinates relative to canvas center
        this.playerCentersWorld = slotsWorld;
        this.stackOverlapRatio = stackOverlapRatio;
        this.playerStacks.clear();
        // Re-assign any cards already marked to a player to nearest current slot index if needed
    }

    public updateCard(cardId: string, partial: Partial<Omit<CardInitConfig, 'id' | 'transitions'>>) {
        const card = this.cards.get(cardId);
        if (!card) return;
        if (partial.suit) card.suit = partial.suit;
        if (partial.value !== undefined) card.value = partial.value;
        if (partial.x !== undefined) card.x = partial.x;
        if (partial.y !== undefined) card.y = partial.y;
        if (partial.rotateX !== undefined) card.rotateX = partial.rotateX;
        if (partial.rotateY !== undefined) card.rotateY = partial.rotateY;
        if (partial.rotateZ !== undefined) card.rotateZ = partial.rotateZ;
        if (partial.cardHeightPixels !== undefined) card.cardHeightPixels = partial.cardHeightPixels;
    }

    public start() {
        if (!this.animationId) this.animate();
    }

    public stop() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
    }

    public resize(dimensions: { width: number, height: number }) {
        this.dimensions = dimensions;
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    // Internals
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
        // Match CardRenderer fragment uniforms
        this.textureUniformLocation = this.gl.getUniformLocation(this.program, "u_backTexture");
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
        this.frontUVScaleUniformLocation = null; // not used by shader currently
        this.frontUVOffsetUniformLocation = null;
        this.backUVScaleUniformLocation = this.gl.getUniformLocation(this.program, "u_backUVScale");
        this.backUVOffsetUniformLocation = this.gl.getUniformLocation(this.program, "u_backUVOffset");
        this.cornerRadiusUniformLocation = null;

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

        // Textures: align handling with CardRenderer
        this.backTexture = this.loadBackTexture('/images/card-back.jpg');
        // this.frontTexture = this.loadImageTexture('/images/queen-hearts.avif');
        this.frontTexture = this.loadImageTexture('/images/ace-hearts.png');

        // GL state (mirror CardRenderer)
        this.gl.useProgram(this.program);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        // Match CardRenderer GL state for consistent visuals
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
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
            const isPOT = MultiCardRenderer.isPowerOf2(image.width) && MultiCardRenderer.isPowerOf2(image.height);
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
            if (MultiCardRenderer.isPowerOf2(potW) && MultiCardRenderer.isPowerOf2(potH)) {
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
                const max = this.gl.getParameter((ext as any).MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
                this.gl.texParameterf(this.gl.TEXTURE_2D, (ext as any).TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
            }
            // Improve magnification quality
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        };
        image.src = url;
        return texture;
    }

    private loadFrontTexture(url: string): WebGLTexture {
        const texture = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.frontTextureAspect = image.width / image.height;
            let source: HTMLImageElement | HTMLCanvasElement = image;
            let potW = image.width, potH = image.height;
            const isPOT = MultiCardRenderer.isPowerOf2(image.width) && MultiCardRenderer.isPowerOf2(image.height);
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
            if (MultiCardRenderer.isPowerOf2(potW) && MultiCardRenderer.isPowerOf2(potH)) {
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
            } else {
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            }
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            const ext = this.gl.getExtension('EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
            if (ext) {
                const max = this.gl.getParameter((ext as any).MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
                this.gl.texParameterf(this.gl.TEXTURE_2D, (ext as any).TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
            }
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
            const isPOT = MultiCardRenderer.isPowerOf2(image.width) && MultiCardRenderer.isPowerOf2(image.height);
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
            if (MultiCardRenderer.isPowerOf2(potW) && MultiCardRenderer.isPowerOf2(potH)) {
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
            } else {
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            }
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            const ext = this.gl.getExtension('EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
            if (ext) {
                const max = this.gl.getParameter((ext as any).MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
                this.gl.texParameterf(this.gl.TEXTURE_2D, (ext as any).TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
            }
        };
        image.src = url;
        return texture;
    }

    private isRedSuit(suit: string): boolean { return suit === 'hearts' || suit === 'diamonds'; }
    private getSuitValue(suit: string): number { switch (suit) { case 'hearts': return 0.0; case 'diamonds': return 1.0; case 'clubs': return 2.0; case 'spades': return 3.0; default: return 0.0; } }

    private startNextTransition(card: InternalCardState, now: number) {
        if (card.active) return; // already running
        const next = card.queue.shift();
        if (!next) return;
        let resolved = next;
        // Convert pixel targets to world if supplied
        if (next.xPx !== undefined || next.yPx !== undefined || next.zPx !== undefined) {
            const { worldWidth, worldHeight } = this.computeWorldDimensions();
            const toWorldX = (xPx: number) => (xPx / this.dimensions.width - 0.5) * worldWidth;
            const toWorldY = (yPx: number) => -((yPx / this.dimensions.height - 0.5) * worldHeight);
            resolved = {
                ...resolved,
                x: next.xPx !== undefined ? toWorldX(next.xPx) : resolved.x,
                y: next.yPx !== undefined ? toWorldY(next.yPx) : resolved.y,
                z: next.zPx !== undefined ? (next.zPx / this.dimensions.height) * worldHeight : resolved.z,
            };
        }
        if (next.dealToPlayer && this.playerCentersWorld.length >= next.dealToPlayer) {
            const idx = next.dealToPlayer; // 1..N
            const center = this.playerCentersWorld[idx - 1];
            // Compute world card height to stack with overlap
            const { worldHeight } = this.computeWorldDimensions();
            // Use global CARD_HEIGHT_PX to keep height configurable in one place
            const effectiveCardHeightPx = CARD_HEIGHT_PX;
            const desiredWorldHeight = (effectiveCardHeightPx / this.dimensions.height) * worldHeight;
            const visibleFrac = Math.max(0, Math.min(1, 1 - this.stackOverlapRatio));
            const perCardYOffset = desiredWorldHeight * visibleFrac;
            const count = this.playerStacks.get(idx) ?? 0;
            const stackedY = center.y + perCardYOffset * count;
            // Force z to 0 so cards lie on the same plane when stacked
            resolved = { ...next, x: center.x, y: stackedY, z: 0 };
            // Debug log the computed placement
            try {
                // eslint-disable-next-line no-console
                console.log('[DealToPlayer]', {
                    cardId: card.id,
                    playerIndex: idx,
                    stackCountBefore: count,
                    center,
                    desiredWorldHeight,
                    visibleFrac,
                    perCardYOffset,
                    target: { x: center.x, y: stackedY, z: 0 }
                });
            } catch { }
        }
        card.active = {
            spec: resolved,
            startAtMs: now,
            startX: card.x,
            startY: card.y,
            startZ: card.z,
            startRX: card.rotateX,
            startRY: card.rotateY,
            startRZ: card.rotateZ,
            startBendAngleDeg: card.lastBendAngleDeg,
        };
    }

    private animate = (now: number = 0) => {
        const fieldOfView = 45 * Math.PI / 180;
        const aspect = this.dimensions.width / this.dimensions.height;
        const cameraZ = 3;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

        const { worldWidth, worldHeight } = this.computeWorldDimensions();

        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -cameraZ]);

        // Clear scene
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Will compute per card using card aspect

        // Draw each card
        try { console.log('[MultiCardRenderer] draw count', this.cards.size); } catch { }
        this.cards.forEach((card) => {
            // Transition bookkeeping
            if (!card.active && card.queue.length > 0) {
                this.startNextTransition(card, now);
            }

            let bendAngleThisFrame = 0;

            if (card.active) {
                const { spec, startAtMs, startX, startY, startZ, startRX, startRY, startRZ, startBendAngleDeg } = card.active;
                const t = Math.min(Math.max((now - startAtMs) / spec.duration, 0), 1);
                const eX = spec.easing?.x ?? linear;
                const eY = spec.easing?.y ?? linear;
                const eZ = spec.easing?.z ?? linear;
                const eRX = spec.easing?.rotateX ?? linear;
                const eRY = spec.easing?.rotateY ?? linear;
                const eRZ = spec.easing?.rotateZ ?? linear;
                const eB = spec.easing?.bendAngleDeg ?? linear;

                const endX = spec.x !== undefined ? spec.x : startX;
                const endY = spec.y !== undefined ? spec.y : startY;
                const endZ = spec.z !== undefined ? spec.z : startZ;
                const endRX = spec.rotateX !== undefined ? spec.rotateX : startRX;
                const endRY = spec.rotateY !== undefined ? spec.rotateY : startRY;
                const endRZ = spec.rotateZ !== undefined ? spec.rotateZ : startRZ;
                const endBend = spec.bendAngleDeg !== undefined ? spec.bendAngleDeg : startBendAngleDeg;

                card.x = startX + (endX - startX) * eX(t);
                card.y = startY + (endY - startY) * eY(t);
                card.z = startZ + (endZ - startZ) * eZ(t);
                card.rotateX = startRX + (endRX - startRX) * eRX(t);
                card.rotateY = startRY + (endRY - startRY) * eRY(t);
                card.rotateZ = startRZ + (endRZ - startRZ) * eRZ(t);
                bendAngleThisFrame = startBendAngleDeg + (endBend - startBendAngleDeg) * eB(t);

                if (t >= 1) {
                    // Finish transition and move to next
                    card.lastBendAngleDeg = endBend;
                    if (spec.dealToPlayer) {
                        const idx = spec.dealToPlayer;
                        this.playerStacks.set(idx, (this.playerStacks.get(idx) ?? 0) + 1);
                    }
                    card.active = undefined;
                    if (card.queue.length > 0) this.startNextTransition(card, now);
                }
            } else {
                bendAngleThisFrame = card.lastBendAngleDeg;
            }

            // Build model matrix
            const modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, [card.x, card.y, card.z]);
            // Correct rotation direction to match desired visual orientation
            mat4.rotateX(modelMatrix, modelMatrix, (card.rotateX * Math.PI) / 180);
            mat4.rotateY(modelMatrix, modelMatrix, (card.rotateY * Math.PI) / 180);
            mat4.rotateZ(modelMatrix, modelMatrix, (card.rotateZ * Math.PI) / 180);

            // Card size in world units: use global constants to keep cards small and consistent
            const effectiveCardHeightPx = CARD_HEIGHT_PX;
            const desiredWorldHeight = (effectiveCardHeightPx / this.dimensions.height) * worldHeight;
            const halfHeight = desiredWorldHeight / 2;
            // Match CardRenderer aspect for best front texture quality
            const cardAspectRatio = 0.8;
            const halfWidth = halfHeight * cardAspectRatio;

            if (!this.debugLogged.has(card.id)) {
                try {
                    // eslint-disable-next-line no-console
                    console.log('[CardSize]', {
                        cardId: card.id,
                        effectiveCardHeightPx,
                        desiredWorldHeight,
                        halfWidth,
                        halfHeight
                    });
                } catch { }
                this.debugLogged.add(card.id);
            }

            // Compute MVP
            const mvpMatrix = mat4.create();
            const pv = mat4.create();
            mat4.multiply(pv, projectionMatrix, viewMatrix);
            mat4.multiply(mvpMatrix, pv, modelMatrix);
            this.gl.uniformMatrix4fv(this.mvpMatrixUniformLocation, false, mvpMatrix);
            if (this.cornerRadiusUniformLocation) this.gl.uniform1f(this.cornerRadiusUniformLocation, 0.04);

            // Bending from bendAngleThisFrame
            let effectiveRadius = 0.0;
            let bendSign = 0.0;
            if (Math.abs(bendAngleThisFrame) > 0.0001) {
                const fullWidth = 2.0 * halfWidth;
                const angleRad = Math.abs(bendAngleThisFrame) * Math.PI / 180.0;
                effectiveRadius = Math.max(0.001, fullWidth / angleRad);
                bendSign = bendAngleThisFrame < 0 ? -1.0 : 1.0;
            }
            this.gl.uniform1f(this.bendRadiusUniformLocation, effectiveRadius);
            this.gl.uniform1f(this.bendSignUniformLocation, bendSign);
            this.gl.uniform1f(this.halfWidthUniformLocation, halfWidth);
            this.gl.uniform1f(this.halfHeightUniformLocation, halfHeight);
            this.gl.uniform1f(this.coneSlopeUniformLocation, 0.0);

            // No UV scale/offset required for Bend-style shader

            // Back texture cover-fit UV mapping to square (match CardRenderer)
            const A = this.backTextureAspect;
            let backScaleX = 1.0, backScaleY = 1.0, backOffsetX = 0.0, backOffsetY = 0.0;
            if (A >= 1.0) { backScaleX = 1.0 / A; backOffsetX = (1.0 - backScaleX) * 0.5; }
            else { backScaleY = A; backOffsetY = (1.0 - backScaleY) * 0.5; }
            if (this.backUVScaleUniformLocation) this.gl.uniform2f(this.backUVScaleUniformLocation, backScaleX, backScaleY);
            if (this.backUVOffsetUniformLocation) this.gl.uniform2f(this.backUVOffsetUniformLocation, backOffsetX, backOffsetY);

            // Draw back face (cull front faces like CardRenderer)
            this.gl.cullFace(this.gl.FRONT);
            this.gl.uniform1i(this.isFrontFaceUniformLocation, 0);
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.backTexture);
            this.gl.uniform1i(this.textureUniformLocation, 0);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertexCount);

            // Draw front face (cull back faces like CardRenderer)
            this.gl.cullFace(this.gl.BACK);
            this.gl.uniform1i(this.isFrontFaceUniformLocation, 1);
            if (this.frontTextureUniformLocation) {
                this.gl.activeTexture(this.gl.TEXTURE2);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.frontTexture);
                this.gl.uniform1i(this.frontTextureUniformLocation, 2);
            }
            this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertexCount);
        });

        this.animationId = requestAnimationFrame(this.animate);
    };

    private computeWorldDimensions() {
        const fieldOfView = 45 * Math.PI / 180;
        const aspect = this.dimensions.width / this.dimensions.height;
        const cameraZ = 3;
        const worldHeight = 2 * Math.tan(fieldOfView / 2) * cameraZ;
        const worldWidth = worldHeight * aspect;
        return { worldWidth, worldHeight };
    }
}

