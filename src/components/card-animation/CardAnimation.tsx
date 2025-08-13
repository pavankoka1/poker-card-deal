import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { CardRenderer, CardConfig } from "./CardRenderer";
import { vec3 } from "gl-matrix";
import { useNavigate } from "react-router-dom";

const Vec3Control: FC<{ label: string, value: vec3, onChange: (newValue: vec3) => void }> = ({ label, value, onChange }) => {
    const handleChange = (axis: 'x' | 'y' | 'z', val: string) => {
        const numValue = parseFloat(val);
        if (!isNaN(numValue)) {
            const newValue = vec3.clone(value);
            const axisIndex = { x: 0, y: 1, z: 2 }[axis];
            newValue[axisIndex] = numValue;
            onChange(newValue);
        }
    };

    return (
        <div style={{ backgroundColor: "#444", padding: "10px", borderRadius: "6px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#FFD700" }}>{label}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 40px', gap: '5px', alignItems: 'center' }}>
                {(['x', 'y', 'z'] as const).map((axis) => (
                    <>
                        <label style={{ color: "#ccc" }}>{axis.toUpperCase()}:</label>
                        <input
                            type="range"
                            min="-5"
                            max="5"
                            step="0.1"
                            value={value[{ x: 0, y: 1, z: 2 }[axis]]}
                            onChange={(e) => handleChange(axis, e.target.value)}
                        />
                        <span style={{ color: "#fff", fontSize: "12px" }}>{value[{ x: 0, y: 1, z: 2 }[axis]].toFixed(1)}</span>
                    </>
                ))}
            </div>
        </div>
    );
}


