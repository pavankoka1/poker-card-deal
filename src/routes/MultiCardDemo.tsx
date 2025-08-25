import { useEffect, useMemo, useState } from "react";
import { CardInitConfig, CardsWrapper } from "../components/card-animation";
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
} from "../components/card-animation/core/constants";
import { computePlayerLayoutRects } from "../components/card-animation/core/utils";

// Type for breakpoints/configs
type LayoutConfig = {
  minWidth: number;
  scale: number;
  left: number;
  top: number;
};

// Breakpoints/config for image container
const IMAGE_CONFIGS: LayoutConfig[] = [
  { minWidth: 0, scale: 1.6, left: 20, top: 30 },
  { minWidth: 800, scale: 2, left: 60, top: 80 },
  { minWidth: 1200, scale: 2.4, left: 100, top: 120 },
];

const CARDSWRAPPER_CONFIGS: LayoutConfig[] = [
  { minWidth: 0, scale: 0.8, left: 20, top: 30 },
  { minWidth: 800, scale: 1, left: 60, top: 80 },
  { minWidth: 1200, scale: 1.2, left: 100, top: 120 },
];

function getResponsiveConfig(
  configs: LayoutConfig[],
  width: number
): LayoutConfig {
  return (
    configs
      .filter((bp: LayoutConfig) => width >= bp.minWidth)
      .sort((a: LayoutConfig, b: LayoutConfig) => b.minWidth - a.minWidth)[0] ||
    configs
  );
}

export const MultiCardDemo = () => {
  const [windowW, setWindowW] = useState<number>(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWindowW(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const imageLayout = getResponsiveConfig(IMAGE_CONFIGS, windowW);
  const cardsParentLayout = getResponsiveConfig(CARDSWRAPPER_CONFIGS, windowW);

  // Canvas config
  const canvasPx = useMemo(
    () => ({ width: CANVAS_WIDTH_PX, height: CANVAS_HEIGHT_PX } as const),
    []
  );

  // Player rectangles and centers in pixel space via utils
  const {
    rects: playerRectsPx,
    centers: centersPx,
    card: cardPx,
  } = useMemo(() => computePlayerLayoutRects(canvasPx), [canvasPx]);

  // Convert pixel centers to world using the fixed canvas size
  const centersWorld = useMemo(() => {
    const w = canvasPx.width,
      h = canvasPx.height;
    return centersPx.map((c) => ({
      x:
        (c.x / w - 0.5) *
        (w / h) *
        (2 * Math.tan((45 * Math.PI) / 180 / 2) * 3),
      y: -((c.y / h - 0.5) * (2 * Math.tan((45 * Math.PI) / 180 / 2) * 3)),
    }));
  }, [centersPx, canvasPx.width, canvasPx.height]);

  // Generate cards stacked at top-right with slight x staggers; no initial transitions
  const initialCards: CardInitConfig[] = useMemo(() => {
    const cards: CardInitConfig[] = [];
    for (let i = 0; i < INITIAL_CARD_COUNT; i++) {
      const id = `C${i + 1}`;
      const suit: CardInitConfig["suit"] = [
        "hearts",
        "diamonds",
        "clubs",
        "spades",
      ][i % 4] as any;
      const value = (i % 13) + 1;
      // initial px positions (top-right)
      const xPx =
        canvasPx.width -
        INITIAL_STACK_OFFSET_RIGHT_PX -
        i * INITIAL_STACK_DELTA_X_PX;
      const yPx = INITIAL_STACK_OFFSET_TOP_PX;
      // world center mapping
      const worldFactor = 2 * Math.tan((45 * Math.PI) / 180 / 2) * 3;
      const wx =
        (xPx / canvasPx.width - 0.5) *
        (canvasPx.width / canvasPx.height) *
        worldFactor;
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

  const [visibleCards, setVisibleCards] =
    useState<CardInitConfig[]>(initialCards);

  useEffect(() => {
    setVisibleCards(initialCards);
  }, [initialCards]);

  // Wrappers: their scale/size updates on resize (not canvas size!)
  const scaledImageW = CANVAS_WIDTH_PX * imageLayout.scale;
  const scaledImageH = CANVAS_HEIGHT_PX * imageLayout.scale;

  const scaledCardsW = CANVAS_WIDTH_PX * cardsParentLayout.scale;
  const scaledCardsH = CANVAS_HEIGHT_PX * cardsParentLayout.scale;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#1a1a1a",
        overflow: "hidden",
      }}
    >
      {/* Absolutely positioned casino table image for background */}
      <img
        src="/images/bg.png"
        alt="Casino Table"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${scaledImageW}px`,
          height: `${scaledImageH}px`,
          transform: `translate(-50%, -50%)`,
          objectFit: "cover",
          zIndex: 0,
          transition: "all 0.3s cubic-bezier(.56,.04,.69,.83)",
          pointerEvents: "none",
        }}
      />
      {/* Cards & player bets wrapper */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${CANVAS_WIDTH_PX * 2}px`,
          height: `${CANVAS_HEIGHT_PX * 2}px`,
          transform: `scale(${cardsParentLayout.scale}) translate(-50%, -50%)`,
          transformOrigin: "top left",
          zIndex: 1,
          transition: "all 0.3s cubic-bezier(.56,.04,.69,.83)",
        }}
      >
        <CardsWrapper
          cards={visibleCards}
          playerSlotsWorld={centersWorld}
          stackOverlapRatio={STACK_OVERLAP_RATIO}
          debugPlayerBounds={playerRectsPx}
          style={{
            width: `${CANVAS_WIDTH_PX}px`,
            height: `${CANVAS_HEIGHT_PX}px`,
          }}
        />
      </div>
    </div>
  );
};
