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
        value: 1, // Ace of Hearts
        cardHeightPixels: 80,
        dealDuration: 1500,
        dealFrom: vec3.fromValues(10.0, 6, 0),
        dealTo: vec3.fromValues(0.0, 6, 0),
        flipDuration: 1500,
        settleDuration: 700,
        flipElevation: -2,
        flipYPeak: -2,
        settleTo: vec3.fromValues(0, 1, 0),
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

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            cardRenderer.resize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial size

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            cardRenderer.stop();
        };
    }, []);

    // Update card configuration when it changes
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
            backgroundColor: "#1a1a1a", // Darker background
            backgroundImage: "url('/images/bg.png')",
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
        }}>

            {/* Fullscreen Canvas */}
            <canvas
                ref={ref}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    display: "block",
                    backgroundColor: "transparent",
                }}
            />

            {/* Top-Right: Toggle Config Button */}
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

            {/* Top-Left: Go To Workbench */}
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

            {/* Bottom-Left: Replay Button */}
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

            {/* Config Panel (conditionally rendered) */}
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

                    {/* Card Height Control */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Card Height</h3>
                        <input
                            type="range" min="50" max="400" step="10"
                            value={cardConfig.cardHeightPixels}
                            onChange={(e) => handleCardChange({ cardHeightPixels: parseInt(e.target.value) })}
                            style={{ width: "100%" }}
                        />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.cardHeightPixels} px</span>
                    </div>

                    {/* Deal Animation */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Deal Animation</h3>
                        <Vec3Control label="From" value={cardConfig.dealFrom!} onChange={dealFrom => handleCardChange({ dealFrom })} />
                        <Vec3Control label="To" value={cardConfig.dealTo!} onChange={dealTo => handleCardChange({ dealTo })} />
                        <input
                            type="range" min="200" max="2000" step="50"
                            value={cardConfig.dealDuration}
                            onChange={(e) => handleCardChange({ dealDuration: parseInt(e.target.value) })}
                            style={{ width: "100%", marginTop: '10px' }}
                        />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.dealDuration} ms</span>
                    </div>

                    {/* Flip Speed Control */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Flip Animation</h3>
                        <input
                            type="range" min="200" max="2000" step="50"
                            value={cardConfig.flipDuration}
                            onChange={(e) => handleCardChange({ flipDuration: parseInt(e.target.value) })}
                            style={{ width: "100%" }}
                        />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.flipDuration} ms</span>
                    </div>

                    {/* Settle Speed Control */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Settle Animation</h3>
                        <Vec3Control label="To" value={cardConfig.settleTo!} onChange={settleTo => handleCardChange({ settleTo })} />
                        <input
                            type="range" min="200" max="2000" step="50"
                            value={cardConfig.settleDuration}
                            onChange={(e) => handleCardChange({ settleDuration: parseInt(e.target.value) })}
                            style={{ width: "100%", marginTop: '10px' }}
                        />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.settleDuration} ms</span>
                    </div>

                    {/* Flip Elevation Control */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Flip Lift (Z-Axis)</h3>
                        <input
                            type="range" min="0.1" max="3.0" step="0.1"
                            value={cardConfig.flipElevation}
                            onChange={(e) => handleCardChange({ flipElevation: parseFloat(e.target.value) })}
                            style={{ width: "100%" }}
                        />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.flipElevation?.toFixed(1)}</span>
                    </div>

                    {/* Flip Arc Control */}
                    <div style={{ backgroundColor: "#333", padding: "15px", borderRadius: "8px", color: "#fff", }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Flip Arc (Y-Axis)</h3>
                        <input
                            type="range" min="0.0" max="3.0" step="0.1"
                            value={cardConfig.flipYPeak}
                            onChange={(e) => handleCardChange({ flipYPeak: parseFloat(e.target.value) })}
                            style={{ width: "100%" }}
                        />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>{cardConfig.flipYPeak?.toFixed(1)}</span>
                    </div>

                    {/* Suit Selection */}
                    <div style={{
                        backgroundColor: "#333",
                        padding: "15px",
                        borderRadius: "8px",
                        color: "#fff",
                    }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Suit</h3>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {suits.map((suit) => (
                                <button
                                    key={suit}
                                    onClick={() => handleCardChange({ suit })}
                                    style={{
                                        padding: "8px 12px",
                                        fontSize: "12px",
                                        fontWeight: "bold",
                                        backgroundColor: cardConfig.suit === suit ? "#FFB018" : "#555",
                                        color: cardConfig.suit === suit ? "#000" : "#fff",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                    }}
                                >
                                    {suit === 'hearts' && '♥'}
                                    {suit === 'diamonds' && '♦'}
                                    {suit === 'clubs' && '♣'}
                                    {suit === 'spades' && '♠'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Value Selection */}
                    <div style={{
                        backgroundColor: "#333",
                        padding: "15px",
                        borderRadius: "8px",
                        color: "#fff",
                    }}>
                        <h3 style={{ margin: "0 0 10px 0", color: "#FFB018" }}>Value</h3>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "300px" }}>
                            {values.map((value) => (
                                <button
                                    key={value}
                                    onClick={() => handleCardChange({ value })}
                                    style={{
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        fontWeight: "bold",
                                        backgroundColor: cardConfig.value === value ? "#FFB018" : "#555",
                                        color: cardConfig.value === value ? "#000" : "#fff",
                                        border: "none",
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                        minWidth: "30px",
                                    }}
                                >
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