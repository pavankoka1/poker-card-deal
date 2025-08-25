import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { CardInitConfig, MultiCardRenderer, TransitionSpec } from './MultiCardRenderer';

export interface CardsWrapperProps {
    cards: CardInitConfig[];
    style?: React.CSSProperties;
    // Player slot centers in world units; call helper to compute from pixels if needed
    playerSlotsWorld?: Array<{ x: number; y: number }>;
    stackOverlapRatio?: number; // default 0.8
    debugPlayerBounds?: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>; // pixel space for overlay
    scale?: number; // scales the container; anchor remains bottom-center
}

export interface CardsWrapperHandle {
    addCard: (config: CardInitConfig) => void;
    updateCard: (cardId: string, partial: Partial<Omit<CardInitConfig, 'id' | 'transitions'>>) => void;
    enqueueTransition: (cardId: string, transition: TransitionSpec) => void;
    setTransitions: (cardId: string, transitions: TransitionSpec[]) => void;
    resize: (dimensions: { width: number; height: number }) => void;
}

export const CardsWrapper = forwardRef<CardsWrapperHandle, CardsWrapperProps>(
    ({ cards, style, playerSlotsWorld, stackOverlapRatio, debugPlayerBounds, scale }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement | null>(null);
        const rendererRef = useRef<MultiCardRenderer | null>(null);
        const addedIdsRef = useRef<Set<string>>(new Set());
        const resizeObserverRef = useRef<ResizeObserver | null>(null);

        // Debounced resize handler
        const handleResize = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const displayWidth = Math.floor(canvas.clientWidth);
            const displayHeight = Math.floor(canvas.clientHeight);
            const ratio = Math.max(1, Math.floor(window.devicePixelRatio || 1));
            const targetWidth = displayWidth * ratio;
            const targetHeight = displayHeight * ratio;

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }

            if (rendererRef.current) {
                rendererRef.current.resize({
                    width: displayWidth,
                    height: displayHeight,
                });
            }
        }, []);

        // Initialize renderer once
        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const gl = canvas.getContext('webgl');
            if (!gl) return;

            const logicalWidth = Math.floor(canvas.clientWidth);
            const logicalHeight = Math.floor(canvas.clientHeight);
            const renderer = new MultiCardRenderer(gl, {
                width: logicalWidth,
                height: logicalHeight,
            });
            rendererRef.current = renderer;
            renderer.start();

            // Use ResizeObserver for more efficient resize detection
            if (window.ResizeObserver) {
                resizeObserverRef.current = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        if (entry.target === canvas) {
                            handleResize();
                        }
                    }
                });

                resizeObserverRef.current.observe(canvas);
            } else {
                // Fallback to window resize event
                const onResize = () => handleResize();
                window.addEventListener('resize', onResize);

                return () => {
                    window.removeEventListener('resize', onResize);
                    renderer.stop();
                };
            }

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
                if (resizeObserverRef.current) {
                    resizeObserverRef.current.disconnect();
                }
                renderer.stop();
            };
        }, [cards, handleResize, playerSlotsWorld, stackOverlapRatio]);

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

        // Expose imperative API
        useImperativeHandle(
            ref,
            () => ({
                addCard: (config) => rendererRef.current?.addCard(config),
                updateCard: (cardId, partial) => rendererRef.current?.updateCard(cardId, partial),
                enqueueTransition: (cardId, transition) => rendererRef.current?.enqueueTransition(cardId, transition),
                setTransitions: (cardId, transitions) => rendererRef.current?.setTransitions(cardId, transitions),
                resize: (dimensions) => rendererRef.current?.resize(dimensions),
            }),
            [],
        );

        return (
            <>
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        background: 'transparent',
                        maxWidth: '100%',
                        maxHeight: '100%',
                    }}
                />
                {/* {debugPlayerBounds?.map((b, i) => (
                <div key={i} style={{ position: 'absolute', left: b.x * CANVAS_SCALE, top: b.y * CANVAS_SCALE, width: b.width * CANVAS_SCALE, height: b.height * CANVAS_SCALE, border: '1px dashed rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
            ))} */}
            </>
        );
    },
);

CardsWrapper.displayName = 'CardsWrapper';
