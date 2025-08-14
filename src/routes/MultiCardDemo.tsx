import { useMemo } from 'react';
import { CardsWrapper, CardInitConfig, TransitionSpec } from '../components/card-animation';
import { CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX, INITIAL_CARD_COUNT, INITIAL_STACK_OFFSET_RIGHT_PX, INITIAL_STACK_OFFSET_TOP_PX, INITIAL_STACK_DELTA_X_PX, INITIAL_ROTATION_DEGREES, DEAL_DELAY_PER_CARD_MS, STACK_OVERLAP_RATIO, MOVE_TO_CENTER_DURATION_MS, FLIP_PART_DURATION_MS, DEAL_DURATION_MS, FLIP_Y_PEAK_PX, CANVAS_SCALE, PLAYER_TILT_Z_PER_STEP_DEG } from '../components/card-animation/core/constants';
import { computePlayerLayoutRects } from '../components/card-animation/core/utils';

export const MultiCardDemo = () => {

    // Canvas config
    const canvasPx = { width: CANVAS_WIDTH_PX, height: CANVAS_HEIGHT_PX } as const;
    // Player rectangles and centers in pixel space via utils
    const { rects: playerRectsPx, centers: centersPx, card: cardPx } = useMemo(() => computePlayerLayoutRects(canvasPx), [canvasPx.width, canvasPx.height]);

    // Convert pixel centers to world using the fixed canvas size
    const centersWorld = useMemo(() => {
        const w = canvasPx.width, h = canvasPx.height;
        // Use the same mapping as the renderer: (0,0) top-left in px to world centered
        return centersPx.map((c) => ({ x: (c.x / w - 0.5) * (w / h) * (2 * Math.tan((45 * Math.PI / 180) / 2) * 3), y: -((c.y / h - 0.5) * (2 * Math.tan((45 * Math.PI / 180) / 2) * 3)) }));
    }, [centersPx, canvasPx.width, canvasPx.height]);

    // Generate 14 cards stacked at top-right with slight x staggers
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

            const toWorldX = (px: number) => (px / canvasPx.width - 0.5) * (canvasPx.width / canvasPx.height) * worldFactor;
            const toWorldY = (py: number) => -((py / canvasPx.height - 0.5) * worldFactor);

            const wait: TransitionSpec = { duration: i * DEAL_DELAY_PER_CARD_MS };
            const moveToCenter: TransitionSpec = {
                duration: MOVE_TO_CENTER_DURATION_MS,
                x: toWorldX(canvasPx.width / 2),
                y: wy,
                rotateX: 135,
                rotateY: 0,
                rotateZ: 0,
            };
            const flipUp: TransitionSpec = {
                duration: FLIP_PART_DURATION_MS,
                y: toWorldY((canvasPx.height / 2) - FLIP_Y_PEAK_PX),
                rotateX: 315,
            };
            // Merge tilt into deal transition itself
            const tiltSteps = Math.abs(((i % 7) + 1) - 4);
            const tiltZ = tiltSteps * PLAYER_TILT_Z_PER_STEP_DEG * ((((i % 7) + 1) < 4) ? 1 : -1);
            const dealToSlot: TransitionSpec = {
                duration: DEAL_DURATION_MS,
                dealToPlayer: ((i % 7) + 1),
                rotateZ: tiltZ,
            };
            cards.push({
                id,
                suit,
                value,
                x: wx,
                y: wy,
                rotateX: INITIAL_ROTATION_DEGREES[0],
                rotateY: INITIAL_ROTATION_DEGREES[1],
                rotateZ: INITIAL_ROTATION_DEGREES[2],
                cardHeightPixels: Math.round(cardPx.height),
                transitions: [wait, moveToCenter, flipUp, dealToSlot],
            });
        }
        console.log(cards)
        return cards;
    }, [cardPx.height, canvasPx.width, canvasPx.height]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: "#1a1a1a url('/images/bg.png') center/contain no-repeat" }}>
            <div style={{ position: 'absolute', left: '50%', bottom: 0, width: `${canvasPx.width}px`, height: `${canvasPx.height}px`, transform: `translateX(-50%) scale(${CANVAS_SCALE})`, transformOrigin: 'bottom center' }}>
                <CardsWrapper
                    cards={initialCards}
                    playerSlotsWorld={centersWorld}
                    stackOverlapRatio={STACK_OVERLAP_RATIO}
                    debugPlayerBounds={playerRectsPx}
                    style={{ width: '100%', height: '100%' }}
                    scale={CANVAS_SCALE}
                />
            </div>
        </div>
    );
};

