import { FragmentShaderSource, VertexShaderSource } from "./shaders";
import { mat4, vec3 } from "gl-matrix";

export interface CardConfig {
    suit: 'diamonds' | 'clubs' | 'spades' | 'hearts';
    value: number; // 1=A, 2-10, 11=J, 12=Q, 13=K
    cardHeightPixels?: number;

    // Deal Animation
    dealFrom?: vec3;
    dealTo?: vec3;
    dealDuration?: number;

    // Flip Animation
    flipDuration?: number;
    flipElevation?: number;
    flipYPeak?: number;

    // Settle Animation
    settleTo?: vec3;
    settleDuration?: number;
}

// Simple easing function for smooth animations
function easeOutQuint(t: number) {
    return 1 - Math.pow(1 - t, 5);
}

function easeInQuint(t: number) {
    return t * t * t * t * t;
}

function easeInOutQuint(t: number) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

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
    private animationPhase: 'deal' | 'flip' | 'settle' | 'idle' = 'deal';

    // Card state
    private cardConfig: CardConfig = {
        suit: 'hearts',
        value: 1,
        cardHeightPixels: 140,
        dealDuration: 1000, // Slower deal
        dealFrom: vec3.fromValues(4.0, 1.5, 0), // Start further right
        dealTo: vec3.fromValues(0.0, 1.5, 0), // Top-center (Horizontal slide)
        flipDuration: 800,  // Slower flip
        settleDuration: 700,// Slower settle
        flipElevation: 1.5, // More lift
        flipYPeak: 1.0,     // Higher arc
        settleTo: vec3.fromValues(0, -1.8, 0),
    };

    // --- Animation Path Definitions (World Space Coordinates) ---
    private currentPosition: vec3 = vec3.clone(this.cardConfig.dealFrom!);


    // Uniform locations
    private mvpMatrixUniformLocation: WebGLUniformLocation | null = null;
    private textureUniformLocation: WebGLUniformLocation | null = null;
    private cardValueUniformLocation: WebGLUniformLocation | null = null;
    private isRedSuitUniformLocation: WebGLUniformLocation | null = null;
    private isFrontFaceUniformLocation: WebGLUniformLocation | null = null;
    private suitTextureUniformLocation: WebGLUniformLocation | null = null;

    // Textures
    private imageTexture: WebGLTexture | null = null;
    private whiteTexture: WebGLTexture | null = null;
    private suitTexture: WebGLTexture | null = null;

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
        // --- Get attribute and uniform locations ---
        const positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.mvpMatrixUniformLocation = this.gl.getUniformLocation(this.program, "u_mvp_matrix");
        this.textureUniformLocation = this.gl.getUniformLocation(this.program, "u_texture");
        this.cardValueUniformLocation = this.gl.getUniformLocation(this.program, "u_cardValue");
        this.isRedSuitUniformLocation = this.gl.getUniformLocation(this.program, "u_isRedSuit");
        this.isFrontFaceUniformLocation = this.gl.getUniformLocation(this.program, "u_isFrontFace");
        this.suitTextureUniformLocation = this.gl.getUniformLocation(this.program, "u_suitTexture");

        // --- Create buffer and load vertex data ---
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const positions = [-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        // --- Configure vertex attribute pointer ---
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

        // --- Create textures ---
        this.imageTexture = this.loadImageTexture('/playing-card-back.jpg');
        this.whiteTexture = this.createWhiteTexture();
        this.suitTexture = this.loadImageTexture('/heart.webp');

        // --- Set up GL state ---
        this.gl.useProgram(this.program);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE); // This is the key
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    public updateCardConfig(config: Partial<CardConfig>) {
        this.cardConfig = { ...this.cardConfig, ...config };
        this.replayAnimation(); // Restart animation on card change
    }

    public replayAnimation() {
        this.startTime = performance.now();
        this.animationPhase = 'deal';
        if (!this.animationId) {
            this.animate();
        }
    }

    public resize(newDimensions: { width: number, height: number }) {
        this.dimensions = newDimensions;
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    private isRedSuit(suit: string): boolean {
        return suit === 'hearts' || suit === 'diamonds';
    }

    private getSuitValue(suit: string): number {
        switch (suit) {
            case 'hearts': return 0.0;
            case 'diamonds': return 1.0;
            case 'clubs': return 2.0;
            case 'spades': return 3.0;
            default: return 0.0;
        }
    }

    private createWhiteTexture(): WebGLTexture {
        const texture = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        return texture;
    }

    private loadImageTexture(url: string): WebGLTexture {
        const texture = this.createWhiteTexture(); // Start with white
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
            // Set texture parameters to allow non-power-of-two images
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        };
        image.src = url;
        return texture;
    }

    private animate = (currentTime: number = 0) => {
        if (!this.startTime) {
            this.startTime = currentTime;
        }
        const elapsedTime = currentTime - this.startTime;
        const {
            cardHeightPixels = 140,
            dealDuration = 1000,
            dealFrom = vec3.create(),
            dealTo = vec3.create(),
            flipDuration = 800,
            settleDuration = 700,
            flipElevation = 1.5,
            flipYPeak = 1.0,
            settleTo = vec3.create(),
        } = this.cardConfig;

        // --- Create MVP Matrix ---
        const fieldOfView = 45 * Math.PI / 180;
        const aspect = this.dimensions.width / this.dimensions.height;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

        const modelViewMatrix = mat4.create();
        const cameraDistance = 5.0;
        mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -cameraDistance]);

        // --- Card Size Calculation ---
        // Calculate the scale needed to make the card a specific pixel height
        const worldHeight = 2 * Math.tan(fieldOfView / 2) * cameraDistance;
        const desiredWorldHeight = (cardHeightPixels / this.dimensions.height) * worldHeight;
        const scale = desiredWorldHeight / 2; // Our quad is 2 units tall (-1 to 1)
        const cardAspectRatio = 0.714;
        mat4.scale(modelViewMatrix, modelViewMatrix, [cardAspectRatio * scale, scale, 1]);


        // --- Animation Logic ---
        let flipAngle = Math.PI; // Default to face-down

        // 1. DEAL PHASE (Slide horizontally)
        if (this.animationPhase === 'deal') {
            const progress = Math.min(elapsedTime / dealDuration, 1.0);
            const easedProgress = easeOutQuint(progress);
            lerp(this.currentPosition, dealFrom, dealTo, easedProgress);

            if (progress >= 1.0) {
                this.animationPhase = 'flip';
                this.startTime = currentTime;
            }

            // 2. FLIP PHASE (In-place flip with elevation)
        } else if (this.animationPhase === 'flip') {
            const progress = Math.min(elapsedTime / flipDuration, 1.0);
            const easedProgress = easeOutQuint(progress);

            // Base position is the end of the deal
            vec3.copy(this.currentPosition, dealTo);

            // Add procedural elevation on Y and Z axis for a nice arc
            this.currentPosition[1] += flipYPeak * Math.sin(easedProgress * Math.PI); // Move up and down
            this.currentPosition[2] = flipElevation * Math.sin(easedProgress * Math.PI); // Lift off table

            // Animate flip from PI (face-down) to 2*PI (face-up, flipped "over the top")
            flipAngle = Math.PI + (Math.PI * easedProgress);


            if (progress >= 1.0) {
                this.animationPhase = 'settle';
                this.startTime = currentTime;
            }

            // 3. SETTLE PHASE
        } else if (this.animationPhase === 'settle') {
            const progress = Math.min(elapsedTime / settleDuration, 1.0);
            const easedProgress = easeOutQuint(progress);
            // Settle from the flip position to the final player position
            lerp(this.currentPosition, dealTo, settleTo, easedProgress);
            flipAngle = 2 * Math.PI; // Keep it face up

            if (progress >= 1.0) {
                this.animationPhase = 'idle';
            }

            // 4. IDLE PHASE
        } else { // 'idle'
            vec3.copy(this.currentPosition, settleTo);
            flipAngle = 2 * Math.PI; // Face up
        }


        // --- Apply Transformations ---
        mat4.translate(modelViewMatrix, modelViewMatrix, this.currentPosition);
        mat4.rotate(modelViewMatrix, modelViewMatrix, flipAngle, [1, 0, 0]); // Flip on X-axis


        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, projectionMatrix, modelViewMatrix);
        this.gl.uniformMatrix4fv(this.mvpMatrixUniformLocation, false, mvpMatrix);

        // --- Clear canvas ---
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear to transparent
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // --- Draw back face (with image) ---
        this.gl.cullFace(this.gl.FRONT); // Cull front faces, showing the back
        this.gl.uniform1i(this.isFrontFaceUniformLocation, 0); // 0 means false

        // Explicitly use texture unit 0 for the main image texture
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.imageTexture);
        this.gl.uniform1i(this.textureUniformLocation, 0);

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        // --- Draw front face (with engravings) ---
        this.gl.cullFace(this.gl.BACK); // Cull back faces, showing the front
        this.gl.uniform1i(this.isFrontFaceUniformLocation, 1); // 1 means true
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.whiteTexture);
        this.gl.uniform1f(this.cardValueUniformLocation, this.cardConfig.value);
        this.gl.uniform1f(this.isRedSuitUniformLocation, this.isRedSuit(this.cardConfig.suit) ? 1.0 : 0.0);

        // Bind the suit texture to texture unit 1 for the front face
        if (this.suitTexture) {
            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.suitTexture);
            this.gl.uniform1i(this.suitTextureUniformLocation, 1);
        }

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        // Continue animation as long as it's not idle
        if (this.animationPhase !== 'idle') {
            this.animationId = requestAnimationFrame(this.animate);
        } else {
            this.animationId = null;
        }
    }

    public start() { if (!this.animationId) { this.replayAnimation(); } }

    public stop() { if (this.animationId) cancelAnimationFrame(this.animationId); }
} 