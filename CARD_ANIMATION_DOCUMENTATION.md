# Card Animation System Documentation

## Overview

The card animation system is a sophisticated WebGL-based rendering engine that creates realistic 3D card animations with bending effects, smooth transitions, and high-performance rendering. The system uses custom shaders, efficient geometry tessellation, and a state machine for managing card animations.

## Architecture

### Core Components

1. **MultiCardDemo** - Main React component that orchestrates the entire system
2. **CardsWrapper** - React wrapper that manages the WebGL canvas and renderer lifecycle
3. **MultiCardRenderer** - WebGL renderer class that handles all 3D rendering and animation
4. **Shaders** - Custom GLSL shaders for vertex transformation and fragment rendering
5. **Constants & Utils** - Configuration and helper functions

### Data Flow

```
React State → CardsWrapper → MultiCardRenderer → WebGL Shaders → GPU Rendering
     ↑                                                              ↓
     └─────────────── Animation Loop ←─── State Updates ←──────────┘
```

## Scaling Logic & Responsive Design

### Current Implementation

The system uses a multi-layered scaling approach:

1. **Canvas Dimensions**: Fixed constants (`CANVAS_WIDTH_PX = 720`, `CANVAS_HEIGHT_PX = 300`)
2. **Responsive Breakpoints**: Different scale factors based on viewport width
3. **Dynamic Sizing**: Canvas dimensions adapt to viewport size with constraints

### Scaling Configuration

```typescript
const IMAGE_CONFIGS: LayoutConfig[] = [
  { minWidth: 0, scale: 1.6, left: 20, top: 30 },
  { minWidth: 800, scale: 2, left: 60, top: 80 },
  { minWidth: 1200, scale: 2.4, left: 100, top: 120 },
];

const CARDSWRAPPER_CONFIGS: LayoutConfig[] = [
  { minWidth: 0, scale: 0.8, left: 20, top: 30 },
  { minWidth: 800, scale: 1, left: 60, top: 80 },
  { minWidth: 1200, scale: 1.2, left: 100, top: 120 },
];
```

### Responsive Canvas Sizing

```typescript
const canvasPx = useMemo(
  () =>
    ({
      width: Math.min(CANVAS_WIDTH_PX, windowW * 0.8),
      height: Math.min(CANVAS_HEIGHT_PX, windowH * 0.6),
    } as const),
  [windowW, windowH]
);
```

## Window Resize Observer

### Implementation

The system uses `ResizeObserver` for efficient resize detection:

```typescript
if (window.ResizeObserver) {
  resizeObserverRef.current = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === document.documentElement) {
        handleResize();
      }
    }
  });
  resizeObserverRef.current.observe(document.documentElement);
} else {
  // Fallback to window resize event
  window.addEventListener("resize", handleResize);
}
```

### Benefits

- **Performance**: Only triggers when actual size changes occur
- **Accuracy**: Detects size changes from CSS, content, or viewport changes
- **Efficiency**: No continuous polling or event firing

## CardsWrapper Parent CSS Handling

### Container Structure

```typescript
<div
  ref={cardsWrapperRef}
  style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${scaledCardsW}px`,
    height: `${scaledCardsH}px`,
    transform: `translate(-50%, -50%) translate(${cardsWrapperPosition.x}px, ${cardsWrapperPosition.y}px)`,
    zIndex: 1,
    transition: "transform 0.3s cubic-bezier(.56,.04,.69,.83)",
    overflow: "visible",
  }}
>
  <CardsWrapper
    style={{
      width: `${canvasPx.width}px`,
      height: `${canvasPx.height}px`,
    }}
  />
</div>
```

### Navigation System

When the CardsWrapper extends beyond the viewport, navigation buttons appear:

```typescript
const needsNavigation = scaledCardsW > windowW * 0.9;

// Navigation functions
const navigateLeft = useCallback(() => {
  setCardsWrapperPosition((prev) => ({
    ...prev,
    x: Math.min(prev.x + 200, 0),
  }));
}, []);

