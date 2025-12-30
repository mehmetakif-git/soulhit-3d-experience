/**
 * Holographic/Iridescent Vertex Shader
 * Professional Rainbow Gradient Effect
 *
 * Features:
 * - HSL-based rainbow color preparation
 * - Vertex displacement for organic movement
 * - Scan line animation
 * - Glitch distortion effects
 * - Fresnel calculation for iridescence
 */

// Uniforms
uniform float uTime;
uniform float uGlitchIntensity;
uniform float uDisplacementScale;
uniform float uWaveSpeed;
uniform float uWaveFrequency;

// Varyings to fragment shader
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying float vFresnel;
varying float vScanLine;
varying float vGlitch;
varying float vElevation;

// ==========================================
// Hash Functions
// ==========================================

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// ==========================================
// Noise Function
// ==========================================

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n = i.x + i.y * 57.0 + i.z * 113.0;

    float a = hash(n);
    float b = hash(n + 1.0);
    float c = hash(n + 57.0);
    float d = hash(n + 58.0);
    float e = hash(n + 113.0);
    float f1 = hash(n + 114.0);
    float g = hash(n + 170.0);
    float h = hash(n + 171.0);

    return mix(
        mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
        mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
        f.z
    );
}

void main() {
    vUv = uv;

    // ==========================================
    // Normal Calculation
    // ==========================================

    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    // ==========================================
    // Glitch Effect
    // ==========================================

    float glitchTime = floor(uTime * 15.0);
    float glitchRandom = hash(glitchTime);
    vGlitch = step(0.92, glitchRandom) * uGlitchIntensity;

    // ==========================================
    // Vertex Displacement
    // ==========================================

    vec3 displacedPosition = position;

    // Organic wave displacement
    float waveX = sin(position.y * uWaveFrequency + uTime * uWaveSpeed) * uDisplacementScale;
    float waveY = cos(position.x * uWaveFrequency * 0.8 + uTime * uWaveSpeed * 0.7) * uDisplacementScale;
    float waveZ = sin(position.x * uWaveFrequency + position.y * uWaveFrequency + uTime * uWaveSpeed) * uDisplacementScale * 0.5;

    displacedPosition.x += waveX;
    displacedPosition.y += waveY;
    displacedPosition.z += waveZ;

    // Store elevation for color variation
    vElevation = waveX + waveY + waveZ;

    // Glitch displacement
    if (vGlitch > 0.0) {
        float sliceY = floor(position.y * 15.0);
        float sliceRandom = hash(sliceY + glitchTime);
        displacedPosition.x += (sliceRandom - 0.5) * vGlitch * 0.15;

        // RGB split effect preparation
        float sliceRandom2 = hash(sliceY * 2.0 + glitchTime);
        if (sliceRandom2 > 0.7) {
            displacedPosition.z += vGlitch * 0.05;
        }
    }

    // Subtle breathing/pulse
    float pulse = sin(uTime * 2.0) * 0.005;
    displacedPosition *= 1.0 + pulse;

    // High-frequency noise displacement
    float noiseDisp = noise(position * 5.0 + uTime * 0.5) * uDisplacementScale * 0.3;
    displacedPosition += normal * noiseDisp;

    // ==========================================
    // Scan Line Calculation
    // ==========================================

    float scanSpeed = 1.5;
    float scanPosition = fract(uTime * scanSpeed);

    // Normalize Y position to 0-1 range
    float normalizedY = (position.y + 1.0) * 0.5;
    vScanLine = 1.0 - abs(normalizedY - scanPosition) * 8.0;
    vScanLine = clamp(vScanLine, 0.0, 1.0);
    vScanLine = pow(vScanLine, 2.0); // Sharper falloff

    // ==========================================
    // Transform Pipeline
    // ==========================================

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    vPosition = displacedPosition;

    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;

    gl_Position = projectionMatrix * viewPosition;

    // ==========================================
    // Fresnel Calculation
    // ==========================================

    vec3 viewDir = normalize(-vViewPosition);
    vFresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
}
