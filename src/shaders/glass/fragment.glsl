/**
 * Glassmorphic Card - Fragment Shader
 * Professional Frosted Glass Effect
 *
 * Features:
 * - Frosted glass blur (multi-sample box blur)
 * - Physical refraction with IOR
 * - Fresnel rim lighting
 * - Chromatic aberration
 * - Iridescent color shift
 * - Sparkle/glitter effect
 * - Content overlay glow
 *
 * Glassmorphism Technique:
 * We simulate frosted glass by sampling the background texture
 * multiple times with offsets, creating a blur effect.
 * The refraction distorts these sample positions based on normals.
 */

precision highp float;

// ==========================================
// Uniforms
// ==========================================

// Time and animation
uniform float uTime;
uniform float uHover;

// Glass properties
uniform float uOpacity;           // Base opacity (0.6-0.8)
uniform float uBlur;              // Blur strength (0-1)
uniform float uRefraction;        // Refraction strength
uniform float uIOR;               // Index of Refraction (1.45 for glass)
uniform float uChromatic;         // Chromatic aberration (0.01-0.02)

// Colors
uniform vec3 uColor;              // Base tint color
uniform vec3 uFresnelColor;       // Rim/edge color
uniform float uFresnelPower;      // Fresnel intensity

// Background
uniform sampler2D uBackgroundTexture;
uniform vec2 uResolution;

// Content
uniform float uGlowStrength;      // Glow behind content
uniform float uBorderRadius;      // For rounded corners

// ==========================================
// Varyings
// ==========================================

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec4 vScreenPosition;
varying float vFresnel;

// ==========================================
// Constants
// ==========================================

const float PI = 3.14159265359;
const int BLUR_SAMPLES = 16;      // Number of blur samples

// ==========================================
// Noise Functions
// ==========================================

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

/**
 * 2D Simplex Noise
 */
float snoise(vec2 v) {
    const vec4 C = vec4(
        0.211324865405187,
        0.366025403784439,
        -0.577350269189626,
        0.024390243902439
    );

    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(
        dot(x0, x0),
        dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)
    ), 0.0);

    m = m * m;
    m = m * m;

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0 * dot(m, g);
}

/**
 * Fractal Brownian Motion noise
 */
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 4; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

// ==========================================
// Blur Functions
// ==========================================

/**
 * Get screen UV from clip position
 */
vec2 getScreenUV() {
    vec2 screenUV = vScreenPosition.xy / vScreenPosition.w;
    screenUV = screenUV * 0.5 + 0.5;
    return screenUV;
}

/**
 * Calculate refraction offset based on normal and IOR
 */
vec2 getRefractionOffset(vec3 viewDir, vec3 normal, float ior) {
    // Simplified refraction using normal direction
    float ratio = 1.0 / ior;
    vec3 refracted = refract(viewDir, normal, ratio);

    // Project to 2D offset
    return refracted.xy * uRefraction;
}

/**
 * Frosted glass blur with multi-sampling
 * Uses a disc pattern for natural-looking blur
 */
vec3 frostedBlur(vec2 uv, float blurAmount) {
    vec3 color = vec3(0.0);

    // Blur sample offsets in a disc pattern
    const vec2 offsets[16] = vec2[16](
        vec2(-0.94201624, -0.39906216),
        vec2(0.94558609, -0.76890725),
        vec2(-0.09418410, -0.92938870),
        vec2(0.34495938, 0.29387760),
        vec2(-0.91588581, 0.45771432),
        vec2(-0.81544232, -0.87912464),
        vec2(-0.38277543, 0.27676845),
        vec2(0.97484398, 0.75648379),
        vec2(0.44323325, -0.97511554),
        vec2(0.53742981, -0.47373420),
        vec2(-0.26496911, -0.41893023),
        vec2(0.79197514, 0.19090188),
        vec2(-0.24188840, 0.99706507),
        vec2(-0.81409955, 0.91437590),
        vec2(0.19984126, 0.78641367),
        vec2(0.14383161, -0.14100790)
    );

    float blurSize = blurAmount * 0.02;

    for (int i = 0; i < BLUR_SAMPLES; i++) {
        vec2 offset = offsets[i] * blurSize;

        // Add noise-based variation to each sample
        float noise = snoise(uv * 10.0 + float(i) * 0.1 + uTime * 0.1);
        offset += vec2(noise) * blurSize * 0.3;

        color += texture2D(uBackgroundTexture, uv + offset).rgb;
    }

    return color / float(BLUR_SAMPLES);
}

/**
 * Chromatic aberration - separates RGB channels
 */
vec3 chromaticAberration(vec2 uv, vec2 direction, float amount) {
    float r = texture2D(uBackgroundTexture, uv + direction * amount).r;
    float g = texture2D(uBackgroundTexture, uv).g;
    float b = texture2D(uBackgroundTexture, uv - direction * amount).b;

    return vec3(r, g, b);
}

// ==========================================
// Glass Effect Functions
// ==========================================

/**
 * Fresnel effect with Schlick's approximation
 */
