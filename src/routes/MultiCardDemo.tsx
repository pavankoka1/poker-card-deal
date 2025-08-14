import { useEffect, useMemo, useState } from 'react';
import { CardsWrapper, CardInitConfig } from '../components/card-animation';
import { CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX, INITIAL_CARD_COUNT, INITIAL_STACK_OFFSET_RIGHT_PX, INITIAL_STACK_OFFSET_TOP_PX, INITIAL_STACK_DELTA_X_PX, STACK_OVERLAP_RATIO, CANVAS_SCALE, DEAL_DURATION_MS, MOVE_TO_CENTER_DURATION_MS, FLIP_PART_DURATION_MS, FLIP_Y_PEAK_PX, INITIAL_ROTATION_DEGREES } from '../components/card-animation/core/constants';
import { computePlayerLayoutRects } from '../components/card-animation/core/utils';

export const MultiCardDemo = () => {

    // Canvas config
    const canvasPx = useMemo(() => ({ width: CANVAS_WIDTH_PX, height: CANVAS_HEIGHT_PX } as const), []);
    // Player rectangles and centers in pixel space via utils
    const { rects: playerRectsPx, centers: centersPx, card: cardPx } = useMemo(() => computePlayerLayoutRects(canvasPx), [canvasPx]);

    // Convert pixel centers to world using the fixed canvas size
    const centersWorld = useMemo(() => {
        const w = canvasPx.width, h = canvasPx.height;
        // Use the same mapping as the renderer: (0,0) top-left in px to world centered
        return centersPx.map((c) => ({ x: (c.x / w - 0.5) * (w / h) * (2 * Math.tan((45 * Math.PI / 180) / 2) * 3), y: -((c.y / h - 0.5) * (2 * Math.tan((45 * Math.PI / 180) / 2) * 3)) }));
    }, [centersPx, canvasPx.width, canvasPx.height]);

    // Generate cards stacked at top-right with slight x staggers; no initial transitions
    const initialCards: CardInitConfig[] = useMemo(() => {
        const cards: CardInitConfig[] = [];
        for (let i = 0; i < INITIAL_CARD_COUNT; i++) {
            const id = `C${i + 1}`;
            const suit: CardInitConfig['suit'] = ['hearts', 'diamonds', 'clubs', 'spades'][i % 4] as any;
            const value = (i % 13) + 1;
            // initial px positions (top-right)
            const xPx = canvasPx.width - INITIAL_STACK_OFFSET_RIGHT_PX - i * INITIAL_STACK_DELTA_X_PX;
            const yPx = INITIAL_STACK_OFFSET_TOP_PX;
            // world center mapping
            const worldFactor = (2 * Math.tan((45 * Math.PI / 180) / 2) * 3);
            const wx = (xPx / canvasPx.width - 0.5) * (canvasPx.width / canvasPx.height) * worldFactor;
            const wy = -((yPx / canvasPx.height - 0.5) * worldFactor);

            // helpers retained if needed later

            const playerIndex = (i % centersWorld.length) + 1; // 1..N
            const centerXPx = Math.round(canvasPx.width / 2);
            cards.push({
                id,
                suit,
                value,
                x: wx,
                y: wy,
                // Face the camera more for initial stacked visibility
                rotateX: INITIAL_ROTATION_DEGREES[0],
                rotateY: INITIAL_ROTATION_DEGREES[1],
                rotateZ: INITIAL_ROTATION_DEGREES[2],
                cardHeightPixels: Math.round(cardPx.height),
                transitions: [
                    // Make them immediately visible by applying a no-op transition
                    { duration: 1 },
                    // Stagger: wait i * 1000ms before starting motion
                    { duration: i * 1000, bendAngleDeg: -90 },
                    // Move horizontally to canvas center (keep Y)
                    { duration: MOVE_TO_CENTER_DURATION_MS, xPx: centerXPx, yPx: yPx, bendAngleDeg: 0 },
                    // Flip part 1: lift up and rotate half
                    { duration: FLIP_PART_DURATION_MS, rotateX: 135, rotateY: 0, rotateZ: 0, yPx: yPx },
                    // Flip part 2: come down and finish rotation
                    { duration: FLIP_PART_DURATION_MS, rotateX: 135 + 180, yPx: yPx },
                    // Then move to assigned player slot
                    { duration: DEAL_DURATION_MS, dealToPlayer: playerIndex }
                ],
            });
        }
        console.log(cards)
        return cards;
    }, [cardPx.height, canvasPx.width, canvasPx.height, centersWorld.length]);

    // Stagger using rAF-based delay per card via child gates
    const [visibleCards, setVisibleCards] = useState<CardInitConfig[]>(initialCards);
    useEffect(() => { setVisibleCards(initialCards); }, [initialCards]);

    const scaledW = Math.round(canvasPx.width * CANVAS_SCALE);
    const scaledH = Math.round(canvasPx.height * CANVAS_SCALE);
    return (
        <div style={{ position: 'fixed', inset: 0, background: "#1a1a1a url('/images/bg.png') center/contain no-repeat" }}>
            <div style={{ position: 'absolute', left: '50%', bottom: 0, width: `${scaledW}px`, height: `${scaledH}px`, transform: `translateX(-50%)`, transformOrigin: 'bottom center' }}>
                <CardsWrapper
                    cards={visibleCards}
                    playerSlotsWorld={centersWorld}
                    stackOverlapRatio={STACK_OVERLAP_RATIO}
                    debugPlayerBounds={playerRectsPx}
                    style={{ width: '100%', height: '100%' }}
                />
                {/* No gates; all cards present as a stack initially */}
            </div>
        </div>
    );
};

// Gates removed for initial stacked layout

