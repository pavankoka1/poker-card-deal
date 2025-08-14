export const VertexShaderSource = `
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
`;

// Fragment shader: sample textures for both faces
export const FragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_backTexture;
    uniform sampler2D u_frontTexture;
    uniform bool u_isFrontFace;
    varying vec2 v_uv;

    float sdBox(vec2 p, vec2 b) { vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }

    void main() {
      if (sdBox(v_uv - 0.5, vec2(0.48, 0.48)) - 0.02 > 0.0) discard;

      if (u_isFrontFace) {
        gl_FragColor = texture2D(u_frontTexture, v_uv);
      } else {
        gl_FragColor = texture2D(u_backTexture, v_uv);
      }
    }
`;