float fresnelSchlick(float cosTheta, float f0) {
    return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

/**
 * Calculate iridescence color based on viewing angle
 */
vec3 iridescence(float angle, float intensity) {
    // Thin-film interference simulation
    float phase = angle * 4.0 + uTime * 0.3;

    vec3 color;
    color.r = sin(phase) * 0.5 + 0.5;
    color.g = sin(phase + 2.094) * 0.5 + 0.5;  // 120 degrees
    color.b = sin(phase + 4.188) * 0.5 + 0.5;  // 240 degrees

    return color * intensity;
}

/**
 * Sparkle/glitter effect
 */
float sparkle(vec2 uv) {
    // High-frequency noise for sparkle positions
    float n1 = snoise(uv * 100.0 + uTime * 0.5);
    float n2 = snoise(uv * 150.0 - uTime * 0.3);

    // Sharp threshold for sparkle points
    float sparkle = pow(max(n1 * n2, 0.0), 20.0);

    return sparkle;
}

/**
 * Rounded rectangle SDF for edge effects
 */
float roundedRectSDF(vec2 uv, vec2 size, float radius) {
    vec2 d = abs(uv - 0.5) * 2.0 - size + radius;
    return length(max(d, 0.0)) - radius;
}

// ==========================================
// Main Shader
// ==========================================

void main() {
    // ==========================================
    // Screen UV and View Direction
    // ==========================================

    vec2 screenUV = getScreenUV();
    vec3 viewDir = normalize(-vViewPosition);

    // ==========================================
    // Frosted Noise Pattern
    // ==========================================

    // Create organic frost pattern
    vec2 frostCoord = vUv * 6.0;
    float frostNoise = fbm(frostCoord + uTime * 0.02);
    frostNoise = frostNoise * 0.5 + 0.5;

    // ==========================================
    // Refraction Calculation
    // ==========================================

    // Calculate refraction offset based on IOR
    vec2 refractionOffset = getRefractionOffset(viewDir, vNormal, uIOR);

    // Add frost noise to refraction for organic look
    refractionOffset += (frostNoise - 0.5) * uRefraction * 0.5;

    // ==========================================
    // Background Sampling with Blur
    // ==========================================

    vec2 blurUV = screenUV + refractionOffset;

    // Dynamic blur based on frost and hover
    float dynamicBlur = uBlur * (0.8 + frostNoise * 0.4);
    dynamicBlur *= (1.0 - uHover * 0.3); // Slightly less blur on hover

    // Sample blurred background
    vec3 blurredBg = frostedBlur(blurUV, dynamicBlur);

    // ==========================================
    // Chromatic Aberration
    // ==========================================

    vec2 chromaticDir = vNormal.xy;
    float chromaticAmount = uChromatic * (1.0 + vFresnel * 2.0);

    vec3 chromaticColor = chromaticAberration(
        blurUV,
        chromaticDir,
        chromaticAmount
    );

    // Blend blur and chromatic
    vec3 backgroundColor = mix(blurredBg, chromaticColor, 0.3);

    // ==========================================
    // Fresnel Rim Lighting
    // ==========================================

    float fresnel = vFresnel;

    // Enhanced fresnel on hover
    fresnel *= (1.0 + uHover * 0.5);

    // Schlick fresnel for more physical look
    float fresnelIntensity = fresnelSchlick(
        max(dot(viewDir, vNormal), 0.0),
        0.04  // F0 for glass
    );

    vec3 fresnelEffect = uFresnelColor * fresnel * uFresnelPower;

    // ==========================================
    // Iridescence
    // ==========================================

    float viewAngle = dot(viewDir, vNormal);
    vec3 iridescentColor = iridescence(viewAngle + vUv.x + vUv.y, 0.15);
    iridescentColor *= fresnel; // Only on edges

    // ==========================================
    // Base Glass Color
    // ==========================================

    vec3 glassColor = uColor;

    // Tint the background
    backgroundColor = mix(backgroundColor, backgroundColor * glassColor, 0.4);

    // Add fresnel rim
    backgroundColor += fresnelEffect;

    // Add iridescence
    backgroundColor += iridescentColor;

    // ==========================================
    // Sparkle Effect
    // ==========================================

    float sparkleIntensity = sparkle(vUv) * (0.5 + uHover * 0.5);
    backgroundColor += vec3(sparkleIntensity) * 0.8;

    // ==========================================
    // Edge Glow (Content Area)
    // ==========================================

    // Rounded rectangle edge
    float edgeDist = roundedRectSDF(vUv, vec2(0.9), uBorderRadius);
    float edgeGlow = smoothstep(0.0, 0.1, -edgeDist);

    // Inner glow for content area
    float innerGlow = smoothstep(0.15, 0.0, abs(edgeDist));
    innerGlow *= uGlowStrength * (1.0 + uHover * 0.5);

    backgroundColor += uColor * innerGlow * 0.3;

    // ==========================================
    // Alpha Calculation
    // ==========================================

    float alpha = uOpacity;

    // Fresnel affects transparency
    alpha += fresnel * 0.2;

    // Frost pattern variation
    alpha *= (0.9 + frostNoise * 0.1);

    // Hover increases opacity slightly
    alpha += uHover * 0.1;

    // Edge fade for soft corners
    float cornerFade = smoothstep(-0.05, 0.0, -edgeDist);
    alpha *= cornerFade;

    // Clamp alpha
    alpha = clamp(alpha, 0.0, 1.0);

    // ==========================================
    // Final Composition
    // ==========================================

    // Add subtle noise grain for texture
    float grain = (snoise(vUv * 200.0 + uTime) * 0.5 + 0.5) * 0.02;
    backgroundColor += grain;

    // Clamp color values
    backgroundColor = clamp(backgroundColor, 0.0, 1.5);

    // ==========================================
    // Output
    // ==========================================

    gl_FragColor = vec4(backgroundColor, alpha);
}
