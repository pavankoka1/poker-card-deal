import { CANVAS_HEIGHT_PX, CANVAS_WIDTH_PX } from "./constants";

export function pxToWorld(xPx: number, yPx: number, dimsPx: { width: number; height: number }) {
    const nx = xPx / dimsPx.width;
    const ny = yPx / dimsPx.height;
    // world mapping: (0,0) top-left to (-w/2, +h/2), (1,1) -> (+w/2, -h/2)
    const { worldWidth, worldHeight } = getWorldExtents(dimsPx.width, dimsPx.height);
    const wx = (nx - 0.5) * worldWidth;
    const wy = -(ny - 0.5) * worldHeight;
    return { wx, wy };
}

export function worldToPx(wx: number, wy: number, dimsPx: { width: number; height: number }) {
    const { worldWidth, worldHeight } = getWorldExtents(dimsPx.width, dimsPx.height);
    const nx = wx / worldWidth + 0.5;
    const ny = -wy / worldHeight + 0.5;
    return { x: nx * dimsPx.width, y: ny * dimsPx.height };
}

export function getWorldExtents(widthPx: number, heightPx: number) {
    const fov = 45 * Math.PI / 180;
    const cameraZ = 3;
    const worldHeight = 2 * Math.tan(fov / 2) * cameraZ;
    const worldWidth = worldHeight * (widthPx / heightPx);
    return { worldWidth, worldHeight };
}

