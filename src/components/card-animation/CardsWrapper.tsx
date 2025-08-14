import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { MultiCardRenderer, CardInitConfig, TransitionSpec } from "./MultiCardRenderer";

export interface CardsWrapperProps {
    cards: CardInitConfig[];
    style?: React.CSSProperties;
    // Player slot centers in world units; call helper to compute from pixels if needed
    playerSlotsWorld?: Array<{ x: number, y: number }>;
    stackOverlapRatio?: number; // default 0.8
    debugPlayerBounds?: Array<{ x: number, y: number, width: number, height: number }>; // pixel space for overlay
    scale?: number; // scales the container; anchor remains bottom-center
}

export interface CardsWrapperHandle {
    addCard: (config: CardInitConfig) => void;
    updateCard: (cardId: string, partial: Partial<Omit<CardInitConfig, 'id' | 'transitions'>>) => void;
    enqueueTransition: (cardId: string, transition: TransitionSpec) => void;
    setTransitions: (cardId: string, transitions: TransitionSpec[]) => void;
}

export const CardsWrapper = forwardRef<CardsWrapperHandle, CardsWrapperProps>(({ cards, style, playerSlotsWorld, stackOverlapRatio, debugPlayerBounds, scale }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<MultiCardRenderer | null>(null);
    const addedIdsRef = useRef<Set<string>>(new Set());

    useImperativeHandle(ref, () => ({
        addCard: (config) => rendererRef.current?.addCard(config),
        updateCard: (cardId, partial) => rendererRef.current?.updateCard(cardId, partial),
        enqueueTransition: (cardId, transition) => rendererRef.current?.enqueueTransition(cardId, transition),
        setTransitions: (cardId, transitions) => rendererRef.current?.setTransitions(cardId, transitions),
    }), []);

    // Initialize renderer once
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        const logicalWidth = Math.floor(canvas.clientWidth);
        const logicalHeight = Math.floor(canvas.clientHeight);
        const renderer = new MultiCardRenderer(gl, { width: logicalWidth, height: logicalHeight });
        rendererRef.current = renderer;
        renderer.start();

        const resize = () => {
            const displayWidth = Math.floor(canvas.clientWidth);
            const displayHeight = Math.floor(canvas.clientHeight);
            const ratio = Math.max(1, Math.floor(window.devicePixelRatio || 1));
            const targetWidth = displayWidth * ratio;
            const targetHeight = displayHeight * ratio;
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }
            renderer.resize({ width: displayWidth, height: displayHeight });
        };
        const onResize = () => resize();
        window.addEventListener('resize', onResize);
        resize();

        // Initialize slots if provided
        if (playerSlotsWorld && playerSlotsWorld.length) {
            renderer.setPlayerSlots(playerSlotsWorld, stackOverlapRatio ?? 0.8);
        }

        // Add initial cards immediately to avoid race with separate effect
        for (const c of cards) {
            renderer.addCard(c);
            addedIdsRef.current.add(c.id);
        }

        return () => {
            window.removeEventListener('resize', onResize);
            renderer.stop();
        };
    }, []);

    // Apply player slots updates
    useEffect(() => {
        if (!rendererRef.current) return;
        if (playerSlotsWorld && playerSlotsWorld.length) {
            rendererRef.current.setPlayerSlots(playerSlotsWorld, stackOverlapRatio ?? 0.8);
        }
    }, [playerSlotsWorld, stackOverlapRatio]);

    // Incrementally add new cards without re-initializing renderer
    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        for (const c of cards) {
            if (!addedIdsRef.current.has(c.id)) {
                renderer.addCard(c);
                addedIdsRef.current.add(c.id);
            }
        }
    }, [cards]);

    const scaleVal = scale ?? 1;
    const containerStyle: React.CSSProperties = {
        position: 'relative',
        transform: `scale(${scaleVal})`,
        transformOrigin: 'bottom center',
        ...style,
    };

    return (
        <div style={containerStyle}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', background: 'transparent', border: '1px solid #fff' }} />
            {debugPlayerBounds?.map((b, i) => (
                <div key={i} style={{ position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height, border: '1px dashed rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
            ))}
        </div>
    );
});

CardsWrapper.displayName = 'CardsWrapper';