const navigateRight = useCallback(() => {
  setCardsWrapperPosition((prev) => ({
    ...prev,
    x: Math.max(prev.x - 200, -400),
  }));
}, []);
```

## Shader System

### Vertex Shader

The vertex shader handles 3D transformation and bending:

```glsl
attribute vec2 a_position; // -1..1 quad
uniform mat4 u_mvp_matrix;
uniform float u_halfWidth;  // world units
uniform float u_halfHeight; // world units
uniform float u_bendRadius; // world units, large -> flatter
uniform float u_coneSlope;  // world units per world Y; 0 => cylinder
uniform float u_bendSign;   // +1 or -1 to control bend direction
varying vec2 v_uv;

void main() {
  float x = a_position.x * u_halfWidth;
  float y = a_position.y * u_halfHeight;
  float z = 0.0;

  if (u_bendRadius > 0.0) {
    float localR = max(0.001, u_bendRadius + u_coneSlope * y);
    float angle = x / localR; // radians
    float bentX = sin(angle) * localR;
    float bentZ = u_bendSign * (localR - cos(angle) * localR);
    x = bentX;
    z = bentZ;
  }

  v_uv = a_position * 0.5 + 0.5;
  gl_Position = u_mvp_matrix * vec4(x, y, z, 1.0);
}
```

### Fragment Shader

The fragment shader handles texture sampling and card shape:

```glsl
precision mediump float;
uniform sampler2D u_backTexture;
uniform sampler2D u_frontTexture;
uniform bool u_isFrontFace;
varying vec2 v_uv;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

void main() {
  // Discard pixels outside card bounds (rounded rectangle)
  if (sdBox(v_uv - 0.5, vec2(0.48, 0.48)) - 0.02 > 0.0) discard;

  if (u_isFrontFace) {
    gl_FragColor = texture2D(u_frontTexture, v_uv);
  } else {
    gl_FragColor = texture2D(u_backTexture, v_uv);
  }
}
```

## How Bending is Achieved

### Mathematical Foundation

The bending effect uses circular arc mathematics:

1. **Bend Radius Calculation**:

   ```typescript
   const fullWidth = 2.0 * halfWidth;
   const angleRad = (Math.abs(bendAngleThisFrame) * Math.PI) / 180.0;
   effectiveRadius = Math.max(0.001, fullWidth / angleRad);
   ```

2. **Vertex Transformation**:
   ```glsl
   float localR = max(0.001, u_bendRadius + u_coneSlope * y);
   float angle = x / localR; // radians
   float bentX = sin(angle) * localR;
   float bentZ = u_bendSign * (localR - cos(angle) * localR);
   ```

### Bending Process

1. **Input**: Bend angle in degrees (positive = right bend, negative = left bend)
2. **Calculation**: Convert angle to radius using arc length formula
3. **Transformation**: Apply circular arc transformation to each vertex
4. **Result**: 3D curved card surface

## How Cards are Formed

### Geometry Generation

Cards use tessellated quads for smooth bending:

```typescript
const segX = 64; // 64 segments horizontally
const segY = 8; // 8 segments vertically

for (let y = 0; y < segY; y++) {
  const v0 = -1 + (2 * y) / segY;
  const v1 = -1 + (2 * (y + 1)) / segY;
  for (let x = 0; x < segX; x++) {
    const u0 = -1 + (2 * x) / segX;
    const u1 = -1 + (2 * (x + 1)) / segX;
    // Create two triangles for each grid cell
    verts.push(u0, v0, u1, v0, u1, v1);
    verts.push(u0, v0, u1, v1, u0, v1);
  }
}
```

### Rendering Process

1. **Back Face**: Cull front faces, render with back texture
2. **Front Face**: Cull back faces, render with front texture
3. **Depth Testing**: Ensures proper layering
4. **Blending**: Handles transparency and anti-aliasing

## Texture Handling & Glittering Effect Solution

### Texture Loading

```typescript
private loadImageTexture(url: string): WebGLTexture {
  const texture = this.gl.createTexture()!;
  this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

  // Power-of-2 handling for mipmaps
  const isPOT = MultiCardRenderer.isPowerOf2(image.width) &&
                 MultiCardRenderer.isPowerOf2(image.height);

  if (isPOT) {
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER,
                          this.gl.LINEAR_MIPMAP_LINEAR);
  } else {
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S,
                          this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T,
                          this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER,
                          this.gl.LINEAR);
  }

  // Anisotropic filtering for better quality
  const ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
  if (ext) {
    const max = this.gl.getParameter((ext as any).MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
    this.gl.texParameterf(this.gl.TEXTURE_2D,
                          (ext as any).TEXTURE_MAX_ANISOTROPY_EXT,
                          Math.min(8, max));
  }
}
```

### Glittering Effect Solutions

1. **Mipmap Generation**: Automatic mipmap generation for power-of-2 textures
2. **Anisotropic Filtering**: Reduces texture shimmering at angles
3. **Proper UV Mapping**: Ensures textures don't stretch or distort
4. **High-Quality Filters**: Uses LINEAR filters for smooth rendering

### UV Coordinate Handling

```typescript
// Back texture cover-fit UV mapping to square
const A = this.backTextureAspect;
let backScaleX = 1.0,
  backScaleY = 1.0,
  backOffsetX = 0.0,
  backOffsetY = 0.0;

