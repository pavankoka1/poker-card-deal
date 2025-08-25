import { useMemo } from 'react';

export interface LayoutConfig {
  minWidth: number;
  scale: number;
  left: number;
  top: number;
}

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
    configs[0]
  );
}

export const useResponsiveScaling = (windowWidth: number) => {
  const cardsParentLayout = useMemo(
    () => getResponsiveConfig(CARDSWRAPPER_CONFIGS, windowWidth),
    [windowWidth]
  );

  const scaledCardsW = 1440; // CANVAS_WIDTH_PX * 2
  const scaledCardsH = 600;  // CANVAS_HEIGHT_PX * 2

  return {
    cardsParentLayout,
    scaledCardsW,
    scaledCardsH,
  };
};
