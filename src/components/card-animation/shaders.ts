export const VertexShaderSource = `
    attribute vec2 a_position; // -1..1 quad (tessellated)
    uniform mat4 u_mvp_matrix; // Model-View-Projection Matrix
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

    // --- Uniforms ---
    uniform sampler2D u_texture;      // back texture
    uniform sampler2D u_suitTexture;  // suit icon texture (kept for compatibility)
    uniform sampler2D u_frontTexture; // new: front face image (transparent)
    uniform bool u_isFrontFace;       // switch between front and back
    uniform bool u_useFrontTexture;   // if true, sample u_frontTexture over white
    uniform float u_cardValue;
    uniform float u_isRedSuit;
    uniform float u_suitIndex;        // 0=hearts,1=diamonds,2=clubs,3=spades
    uniform vec2 u_backUVScale;       // scale for back texture uv
    uniform vec2 u_backUVOffset;      // offset for back texture uv

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
    float getValueSDF(vec2 uv, float value) {
        if(value == 1.0) return draw_A(uv);
        if(value > 1.5 && value < 2.5) return draw_2(uv);
        if(value == 11.0) return draw_J(uv);
        if(value == 12.0) return draw_Q(uv);
        if(value == 13.0) return draw_K(uv);
        return 1.0;
    }

    float getSuitSDF(vec2 uv, float suitIndex) {
        if (suitIndex < 0.5) return drawHeart(uv);
        if (suitIndex < 1.5) return drawDiamond(uv);
        if (suitIndex < 2.5) return drawClub(uv);
        return drawSpade(uv);
    }

    void main() {
        // Loosen edge discard threshold slightly to tolerate perspective/bend warping
        if (sdBox(v_uv - 0.5, vec2(0.485, 0.485)) - 0.02 > 0.0) discard;

        if (u_isFrontFace) {
            if (u_useFrontTexture) {
                vec4 tex = texture2D(u_frontTexture, v_uv);
                vec3 color = mix(vec3(1.0), tex.rgb, tex.a); // composite over white
                gl_FragColor = vec4(color, 1.0);
            } else {
                vec3 color = vec3(1.0);
                vec3 engravingColor = u_isRedSuit > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 0.0);
                float thickness = 0.06;

                // Value marks
                vec2 valUV_TR = (v_uv - vec2(0.88, 0.18)) * 7.0;
                vec2 valUV_BL = (v_uv - vec2(0.12, 0.82)) * 7.0;
                float valSDF = min(getValueSDF(valUV_TR, u_cardValue), getValueSDF(valUV_BL, u_cardValue));
                color = mix(engravingColor, color, smoothstep(0.0, thickness, valSDF));

                // Suit marks rendered procedurally
                vec2 suitUV_TL = (v_uv - vec2(0.12, 0.18)) * 2.8; // slightly larger than value
                vec2 suitUV_BR = (v_uv - vec2(0.88, 0.82)) * 2.8;
                float suitSDF_TL = getSuitSDF(suitUV_TL, u_suitIndex);
                float suitSDF_BR = getSuitSDF(suitUV_BR, u_suitIndex);
                color = mix(engravingColor, color, smoothstep(0.0, thickness, suitSDF_TL));
                color = mix(engravingColor, color, smoothstep(0.0, thickness, suitSDF_BR));

                gl_FragColor = vec4(color, 1.0);
            }
        } else {
            vec2 uv = v_uv * u_backUVScale + u_backUVOffset; // cover-fit mapping
            gl_FragColor = texture2D(u_texture, uv);
        }
    }
`;