if (A >= 1.0) {
  backScaleX = 1.0 / A;
  backOffsetX = (1.0 - backScaleX) * 0.5;
} else {
  backScaleY = A;
  backOffsetY = (1.0 - backScaleY) * 0.5;
}

this.gl.uniform2f(this.backUVScaleUniformLocation, backScaleX, backScaleY);
this.gl.uniform2f(this.backUVOffsetUniformLocation, backOffsetX, backOffsetY);
```

## Animation System

### Transition State Machine

```typescript
interface TransitionSpec {
  duration: number; // ms
  x?: number;
  y?: number;
  z?: number;
  rotateX?: number; // degrees
  rotateY?: number; // degrees
  rotateZ?: number; // degrees
  bendAngleDeg?: number; // degrees, + right bend, - left bend
  easing?: PropertyEasing; // per-property easing
  dealToPlayer?: number; // 1..7; if set, overrides x/y/z
}
```

### Animation Loop

```typescript
private animate = (now: number = 0) => {
  // Update transition states
  this.cards.forEach((card) => {
    if (card.active) {
      const t = Math.min(Math.max((now - card.active.startAtMs) /
                                  card.active.spec.duration, 0), 1);

      // Apply easing and update properties
      card.x = startX + (endX - startX) * eX(t);
      card.y = startY + (endY - startY) * eY(t);
      // ... other properties

      if (t >= 1) {
        // Finish transition and move to next
        card.active = undefined;
        if (card.queue.length > 0) {
          this.startNextTransition(card, now);
        }
      }
    }
  });

  // Render all cards
  this.renderCards();

  // Continue animation loop
  this.animationId = requestAnimationFrame(this.animate);
};
```

## Performance Optimizations

### Rendering Optimizations

1. **Efficient Geometry**: Tessellated quads with optimal vertex count
2. **State Batching**: Minimize WebGL state changes
3. **Texture Atlasing**: Single texture for multiple card faces
4. **Frustum Culling**: Only render visible cards

### Memory Management

1. **Texture Reuse**: Shared textures across multiple cards
2. **Buffer Pooling**: Reuse WebGL buffers
3. **Garbage Collection**: Minimal object allocation in render loop

## Troubleshooting Common Issues

### Cards Breaking on Parent Resize

**Problem**: CardsWrapper breaks when parent dimensions change
**Solution**:

- Use ResizeObserver for efficient resize detection
- Implement proper overflow handling
- Add navigation controls for large content

### Scaling Issues

**Problem**: Inconsistent scaling across different viewport sizes
**Solution**:

- Implement responsive breakpoints
- Use viewport-relative sizing
- Add minimum/maximum constraints

### Performance Issues

**Problem**: Low frame rates during animations
**Solution**:

- Optimize shader complexity
- Reduce geometry tessellation
- Implement level-of-detail system

## Future Improvements

1. **Level of Detail**: Dynamic tessellation based on distance
2. **Instanced Rendering**: Batch render multiple cards
3. **Compute Shaders**: GPU-based animation calculations
4. **Particle Effects**: Enhanced visual feedback
5. **Physics Integration**: Realistic card physics

## Conclusion

The card animation system provides a robust foundation for creating engaging card-based games and applications. By understanding the architecture, scaling logic, and shader implementation, developers can extend and customize the system for their specific needs.

The combination of WebGL rendering, efficient state management, and responsive design creates a performant and visually appealing user experience that works across different devices and screen sizes.
