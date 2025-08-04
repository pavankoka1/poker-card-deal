# WebGL Card Animation Documentation

This document provides a detailed explanation of the WebGL-based card animation system. It covers the core rendering logic, the animation lifecycle, how shaders are used to draw the card, and how to customize the animation.

## Core Component: `CardRenderer.ts`

The `CardRenderer` class is the heart of this animation system. It's responsible for:

-   Setting up the WebGL context, compiling shaders, and creating the WebGL program.
-   Managing the animation loop using `requestAnimationFrame`.
-   Handling the state of the card animation through different phases.
-   Calculating and applying transformations (translation, rotation, scaling) to the card.
-   Drawing the card, distinguishing between its front and back faces.
-   Providing an interface to configure the card's appearance and animation properties.

## The Animation Lifecycle

The animation is driven by the `animate` method, which is called repeatedly via `requestAnimationFrame`. This creates a smooth animation loop that syncs with the browser's refresh rate. The animation is broken down into distinct phases:

1.  **`deal`**: The card slides into view from off-screen.
2.  **`flip`**: The card performs a flip animation in place, revealing its front face. It also elevates slightly for a more dynamic effect.
3.  **`settle`**: After the flip, the card moves to its final resting position.
4.  **`idle`**: The animation is complete, and the card remains in its final state.

The `animationPhase` property in `CardRenderer` tracks the current phase. The `startTime` property is reset at the beginning of each phase to measure the elapsed time for that specific part of the animation.

### Smooth Transitions

To make the animation feel natural and not robotic, we use easing functions and interpolation:

-   **`easeOutQuint`**: This easing function starts the animation quickly and slows it down as it approaches the end. This is applied to the progress of each animation phase.
-   **`lerp` (Linear Interpolation)**: This function is used to calculate the intermediate positions of the card as it moves from a start point to an end point. When combined with the eased progress, it produces a smooth slide.

## Transformations and Coordinate Spaces

To position and orient the card in a 3D scene, we use a **Model-View-Projection (MVP)** matrix.

-   **Model Matrix**: Transforms the card from its local space (a simple 2D square) into the 3D world space. This includes scaling it to the correct aspect ratio, rotating it during the flip, and translating it to its current position in the animation.
-   **View Matrix**: Represents the camera. It positions the "viewer" in the scene. In our case, the camera is placed at a fixed distance from the card.
-   **Projection Matrix**: Creates the perspective effect, making objects that are further away appear smaller.

These three matrices are multiplied together to get the final `u_mvp_matrix`, which is passed to the vertex shader.

## Shaders: Bringing the Card to Life

Shaders are small programs that run on the GPU, allowing for powerful and efficient graphics rendering. We use two types of shaders:

### Vertex Shader (`VertexShaderSource`)

This shader's primary job is to determine the final position of each vertex (corner) of our card.

-   It takes a 2D position (`a_position`) for each vertex of our square.
-   It multiplies this position by the `u_mvp_matrix` to transform it into the 3D clip space, effectively placing the card correctly in the scene.
-   It also calculates `v_uv` coordinates, which are used to map textures onto the card's surface.

### Fragment Shader (`FragmentShaderSource`)

This shader runs for every pixel of the card and decides its final color. This is where the visual magic happens. A key uniform, `u_isFrontFace` (a boolean), tells the shader whether it should render the front or the back of the card.

#### Rendering the Back Face

When `u_isFrontFace` is `false`, the shader's job is simple:
- It samples the `u_texture` (which holds the image for the card's back) at the corresponding `v_uv` coordinate and sets that color for the pixel.

#### Rendering the Front Face

When `u_isFrontFace` is `true`, the process is more involved. The front of the card is rendered procedurally using **Signed Distance Fields (SDFs)**.

-   **What are SDFs?**: Instead of drawing shapes with pixels, an SDF is a function that, for any given point, returns the shortest distance to the edge of a shape. If the point is inside the shape, the distance is negative. This technique allows us to render resolution-independent, perfectly crisp shapes.
-   **Drawing Numbers and Suits**: We have SDF functions like `draw_A`, `draw_K`, `drawHeart`, etc., that define the shapes of the card's value and suit. The `getValueSDF` and `getSuitSDF` functions select the correct SDF based on the `u_cardValue` uniform.
-   **Coloring**: The shader calculates the SDF value for the current pixel. If the distance is very small (close to the edge), it colors the pixel with the `engravingColor` (red or black, based on `u_isRedSuit`). Otherwise, it uses the white background color. `smoothstep` is used to create a slight anti-aliasing effect on the edges.
-   **Suit Icons**: In addition to SDFs for the corner engravings, the shader also uses a separate `u_suitTexture` to draw the detailed suit icon (e.g., the heart) in the designated areas. It checks if the pixel's UV coordinates fall within the area for the suit icon and, if so, blends the texture color.

By combining these techniques, the fragment shader can dynamically draw any card from a standard deck on the fly. 