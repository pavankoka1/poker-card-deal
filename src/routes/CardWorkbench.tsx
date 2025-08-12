import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Slider, Switch, FormControlLabel, IconButton, Divider, ToggleButton, ToggleButtonGroup } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { BendCardRenderer, BendCardConfig } from '../workbench/BendCardRenderer';

export function CardWorkbench() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<BendCardRenderer | null>(null);
  const navigate = useNavigate();

  const [floating, setFloating] = useState(false);
  const [rotation, setRotation] = useState({ x: 147, y: 35, z: -39 });
  const [bendRadius, setBendRadius] = useState(1000);
  const [bendAngle, setBendAngle] = useState(0);
  const [cardHeightPixels, setCardHeightPixels] = useState(90);
  const [posX, setPosX] = useState(1.13);
  const [posY, setPosY] = useState(-0.29);
  const [suit, setSuit] = useState<'hearts' | 'diamonds' | 'clubs' | 'spades'>('hearts');
  const [value, setValue] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const renderer = new BendCardRenderer(gl, { width: window.innerWidth, height: window.innerHeight });
    rendererRef.current = renderer;
    renderer.start();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderer.resize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.stop();
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current) return;
    const cfg: Partial<BendCardConfig> = {
      floating,
      rotationDegrees: [rotation.x, rotation.y, rotation.z],
      bendRadius,
      bendAngleDegrees: bendAngle,
      x: posX,
      y: posY,
      cardHeightPixels,
      suit,
      value,
    };
    rendererRef.current.updateConfig(cfg);
  }, [floating, rotation, bendRadius, bendAngle, posX, posY, cardHeightPixels, suit, value]);

  const handleRotationChange = (axis: 'x' | 'y' | 'z') => (_: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) return;
    setRotation(prev => ({ ...prev, [axis]: newValue as number }));
  };

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: '#05161a', backgroundImage: "url('/images/bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh' }} />

      <IconButton onClick={() => navigate('/')} sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, bgcolor: 'rgba(0,0,0,0.5)' }} color="primary">
        <ArrowBackIcon sx={{ color: 'white' }} />
      </IconButton>

      <Paper elevation={6} sx={{ position: 'absolute', top: 16, right: 16, width: 360, maxWidth: '92vw', p: 2, bgcolor: 'rgba(18,18,18,0.9)', color: 'white', borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Card Workbench</Typography>
        <FormControlLabel control={<Switch checked={floating} onChange={(_, v) => setFloating(v)} />} label={<Typography>Floating</Typography>} />

        {!floating && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'grey.300' }}>Rotation (deg)</Typography>
            <Typography variant="caption">X: {rotation.x}</Typography>
            <Slider size="small" min={-180} max={180} step={1} value={rotation.x} onChange={handleRotationChange('x')} sx={{ mt: -1 }} />
            <Typography variant="caption">Y: {rotation.y}</Typography>
            <Slider size="small" min={-180} max={180} step={1} value={rotation.y} onChange={handleRotationChange('y')} sx={{ mt: -1 }} />
            <Typography variant="caption">Z: {rotation.z}</Typography>
            <Slider size="small" min={-180} max={180} step={1} value={rotation.z} onChange={handleRotationChange('z')} sx={{ mt: -1 }} />
          </Box>
        )}

        <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />

        <Typography variant="subtitle2" sx={{ color: 'grey.300' }}>Bend Angle: {bendAngle}°</Typography>
        <Slider min={-180} max={180} step={1} value={bendAngle} onChange={(_, v) => setBendAngle(v as number)} />

        <Typography variant="subtitle2" sx={{ color: 'grey.300', mt: 1 }}>Bend Radius (px): {bendRadius.toFixed(0)} {bendAngle > 0 ? '(overridden by angle)' : ''}</Typography>
        {/* <Slider min={50} max={3000} step={10} value={bendRadius} onChange={(_, v) => setBendRadius(v as number)} /> */}

        <Typography variant="subtitle2" sx={{ color: 'grey.300', mt: 1 }}>Card X (world): {posX.toFixed(2)}</Typography>
        <Slider min={-2} max={2} step={0.01} value={posX} onChange={(_, v) => setPosX(v as number)} />

        <Typography variant="subtitle2" sx={{ color: 'grey.300' }}>Card Y (world): {posY.toFixed(2)}</Typography>
        <Slider min={-3} max={2} step={0.01} value={posY} onChange={(_, v) => setPosY(v as number)} />

        <Typography variant="subtitle2" sx={{ color: 'grey.300' }}>Card Height: {cardHeightPixels}px</Typography>
        <Slider min={80} max={480} step={10} value={cardHeightPixels} onChange={(_, v) => setCardHeightPixels(v as number)} />

        <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* <Typography variant="subtitle2" sx={{ color: 'grey.300', mb: 1 }}>Suit</Typography>
        <ToggleButtonGroup
          size="small"
          color="primary"
          exclusive
          value={suit}
          onChange={(_, v) => v && setSuit(v)}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          <ToggleButton value="hearts">♥</ToggleButton>
          <ToggleButton value="diamonds">♦</ToggleButton>
          <ToggleButton value="clubs">♣</ToggleButton>
          <ToggleButton value="spades">♠</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="subtitle2" sx={{ color: 'grey.300', mt: 2, mb: 1 }}>Value</Typography>
        <ToggleButtonGroup
          size="small"
          color="primary"
          exclusive
          value={value}
          onChange={(_, v) => v && setValue(v)}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(v => (
            <ToggleButton key={v} value={v}>{v === 1 ? 'A' : v === 11 ? 'J' : v === 12 ? 'Q' : v === 13 ? 'K' : v}</ToggleButton>
          ))}
        </ToggleButtonGroup> */}
      </Paper>
    </Box>
  );
}