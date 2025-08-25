export const useResponsiveScaling = (windowWidth: number) => {
    // Keep original dimensions constant for animations
    const originalWidth = 1440;
    const originalHeight = 600;

    // Calculate scale to fit window width without overflow
    const maxWidth = windowWidth;
    const scale = maxWidth / originalWidth;

    // Calculate translation to center the scaled content
    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;
    const translateX = (windowWidth - scaledWidth) / 2;
    const translateY = (window.innerHeight - scaledHeight) / 2;

    return {
        scale,
        translateX,
        translateY,
        originalWidth,
        originalHeight,
    };
};
