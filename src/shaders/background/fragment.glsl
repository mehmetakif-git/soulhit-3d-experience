/**
 * Gradient Background - Fragment Shader
 * Professional animated gradient with noise
 *
 * Features:
 * - Multi-color gradient
 * - Animated noise pattern
 * - Subtle star field
 * - Smooth color transitions
 */

precision highp float;

uniform float uTime;
uniform vec3 uColorTop;
uniform vec3 uColorMiddle;
uniform vec3 uColorBottom;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uNoiseStrength;
uniform float uStarDensity;
uniform float uStarBrightness;
uniform vec2 uResolution;

varying vec2 vUv;

// ==========================================
// Constants
// ==========================================

const float PI = 3.14159265359;

// ==========================================
// Hash Functions
// ==========================================

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// ==========================================
// Noise Functions
// ==========================================

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

// ==========================================
// Star Field
// ==========================================

float stars(vec2 uv, float density) {
    vec2 grid = floor(uv * density);
    vec2 gridUV = fract(uv * density);

    float star = 0.0;

    // Check this cell and neighbors
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 cell = grid + vec2(x, y);
            float rand = hash(cell);

            // Star position within cell
            vec2 starPos = vec2(hash(cell + 0.1), hash(cell + 0.2));

            // Distance to star
            vec2 toStar = (gridUV - vec2(x, y)) - starPos;
            float dist = length(toStar);

            // Star brightness with twinkle
            float twinkle = sin(uTime * (2.0 + rand * 3.0) + rand * 6.28) * 0.5 + 0.5;
            float brightness = smoothstep(0.1, 0.0, dist) * rand * twinkle;

            // Only show some stars
            if (rand > 0.97) {
                star += brightness;
            }
        }
    }

    return star;
}

// ==========================================
// Nebula Effect
// ==========================================

vec3 nebula(vec2 uv, float time) {
    // Animated noise coordinates
    vec2 noiseCoord = uv * uNoiseScale + time * uNoiseSpeed * 0.1;

    // Multiple noise layers
    float n1 = fbm(noiseCoord);
    float n2 = fbm(noiseCoord * 2.0 + vec2(100.0));
    float n3 = fbm(noiseCoord * 0.5 + vec2(200.0) + time * 0.05);

    // Combine noise layers
    float nebulaNoise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // Color variation based on noise
    vec3 nebulaColor1 = vec3(0.2, 0.1, 0.4); // Purple
    vec3 nebulaColor2 = vec3(0.1, 0.2, 0.4); // Blue
    vec3 nebulaColor3 = vec3(0.3, 0.1, 0.2); // Magenta

    vec3 nebColor = mix(nebulaColor1, nebulaColor2, n1);
    nebColor = mix(nebColor, nebulaColor3, n2 * 0.5);

    return nebColor * nebulaNoise * uNoiseStrength;
}

// ==========================================
// Main
// ==========================================

void main() {
    vec2 uv = vUv;

    // Aspect ratio correction for stars
    vec2 aspectUV = uv;
    aspectUV.x *= uResolution.x / uResolution.y;

    // ==========================================
    // Base Gradient
    // ==========================================

    // Vertical gradient with smoothstep for better transitions
    float gradientPos = uv.y;

    // Add slight wave to gradient
    float wave = sin(uv.x * 3.0 + uTime * 0.2) * 0.02;
    gradientPos += wave;

    // Three-color gradient
    vec3 gradient;
    if (gradientPos < 0.5) {
        float t = smoothstep(0.0, 0.5, gradientPos);
        gradient = mix(uColorBottom, uColorMiddle, t);
    } else {
        float t = smoothstep(0.5, 1.0, gradientPos);
        gradient = mix(uColorMiddle, uColorTop, t);
    }

    // ==========================================
    // Nebula/Noise Overlay
    // ==========================================

    vec3 nebulaColor = nebula(uv, uTime);
    gradient += nebulaColor;

    // ==========================================
    // Star Field
    // ==========================================

    float starField = stars(aspectUV + uTime * 0.01, uStarDensity);
    gradient += vec3(starField) * uStarBrightness;

    // ==========================================
    // Subtle Glow
    // ==========================================

    // Center glow
    float centerDist = length(uv - vec2(0.5));
    float glow = smoothstep(0.8, 0.2, centerDist) * 0.1;
    gradient += uColorMiddle * glow;

    // ==========================================
    // Film Grain
    // ==========================================

    float grain = (hash(uv * 1000.0 + uTime * 100.0) - 0.5) * 0.03;
    gradient += grain;

    // ==========================================
    // Output
    // ==========================================

    gradient = clamp(gradient, 0.0, 1.0);

    gl_FragColor = vec4(gradient, 1.0);
}
