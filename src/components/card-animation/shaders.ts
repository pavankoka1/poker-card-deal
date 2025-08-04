export const VertexShaderSource = `
    attribute vec2 a_position;
    uniform mat4 u_mvp_matrix; // Model-View-Projection Matrix

    varying vec2 v_uv;

    void main() {
        gl_Position = u_mvp_matrix * vec4(a_position, 0.0, 1.0);
        v_uv = a_position * 0.5 + 0.5; // Simple UV mapping
    }
`;

// This is the final, complete fragment shader.
export const FragmentShaderSource = `
    precision mediump float;

    // --- Uniforms ---
    uniform sampler2D u_texture;
    uniform sampler2D u_suitTexture;
    uniform bool u_isFrontFace; // The key to switching between front and back
    uniform float u_cardValue;
    uniform float u_isRedSuit;

    // --- Varyings ---
    varying vec2 v_uv;

    // --- SDF Primitives ---
    float sdBox(vec2 p, vec2 b) { vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
    float sdCircle(vec2 p, float r) { return length(p) - r; }
    float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa=p-a; vec2 ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
    float opUnion(float d1, float d2) { return min(d1, d2); }

    // --- Suit SDFs ---
    float drawHeart(vec2 p) { p.y+=0.1; p.x=abs(p.x); vec2 q=p-vec2(0.25,0.75); q=mat2(0.8,-0.6,0.6,0.8)*q; return opUnion(sdCircle(p-vec2(0.0,0.25),0.25),sdBox(p-vec2(0.0,-0.1),vec2(0.5,0.35)))-0.05; }
    float drawDiamond(vec2 p) { p=abs(p); return sdSegment(p,vec2(0,0.4),vec2(0.3,0)) - 0.05; }
    float drawClub(vec2 p) { float c1=sdCircle(p-vec2(0,0.15),0.25); float c2=sdCircle(p-vec2(-0.22,-0.1),0.25); float c3=sdCircle(p-vec2(0.22,-0.1),0.25); float s=sdBox(p-vec2(0,-0.2),vec2(0.05,0.3)); return opUnion(opUnion(opUnion(c1,c2),c3),s); }
    float drawSpade(vec2 p) { float h=drawHeart(p*vec2(1.0, -1.0) + vec2(0.0, -0.4)); float s=sdBox(p-vec2(0,-0.1),vec2(0.05,0.3)); return opUnion(h,s); }

    // --- Number SDFs ---
    float draw_A(vec2 p) { float l1=sdSegment(p,vec2(-0.25,-0.3),vec2(0.0,0.3)); float l2=sdSegment(p,vec2(0.25,-0.3),vec2(0.0,0.3)); float l3=sdSegment(p,vec2(-0.15,0.0),vec2(0.15,0.0)); return min(min(l1,l2),l3); }
    float draw_2(vec2 p) { float s1=sdSegment(p,vec2(0.2,-0.3),vec2(-0.2,-0.3)); float s2=sdSegment(p,vec2(-0.2,-0.3),vec2(-0.2,0.0)); float s3=sdSegment(p,vec2(-0.2,0.0),vec2(0.2,0.0)); float s4=sdSegment(p,vec2(0.2,0.0),vec2(0.2,0.3)); float s5=sdSegment(p,vec2(0.2,0.3),vec2(-0.2,0.3)); return min(min(min(min(s1,s2),s3),s4),s5); }
    float draw_J(vec2 p) { float l1=sdSegment(p,vec2(0.0,0.3),vec2(0.0,-0.1)); float l2=sdSegment(p,vec2(0.0,-0.1),vec2(-0.2,-0.3)); return min(l1,l2); }
    float draw_Q(vec2 p) { return sdCircle(p, 0.25); }
    float draw_K(vec2 p) { float l1=sdSegment(p,vec2(-0.2,0.3),vec2(-0.2,-0.3)); float l2=sdSegment(p,vec2(-0.2,0.0),vec2(0.2,0.0)); return min(l1,l2); }

    // --- SDF Selectors ---
    float getSuitSDF(vec2 uv, float suitVal) {
        if(suitVal == 0.0) return drawHeart(uv);
        if(suitVal == 1.0) return drawDiamond(uv);
        if(suitVal == 2.0) return drawClub(uv);
        if(suitVal == 3.0) return drawSpade(uv);
        return 1.0;
    }
    float getValueSDF(vec2 uv, float value) {
        if(value == 1.0) return draw_A(uv);
        if(value > 1.5 && value < 2.5) return draw_2(uv);
        if(value == 11.0) return draw_J(uv);
        if(value == 12.0) return draw_Q(uv);
        if(value == 13.0) return draw_K(uv);
        return 1.0;
    }

    void main() {
        if (sdBox(v_uv - 0.5, vec2(0.48, 0.48)) - 0.02 > 0.0) discard;

        if (u_isFrontFace) {
            vec3 color = vec3(1.0);
            vec3 engravingColor = u_isRedSuit > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 0.0);
            float thickness = 0.06; // Even Bolder text

            // --- Top-Right (Value) & Bottom-Left (Value) ---
            vec2 valUV_TR = (v_uv - vec2(0.88, 0.18)) * 7.0; // Centered
            vec2 valUV_BL = (v_uv - vec2(0.12, 0.82)) * 7.0; // Centered
            // valUV_BL *= -1.0; // Rotation removed to keep text upright
            float valSDF = min(getValueSDF(valUV_TR, u_cardValue), getValueSDF(valUV_BL, u_cardValue));
            color = mix(engravingColor, color, smoothstep(0.0, thickness, valSDF));

            // --- Top-Left (Suit) & Bottom-Right (Suit) ---
            vec2 suitUV_TL = (v_uv - vec2(0.12, 0.18)) * 10.0; // Centered
            vec2 suitUV_BR = (v_uv - vec2(0.88, 0.82)) * 10.0; // Centered
            // suitUV_BR *= -1.0; // Rotation removed to keep suit upright
            
            vec4 suitColor_TL = texture2D(u_suitTexture, suitUV_TL);
            if (suitUV_TL.x > 0.0 && suitUV_TL.x < 1.0 && suitUV_TL.y > 0.0 && suitUV_TL.y < 1.0) {
                 if (suitColor_TL.a > 0.5) color = mix(color, suitColor_TL.rgb, suitColor_TL.a);
            }

            vec4 suitColor_BR = texture2D(u_suitTexture, suitUV_BR);
            if (suitUV_BR.x > 0.0 && suitUV_BR.x < 1.0 && suitUV_BR.y > 0.0 && suitUV_BR.y < 1.0) {
                 if (suitColor_BR.a > 0.5) color = mix(color, suitColor_BR.rgb, suitColor_BR.a);
            }


            gl_FragColor = vec4(color, 1.0);
        } else {
            gl_FragColor = texture2D(u_texture, v_uv);
        }
    }
`; 