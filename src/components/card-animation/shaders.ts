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

// This is the final, complete fragment shader.
export const FragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_backTexture;
    uniform sampler2D u_suitTexture;
    uniform bool u_isFrontFace;
    uniform float u_cardValue;
    uniform float u_isRedSuit;
    uniform float u_suitIndex; // 0 hearts, 1 diamonds, 2 clubs, 3 spades
    varying vec2 v_uv;

    float sdBox(vec2 p, vec2 b) { vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
    float sdCircle(vec2 p, float r) { return length(p) - r; }
    float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa=p-a; vec2 ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }

    float drawHeart(vec2 p) { p.y+=0.1; p.x=abs(p.x); vec2 q=p-vec2(0.25,0.75); q=mat2(0.8,-0.6,0.6,0.8)*q; return min(sdCircle(p-vec2(0.0,0.25),0.25), sdBox(p-vec2(0.0,-0.1),vec2(0.5,0.35))) - 0.05; }
    float drawDiamond(vec2 p) { p=abs(p); return sdSegment(p,vec2(0.0,0.4),vec2(0.3,0.0)) - 0.05; }
    float drawClub(vec2 p) { float c1=sdCircle(p-vec2(0.0,0.15),0.25); float c2=sdCircle(p-vec2(-0.22,-0.1),0.25); float c3=sdCircle(p-vec2(0.22,-0.1),0.25); float s=sdBox(p-vec2(0.0,-0.2),vec2(0.05,0.3)); return min(min(min(c1,c2),c3),s); }
    float drawSpade(vec2 p) { float h=drawHeart(p*vec2(1.0,-1.0)+vec2(0.0,-0.4)); float s=sdBox(p-vec2(0.0,-0.1),vec2(0.05,0.3)); return min(h,s); }

    float draw_A(vec2 p) { float l1=sdSegment(p,vec2(-0.25,-0.3),vec2(0.0,0.3)); float l2=sdSegment(p,vec2(0.25,-0.3),vec2(0.0,0.3)); float l3=sdSegment(p,vec2(-0.15,0.0),vec2(0.15,0.0)); return min(min(l1,l2),l3); }
    float draw_2(vec2 p) { float s1=sdSegment(p,vec2(0.2,-0.3),vec2(-0.2,-0.3)); float s2=sdSegment(p,vec2(-0.2,-0.3),vec2(-0.2,0.0)); float s3=sdSegment(p,vec2(-0.2,0.0),vec2(0.2,0.0)); float s4=sdSegment(p,vec2(0.2,0.0),vec2(0.2,0.3)); float s5=sdSegment(p,vec2(0.2,0.3),vec2(-0.2,0.3)); return min(min(min(min(s1,s2),s3),s4),s5); }
    float draw_J(vec2 p) { float l1=sdSegment(p,vec2(0.0,0.3),vec2(0.0,-0.1)); float l2=sdSegment(p,vec2(0.0,-0.1),vec2(-0.2,-0.3)); return min(l1,l2); }
    float draw_Q(vec2 p) { return sdCircle(p,0.25); }
    float draw_K(vec2 p) { float l1=sdSegment(p,vec2(-0.2,0.3),vec2(-0.2,-0.3)); float l2=sdSegment(p,vec2(-0.2,0.0),vec2(0.2,0.0)); return min(l1,l2); }

    float suitSDFAt(vec2 p, float idx) {
      if (abs(idx - 0.0) < 0.5) return drawHeart(p);
      if (abs(idx - 1.0) < 0.5) return drawDiamond(p);
      if (abs(idx - 2.0) < 0.5) return drawClub(p);
      return drawSpade(p);
    }

    void main() {
      if (sdBox(v_uv - 0.5, vec2(0.48, 0.48)) - 0.02 > 0.0) discard;

      if (u_isFrontFace) {
        vec3 color = vec3(1.0);
        vec3 engravingColor = u_isRedSuit > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 0.0);
        float thickness = 0.06;

        vec2 valUV_TR = (v_uv - vec2(0.88, 0.18)) * 7.0;
        vec2 valUV_BL = (v_uv - vec2(0.12, 0.82)) * 7.0;
        float valSDF = min(
          (u_cardValue == 1.0) ? draw_A(valUV_TR) :
          (u_cardValue > 1.5 && u_cardValue < 2.5) ? draw_2(valUV_TR) :
          (u_cardValue == 11.0) ? draw_J(valUV_TR) :
          (u_cardValue == 12.0) ? draw_Q(valUV_TR) :
          (u_cardValue == 13.0) ? draw_K(valUV_TR) : 1.0,

          (u_cardValue == 1.0) ? draw_A(valUV_BL) :
          (u_cardValue > 1.5 && u_cardValue < 2.5) ? draw_2(valUV_BL) :
          (u_cardValue == 11.0) ? draw_J(valUV_BL) :
          (u_cardValue == 12.0) ? draw_Q(valUV_BL) :
          (u_cardValue == 13.0) ? draw_K(valUV_BL) : 1.0
        );
        color = mix(engravingColor, color, smoothstep(0.0, thickness, valSDF));

        vec2 suitUV_TL = (v_uv - vec2(0.12, 0.18)) * 10.0;
        vec2 suitUV_BR = (v_uv - vec2(0.88, 0.82)) * 10.0;
        float suitSDF_TL = suitSDFAt(suitUV_TL, u_suitIndex);
        float suitSDF_BR = suitSDFAt(suitUV_BR, u_suitIndex);
        float suitSDF = min(suitSDF_TL, suitSDF_BR);
        color = mix(engravingColor, color, smoothstep(0.0, thickness, suitSDF));

        gl_FragColor = vec4(color, 1.0);
      } else {
        gl_FragColor = texture2D(u_backTexture, v_uv);
      }
    }
`;