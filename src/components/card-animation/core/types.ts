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
    // World-space targets (computed from pixels internally when px variants are provided)
    x?: number;
    y?: number;
    z?: number;
    rotateX?: number; // degrees
    rotateY?: number; // degrees
    rotateZ?: number; // degrees
    bendAngleDeg?: number; // degrees, + right bend, - left bend
    easing?: PropertyEasing; // per-property easing, default linear
    dealToPlayer?: number; // 1..7; if set, overrides x/y/z for this transition

    // Optional pixel-space targets
    xPx?: number;
    yPx?: number;
    zPx?: number;
}

export interface CardInitConfig {
    id: string;
    suit: 'diamonds' | 'clubs' | 'spades' | 'hearts';
    value: number; // 1=A, 11=J, 12=Q, 13=K
    x: number; // world
    y: number; // world
    rotateX: number; // degrees
    rotateY: number; // degrees
    rotateZ: number; // degrees
    cardHeightPixels?: number;
    cardWidthPixels?: number;
    cardAspectWH?: number; // width:height ratio (default from constants)
    transitions?: TransitionSpec[];
}

