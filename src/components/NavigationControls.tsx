import React from 'react';

interface NavigationControlsProps {
    onNavigateLeft: () => void;
    onNavigateRight: () => void;
    needsNavigation: boolean;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
    onNavigateLeft,
    onNavigateRight,
    needsNavigation,
}) => {
    // if (!needsNavigation) return null;

    return (
        <>
            {/* Left Navigation Button */}
            <button
                onClick={onNavigateLeft}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '20px',
                    transform: 'translateY(-50%)',
                    zIndex: 100,
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(10px)',
                    minWidth: '80px',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
            >
                ← Left
            </button>

            {/* Right Navigation Button */}
            <button
                onClick={onNavigateRight}
                style={{
                    position: 'absolute',
                    top: '50%',
                    right: '20px',
                    transform: 'translateY(-50%)',
                    zIndex: 100,
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(10px)',
                    minWidth: '80px',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
            >
                Right →
            </button>
        </>
    );
};
