import { PLAYER_COUNT, PLAYER_GAP_X_PX, PLAYER_LIFT_Y_PER_STEP_PX, PLAYER_OFFSET_BOTTOM_PX, PLAYER_PADDING_LEFT_PX, PLAYER_PADDING_RIGHT_PX, CANVAS_SCALE } from "./constants";

export function computePlayerLayoutRects(canvas: { width: number; height: number }) {
    const usableWidth = canvas.width - PLAYER_PADDING_LEFT_PX - PLAYER_PADDING_RIGHT_PX;
    const totalGaps = 6 * PLAYER_GAP_X_PX;
    const widthEach = usableWidth / 7 - totalGaps / 7;
    const heightEach = widthEach * 1.5;
    const baseY = canvas.height - PLAYER_OFFSET_BOTTOM_PX - heightEach;
    const rects: Array<{ x: number, y: number, width: number, height: number }> = [];
    const centers: Array<{ x: number, y: number }> = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
        const x = PLAYER_PADDING_LEFT_PX + i * (widthEach + PLAYER_GAP_X_PX);
        const liftSteps = Math.abs(3 - i);
        const y = baseY - liftSteps * PLAYER_LIFT_Y_PER_STEP_PX;
        rects.push({ x, y, width: widthEach, height: heightEach });
        centers.push({ x: x + widthEach / 2, y: y + heightEach / 2 });
    }
    return { rects, centers, card: { width: widthEach, height: heightEach } };
}

