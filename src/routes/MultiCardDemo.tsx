import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardInitConfig, CardsWrapper } from '../components/card-animation';
import {
    CANVAS_HEIGHT_PX,
    CANVAS_SCALE,
    CANVAS_WIDTH_PX,
    DEAL_DURATION_MS,
    FLIP_PART_DURATION_MS,
    INITIAL_CARD_COUNT,
    INITIAL_ROTATION_DEGREES,
    INITIAL_STACK_DELTA_X_PX,
    INITIAL_STACK_OFFSET_RIGHT_PX,
    INITIAL_STACK_OFFSET_TOP_PX,
    MOVE_TO_CENTER_DURATION_MS,
    STACK_OVERLAP_RATIO,
} from '../components/card-animation/core/constants';
import { computePlayerLayoutRects } from '../components/card-animation/core/utils';
import { NavigationControls } from '../components/NavigationControls';
import { NavigationTest } from '../components/NavigationTest';
import { useNavigation } from '../hooks/useNavigation';
import { useResponsiveScaling } from '../hooks/useResponsiveScaling';

export const MultiCardDemo = () => {
    const [windowW, setWindowW] = useState<number>(window.innerWidth);
    const cardsWrapperRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // Custom hooks
    const { position: cardsWrapperPosition, navigateLeft, navigateRight, resetPosition } = useNavigation();
    const { cardsParentLayout, scaledCardsW, scaledCardsH } = useResponsiveScaling(windowW);

    // Debounced resize handler
    const handleResize = useCallback(() => {
        setWindowW(window.innerWidth);
    }, []);

    useEffect(() => {
        // Use ResizeObserver for more efficient resize detection
        if (window.ResizeObserver) {
            resizeObserverRef.current = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.target === document.documentElement) {
                        handleResize();
                    }
                }
            });

            // Observe the document element for window size changes
            resizeObserverRef.current.observe(document.documentElement);
        } else {
            // Fallback to event listener
            window.addEventListener('resize', handleResize);
        }

        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            } else {
                window.removeEventListener('resize', handleResize);
            }
        };
    }, [handleResize]);

    // Canvas config - restore original working dimensions
    const canvasPx = useMemo(() => ({ width: CANVAS_WIDTH_PX, height: CANVAS_HEIGHT_PX } as const), []);

    // Player rectangles and centers in pixel space via utils
    const {
        rects: playerRectsPx,
        centers: centersPx,
        card: cardPx,
    } = useMemo(() => computePlayerLayoutRects(canvasPx), [canvasPx]);

    // Convert pixel centers to world using the responsive canvas size
    const centersWorld = useMemo(() => {
        const w = canvasPx.width,
            h = canvasPx.height;
        return centersPx.map((c) => ({
            x: (c.x / w - 0.5) * (w / h) * (2 * Math.tan((45 * Math.PI) / 180 / 2) * 3),
            y: -((c.y / h - 0.5) * (2 * Math.tan((45 * Math.PI) / 180 / 2) * 3)),
        }));
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
            const worldFactor = 2 * Math.tan((45 * Math.PI) / 180 / 2) * 3;
            const wx = (xPx / canvasPx.width - 0.5) * (canvasPx.width / canvasPx.height) * worldFactor;
            const wy = -((yPx / canvasPx.height - 0.5) * worldFactor);

            const playerIndex = (i % centersWorld.length) + 1; // 1..N
            const centerXPx = (canvasPx.width / 2) * CANVAS_SCALE;
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
                transitions: [
                    { duration: 1 },
                    { duration: i * 1000, bendAngleDeg: 0 },
                    {
                        duration: MOVE_TO_CENTER_DURATION_MS / 2,
                        xPx: centerXPx + centerXPx / 2,
                        bendAngleDeg: -90,
                    },
                    {
                        duration: MOVE_TO_CENTER_DURATION_MS / 2,
                        xPx: centerXPx,
                        bendAngleDeg: 0,
                    },
                    {
                        duration: FLIP_PART_DURATION_MS,
                        rotateX: 135,
                        rotateY: 0,
                        rotateZ: 0,
                    },
                    { duration: FLIP_PART_DURATION_MS, rotateX: 315 },
                    { duration: DEAL_DURATION_MS, dealToPlayer: playerIndex },
                ],
            });
        }
        return cards;
    }, [cardPx.height, canvasPx.width, canvasPx.height, centersWorld.length]);

    const [visibleCards, setVisibleCards] = useState<CardInitConfig[]>(initialCards);

    useEffect(() => {
        setVisibleCards(initialCards);
    }, [initialCards]);

    // Check if navigation buttons are needed
    const needsNavigation = scaledCardsW > windowW * 0.9;

    // Calculate final transform values to avoid multiple translate issues
    const finalTransformX = -50 + cardsWrapperPosition.x / (scaledCardsW / 100);
    const finalTransformY = -50 + cardsWrapperPosition.y / (scaledCardsH / 100);

    // Debug: Log current state
    console.log('Current state:', {
        windowW,
        scaledCardsW,
        scaledCardsH,
        cardsWrapperPosition,
        finalTransformX,
        finalTransformY,
        needsNavigation,
        cardsParentLayout,
    });

    return (
        <div
            style={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                background: '#1a1a1a',
                overflow: 'hidden',
            }}
        >
            {/* Debug Navigation Test */}
            <NavigationTest
                position={cardsWrapperPosition}
                navigateLeft={navigateLeft}
                navigateRight={navigateRight}
                resetPosition={resetPosition}
            />
            {/* Absolutely positioned casino table image for background */}
            <img
                src="/images/bg.png"
                alt="Casino Table"
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${scaledCardsW}px`, // Sync with CardsWrapper container
                    height: `${scaledCardsH}px`, // Sync with CardsWrapper container
                    transform: `scale(${cardsParentLayout.scale}) translate(${finalTransformX}%, ${finalTransformY}%)`,
                    transformOrigin: 'top left',
                    zIndex: 0,
                    transition: 'transform 0.3s cubic-bezier(.56,.04,.69,.83)',
                    pointerEvents: 'none',
                }}
            />

            {/* Navigation Controls */}
            <NavigationControls
                onNavigateLeft={navigateLeft}
                onNavigateRight={navigateRight}
                needsNavigation={needsNavigation}
            />

            {/* Cards & player bets wrapper - now responsive and navigable */}
            <div
                ref={cardsWrapperRef}
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${scaledCardsW}px`,
                    height: `${scaledCardsH}px`,
                    transform: `scale(${cardsParentLayout.scale}) translate(${finalTransformX}%, ${finalTransformY}%)`,
                    transformOrigin: 'top left',
                    zIndex: 1,
                    transition: 'transform 0.3s cubic-bezier(.56,.04,.69,.83)',
                    overflow: 'visible',
                }}
            >
                <CardsWrapper
                    cards={visibleCards}
                    playerSlotsWorld={centersWorld}
                    stackOverlapRatio={STACK_OVERLAP_RATIO}
                    debugPlayerBounds={playerRectsPx}
                    style={{
                        width: `${CANVAS_WIDTH_PX}px`, // Restore original working dimensions
                        height: `${CANVAS_HEIGHT_PX}px`, // Restore original working dimensions
                    }}
                />
            </div>
        </div>
    );
};
