import React from 'react';

interface NavigationTestProps {
    position: { x: number; y: number };
    navigateLeft: () => void;
    navigateRight: () => void;
    resetPosition: () => void;
}

export const NavigationTest: React.FC<NavigationTestProps> = ({
    position,
    navigateLeft,
    navigateRight,
    resetPosition,
}) => {
    return (
        <div
            style={{
                position: 'fixed',
                top: '10px',
                left: '10px',
                zIndex: 1000,
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                fontSize: '12px',
            }}
        >
            <div>
                Position: x={position.x}, y={position.y}
            </div>
            <div style={{ marginTop: '5px' }}>
                <button onClick={navigateLeft} style={{ marginRight: '5px' }}>
                    Left
                </button>
                <button onClick={navigateRight} style={{ marginRight: '5px' }}>
                    Right
                </button>
                <button onClick={resetPosition}>Reset</button>
            </div>
        </div>
    );
};