export const CardAnimation: FC = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<CardRenderer | null>(null);
    const [isConfigVisible, setIsConfigVisible] = useState(false);
    const navigate = useNavigate();
    const [cardConfig, setCardConfig] = useState<CardConfig>({
        suit: 'hearts',
        value: 1,
        cardHeightPixels: 80,
        rotationDegrees: [147, 35, -39],

        // Camera is fixed by renderer for simplicity

        // Swipe using normalized positions
        swipeDuration: 1000,
        swipeBendAngleDeg: -60,
        swipeLiftZ: 0,
        swipeStartNormX: 0.9,   // top-right
        swipeStartNormY: 0.09,
        swipeEndNormX: 0.85,     // center X
        swipeEndNormY: 0.2,

        // Deal (end in normalized, start = end of swipe)
        dealDuration: 1200,
        dealEndNormX: 0.5,
        dealEndNormY: 0.2,
        dealEndRotationDegrees: [135, 0, 0],

        // Flip/Settle (settle to bottom center)
        flipDuration: 1000,
        settleDuration: 700,
        flipElevation: 0.1,
        flipYPeak: 0.12,
        settleEndNormX: 0.5,
        settleEndNormY: 0.76,
    });

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl");
        if (!gl) return;

        const cardRenderer = new CardRenderer(gl, {
            width: window.innerWidth,
            height: window.innerHeight,
        });
        rendererRef.current = cardRenderer;
        cardRenderer.start();

        const resizeCanvasToDisplaySize = () => {
            const displayWidth = Math.floor(canvas.clientWidth);
            const displayHeight = Math.floor(canvas.clientHeight);
            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                canvas.width = displayWidth;
                canvas.height = displayHeight;
            }
            cardRenderer.resize({ width: canvas.width, height: canvas.height });
        };

        const handleResize = () => {
            resizeCanvasToDisplaySize();
        };

        window.addEventListener('resize', handleResize);
        resizeCanvasToDisplaySize();

        return () => {
            window.removeEventListener('resize', handleResize);
            cardRenderer.stop();
        };
    }, []);

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.updateCardConfig(cardConfig);
        }
    }, [cardConfig]);

    const handleCardChange = (newConfig: Partial<CardConfig>) => {
        setCardConfig(prev => ({ ...prev, ...newConfig }));
    };

    const handleReplay = () => {
        if (rendererRef.current) {
            rendererRef.current.replayAnimation();
        }
    }

    const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            backgroundColor: "#1a1a1a",
            backgroundImage: "url('/images/bg.png')",
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
        }}>

            <canvas
                ref={ref}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: "55vw",
                    height: "50vh",
                    display: "block",
                    backgroundColor: "transparent",
                    border: "1px solid red",
                }}
            />

            <button
                onClick={() => setIsConfigVisible(!isConfigVisible)}
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    padding: "10px 15px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    backgroundColor: "#FFB018",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    zIndex: 1001,
                }}
            >
                {isConfigVisible ? "Hide Config" : "Show Config"}
            </button>

            <button
                onClick={() => navigate('/card')}
                style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    padding: "10px 15px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    backgroundColor: "#3ddc97",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    zIndex: 1001,
                }}
            >
                Card Workbench
            </button>

            <button
                onClick={handleReplay}
                style={{
                    position: "absolute",
                    bottom: "20px",
                    left: "20px",
                    padding: "10px 15px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    backgroundColor: "#FFB018",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    zIndex: 1001,
                }}
            >
                Replay Animation
            </button>

            {isConfigVisible && (
                <div style={{
                    position: "absolute",
                    top: "70px",
                    right: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    zIndex: 1000,
                    pointerEvents: "auto",
                    backgroundColor: "#2a2a2a",
                    padding: "20px",
                    borderRadius: "10px",
                    maxHeight: "calc(100vh - 100px)",
                    overflowY: "auto",
                }}>

                    {/* Card Height */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Card Height</h3>
                        <input type="range" min="50" max="400" step="10" value={cardConfig.cardHeightPixels}
                            onChange={(e) => handleCardChange({ cardHeightPixels: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.cardHeightPixels} px</span>
                    </div>

                    {/* Orientation (simple tilt) */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff" }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Orientation</h3>
                        <label style={{ color: "#ccc", fontSize: 12 }}>Tilt X (pitch)</label>
                        <input type="range" min="-180" max="180" step="1" value={cardConfig.rotationDegrees?.[0] ?? 0}
                            onChange={(e) => {
                                const x = parseInt(e.target.value);
                                const [, y, z] = cardConfig.rotationDegrees ?? [0, 0, 0];
                                handleCardChange({ rotationDegrees: [x, y, z] });
                            }} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>{cardConfig.rotationDegrees?.[0] ?? 0}°</span>
                        <label style={{ color: "#ccc", fontSize: 12 }}>Tilt Y (yaw)</label>
                        <input type="range" min="-180" max="180" step="1" value={cardConfig.rotationDegrees?.[1] ?? 0}
                            onChange={(e) => {
                                const y = parseInt(e.target.value);
                                const [x, , z] = cardConfig.rotationDegrees ?? [0, 0, 0];
                                handleCardChange({ rotationDegrees: [x, y, z] });
                            }} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>{cardConfig.rotationDegrees?.[1] ?? 0}°</span>
                    </div>

                    {/* Swipe (Normalized) */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff" }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Swipe (normalized)</h3>
                        <label style={{ color: "#ccc", fontSize: 12 }}>Duration</label>
                        <input type="range" min="200" max="2000" step="50" value={cardConfig.swipeDuration}
                            onChange={(e) => handleCardChange({ swipeDuration: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: 12, color: "#ccc" }}>{cardConfig.swipeDuration} ms</span>

                        <div style={{ height: 8 }} />
                        <label style={{ color: "#ccc", fontSize: 12 }}>Bend Angle (deg)</label>
                        <input type="range" min="-90" max="90" step="1" value={cardConfig.swipeBendAngleDeg}
                            onChange={(e) => handleCardChange({ swipeBendAngleDeg: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: 12, color: "#ccc" }}>{cardConfig.swipeBendAngleDeg}°</span>

                        <div style={{ height: 12 }} />
                        <h4 style={{ margin: 0, color: '#FFD700' }}>Start (X,Y)</h4>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.swipeStartNormX}
                            onChange={(e) => handleCardChange({ swipeStartNormX: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>X: {cardConfig.swipeStartNormX?.toFixed(2)}</span>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.swipeStartNormY}
                            onChange={(e) => handleCardChange({ swipeStartNormY: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>Y: {cardConfig.swipeStartNormY?.toFixed(2)}</span>

                        <div style={{ height: 12 }} />
                        <h4 style={{ margin: 0, color: '#FFD700' }}>End (X,Y)</h4>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.swipeEndNormX}
                            onChange={(e) => handleCardChange({ swipeEndNormX: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>X: {cardConfig.swipeEndNormX?.toFixed(2)}</span>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.swipeEndNormY}
                            onChange={(e) => handleCardChange({ swipeEndNormY: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>Y: {cardConfig.swipeEndNormY?.toFixed(2)}</span>
                    </div>

                    {/* Deal (Normalized) */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff" }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Deal (normalized)</h3>
                        <label style={{ color: "#ccc", fontSize: 12 }}>End X</label>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.dealEndNormX ?? 0.5}
                            onChange={(e) => handleCardChange({ dealEndNormX: parseFloat(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: 12, color: "#ccc" }}>{cardConfig.dealEndNormX?.toFixed(2)}</span>
                        <label style={{ color: "#ccc", fontSize: 12 }}>End Y</label>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.dealEndNormY ?? cardConfig.swipeEndNormY ?? 0.5}
                            onChange={(e) => handleCardChange({ dealEndNormY: parseFloat(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: 12, color: "#ccc" }}>{(cardConfig.dealEndNormY ?? cardConfig.swipeEndNormY ?? 0.5).toFixed(2)}</span>
                        <div style={{ height: 8 }} />
                        <label style={{ color: "#ccc", fontSize: 12 }}>Duration</label>
                        <input type="range" min="200" max="2000" step="50" value={cardConfig.dealDuration}
                            onChange={(e) => handleCardChange({ dealDuration: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: 12, color: "#ccc" }}>{cardConfig.dealDuration} ms</span>
                    </div>

                    {/* Flip / Settle */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Flip / Settle</h3>
                        <label style={{ color: "#ccc", fontSize: 12 }}>Flip Duration</label>
                        <input type="range" min="200" max="2000" step="50" value={cardConfig.flipDuration}
                            onChange={(e) => handleCardChange({ flipDuration: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.flipDuration} ms</span>
                        <div style={{ height: 8 }} />
                        <label style={{ color: "#ccc", fontSize: 12 }}>Flip Y Peak</label>
                        <input type="range" min="0" max="0.5" step="0.01" value={cardConfig.flipYPeak}
                            onChange={(e) => handleCardChange({ flipYPeak: parseFloat(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.flipYPeak?.toFixed(2)}</span>
                        <div style={{ height: 8 }} />
                        <label style={{ color: "#ccc", fontSize: 12 }}>Settle Duration</label>
                        <input type="range" min="200" max="2000" step="50" value={cardConfig.settleDuration}
                            onChange={(e) => handleCardChange({ settleDuration: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.settleDuration} ms</span>
                        <div style={{ height: 8 }} />
                        <h4 style={{ margin: 0, color: '#FFD700' }}>Settle To (normalized)</h4>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.settleEndNormX ?? 0.5}
                            onChange={(e) => handleCardChange({ settleEndNormX: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>X: {cardConfig.settleEndNormX?.toFixed(2) ?? '0.50'}</span>
                        <input type="range" min="0" max="1" step="0.01" value={cardConfig.settleEndNormY ?? 1.0}
                            onChange={(e) => handleCardChange({ settleEndNormY: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: '#ccc' }}>Y: {cardConfig.settleEndNormY?.toFixed(2) ?? '1.00'}</span>
                    </div>

                    {/* Suit Selection */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Suit</h3>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {suits.map((suit) => (
                                <button key={suit} onClick={() => handleCardChange({ suit })}
                                    style={{
                                        padding: "8px 12px", fontSize: "12px", fontWeight: "bold",
                                        backgroundColor: cardConfig.suit === suit ? "#FFB018" : "#555",
                                        color: cardConfig.suit === suit ? "#000" : "#fff",
                                        border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.3s ease"
                                    }}>
                                    {suit === 'hearts' && '♥'}
                                    {suit === 'diamonds' && '♦'}
                                    {suit === 'clubs' && '♣'}
                                    {suit === 'spades' && '♠'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Value Selection */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Value</h3>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "300px" }}>
                            {values.map((value) => (
                                <button key={value} onClick={() => handleCardChange({ value })}
                                    style={{
                                        padding: "6px 10px", fontSize: "11px", fontWeight: "bold",
                                        backgroundColor: cardConfig.value === value ? "#FFB018" : "#555",
                                        color: cardConfig.value === value ? "#000" : "#fff",
                                        border: "none", borderRadius: "4px", cursor: "pointer", transition: "all 0.3s ease",
                                        minWidth: "30px",
                                    }}>
                                    {value === 1 && 'A'}
                                    {value === 11 && 'J'}
                                    {value === 12 && 'Q'}
                                    {value === 13 && 'K'}
                                    {value >= 2 && value <= 10 && value.toString()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}; 