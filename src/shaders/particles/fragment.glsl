/**
 * GPU Particle System - Render Fragment Shader (GLSL 300 ES)
 *
 * Creates smooth, glowing particles with:
 * - Circular shape with soft edges
 * - Color based on lifetime
 * - Additive blending glow effect
 * - Dynamic color variation
 */

precision highp float;

// Uniforms
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColorEnd;      // Color at end of lifetime
uniform float uGlowStrength;
uniform float uCoreSize;     // Size of bright core (0-1)

// Varyings from vertex shader
in float vLifetime;
in float vAlpha;
in float vDistance;
in vec2 vReference;

// Output color (Three.js handles this automatically, but declaring for clarity)
// Three.js will convert gl_FragColor usage automatically

// ==========================================
// Hash function for per-particle variation
// ==========================================
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    // ==========================================
    // Circular Particle Shape
    // ==========================================

    // gl_PointCoord is UV within the point sprite (0-1)
    // Center is at (0.5, 0.5)
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Discard pixels outside the circle
    if (dist > 0.5) {
        discard;
    }

    // ==========================================
    // Soft Edge Falloff
    // ==========================================

    // Smooth falloff from center to edge
    // Creates soft, glowing appearance
    float softEdge = 1.0 - smoothstep(0.0, 0.5, dist);

    // Power curve for more intense center
    float glow = pow(softEdge, 1.5);

    // Bright core
    float core = 1.0 - smoothstep(0.0, uCoreSize * 0.5, dist);
    core = pow(core, 2.0);

    // Combine glow and core
    float intensity = glow + core * 0.5;

    // ==========================================
    // Color Calculation
    // ==========================================

    // Per-particle color variation
    float colorVariation = hash(vReference);

    // Interpolate between start and end color based on lifetime
    // Lifetime goes from 1 (new) to 0 (dying)
    float lifetimeProgress = 1.0 - vLifetime;
    vec3 baseColor = mix(uColor, uColorEnd, lifetimeProgress * 0.5);

    // Add slight hue variation per particle
    float hueShift = (colorVariation - 0.5) * 0.2;
    baseColor.r += hueShift;
    baseColor.b -= hueShift * 0.5;

    // Time-based color shimmer
    float shimmer = sin(uTime * 2.0 + colorVariation * 6.28) * 0.1;
    baseColor += shimmer;

    // ==========================================
    // Glow Effect
    // ==========================================

    // Add glow color (brighter at center)
    vec3 glowColor = baseColor * (1.0 + uGlowStrength * core);

    // Subtle rainbow edge effect for extra polish
    float rainbow = sin(dist * 12.0 + uTime * 2.0 + colorVariation * 6.28);
    glowColor.r += rainbow * 0.05 * softEdge;
    glowColor.b += rainbow * 0.03 * softEdge;

    // ==========================================
    // Final Color and Alpha
    // ==========================================

    // Apply intensity
    vec3 finalColor = glowColor * intensity;

    // Add extra brightness at core
    finalColor += vec3(1.0) * core * 0.3;

    // Calculate final alpha
    float finalAlpha = vAlpha * intensity;

    // Extra alpha for core (makes it pop)
    finalAlpha += core * 0.2 * vAlpha;

    // Clamp values
    finalColor = clamp(finalColor, 0.0, 1.5);
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);

    // ==========================================
    // Twinkle Effect
    // ==========================================

    // Occasional bright twinkle
    float twinklePhase = uTime * 5.0 + colorVariation * 100.0;
    float twinkle = pow(max(sin(twinklePhase), 0.0), 16.0);
    finalColor += twinkle * 0.5;
    finalAlpha += twinkle * 0.2;

    // ==========================================
    // Output
    // ==========================================

    gl_FragColor = vec4(finalColor, finalAlpha);
}
