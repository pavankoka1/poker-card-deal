import { useCallback, useState } from 'react';

interface Position {
    x: number;
    y: number;
}

export const useNavigation = () => {
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

    const navigateLeft = useCallback(() => {
        console.log('Navigate Left clicked, current position:', position);
        setPosition((prev) => {
            const newX = Math.max(prev.x - 100, -600);
            console.log('Moving left from', prev.x, 'to', newX);
            return { ...prev, x: newX };
        });
    }, [position]);

    const navigateRight = useCallback(() => {
        console.log('Navigate Right clicked, current position:', position);
        setPosition((prev) => {
            const newX = Math.min(prev.x + 100, 600);
            console.log('Moving right from', prev.x, 'to', newX);
            return { ...prev, x: newX };
        });
    }, [position]);

    const resetPosition = useCallback(() => {
        console.log('Reset position clicked');
        setPosition({ x: 0, y: 0 });
    }, []);

    // Debug: Log position changes
    console.log('Navigation hook - Current position:', position);

    return {
        position,
        navigateLeft,
        navigateRight,
        resetPosition,
    };
};
