/**
 * Holographic/Iridescent Fragment Shader
 * Professional Rainbow Gradient Effect
 *
 * Features:
 * - HSL-based rainbow color gradient
 * - Fresnel-based iridescence
 * - Time-based color animation
 * - Emissive glow properties
 * - Scan lines and glitch effects
 * - Film grain and noise
 */

precision highp float;

// ==========================================
// Uniforms
// ==========================================

uniform float uTime;
uniform vec3 uColor;              // Base tint color
uniform float uOpacity;
uniform float uScanLineIntensity;
uniform float uGlitchIntensity;
uniform float uRainbowSpeed;      // Rainbow animation speed
uniform float uRainbowScale;      // Rainbow pattern scale
uniform float uIridescenceStrength;
uniform float uEmissiveStrength;
uniform float uMetalness;
uniform float uRoughness;

// ==========================================
// Varyings
// ==========================================

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
// Constants
// ==========================================

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// ==========================================
// Utility Functions
// ==========================================

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

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

// ==========================================
// HSL to RGB Conversion
// ==========================================

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;

    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c * 0.5;

    vec3 rgb;

    if (h < 1.0 / 6.0) {
        rgb = vec3(c, x, 0.0);
    } else if (h < 2.0 / 6.0) {
        rgb = vec3(x, c, 0.0);
    } else if (h < 3.0 / 6.0) {
        rgb = vec3(0.0, c, x);
    } else if (h < 4.0 / 6.0) {
        rgb = vec3(0.0, x, c);
    } else if (h < 5.0 / 6.0) {
        rgb = vec3(x, 0.0, c);
    } else {
        rgb = vec3(c, 0.0, x);
    }

    return rgb + m;
}

// ==========================================
// Rainbow Gradient Function
// ==========================================

vec3 rainbow(float t) {
    // Smooth rainbow using sine waves
    vec3 color;
    color.r = sin(t * TAU) * 0.5 + 0.5;
    color.g = sin(t * TAU + TAU / 3.0) * 0.5 + 0.5;
    color.b = sin(t * TAU + TAU * 2.0 / 3.0) * 0.5 + 0.5;
    return color;
}

// ==========================================
// Iridescence Function
// ==========================================

vec3 iridescence(float angle, float thickness) {
    // Thin-film interference simulation
    float phase = angle * thickness * 4.0;

    vec3 color;
    color.r = sin(phase) * 0.5 + 0.5;
    color.g = sin(phase + 2.094) * 0.5 + 0.5;  // 120 degrees
    color.b = sin(phase + 4.188) * 0.5 + 0.5;  // 240 degrees

    return color;
}

// ==========================================
// Main Shader
// ==========================================

void main() {
    // ==========================================
    // View Direction
    // ==========================================

    vec3 viewDir = normalize(-vViewPosition);
    float viewAngle = dot(viewDir, vNormal);

    // ==========================================
    // Rainbow HSL Color Gradient
    // ==========================================

    // Multiple inputs for rainbow hue
    float hueBase = uTime * uRainbowSpeed;
    float huePosition = (vPosition.y + vPosition.x * 0.3) * uRainbowScale;
    float hueNormal = dot(vWorldNormal, vec3(1.0, 0.5, 0.25)) * 0.5;
    float hueElevation = vElevation * 2.0;

    // Combine for final hue
    float hue = fract(hueBase + huePosition + hueNormal + hueElevation);

    // HSL color with high saturation
    vec3 rainbowColor = hsl2rgb(vec3(hue, 0.9, 0.6));

    // Alternative rainbow using sine waves
    vec3 rainbowAlt = rainbow(hue);

    // Blend both rainbow methods
    vec3 baseRainbow = mix(rainbowColor, rainbowAlt, 0.5);

    // ==========================================
    // Fresnel-based Iridescence
    // ==========================================

    // Strong iridescence at glancing angles
    vec3 iridescentColor = iridescence(vFresnel, 2.0 + uTime * 0.5);

    // Fresnel rim color shift
    float fresnelHue = fract(hue + vFresnel * 0.5);
    vec3 fresnelColor = hsl2rgb(vec3(fresnelHue, 1.0, 0.7));

    // Combine iridescence with fresnel
    vec3 edgeColor = mix(iridescentColor, fresnelColor, 0.5) * vFresnel;

    // ==========================================
    // Combine Colors
    // ==========================================

    vec3 holoColor = baseRainbow;

    // Add iridescent edge glow
    holoColor += edgeColor * uIridescenceStrength;

    // Tint with base color
    holoColor = mix(holoColor, holoColor * uColor, 0.3);

    // ==========================================
    // Metallic/Roughness Effect
    // ==========================================

    // Metallic reflection simulation
    float metallic = uMetalness * (1.0 - uRoughness);
    vec3 reflectionColor = rainbow(fract(hue + viewAngle * 0.5 + uTime * 0.1));
    holoColor = mix(holoColor, reflectionColor, metallic * vFresnel);

    // ==========================================
    // Scan Lines
    // ==========================================

    // Horizontal scan lines
    float scanLines = sin(vUv.y * 300.0 + uTime * 8.0) * 0.5 + 0.5;
    scanLines = pow(scanLines, 3.0);

    // Apply scan line darkening
    holoColor *= 1.0 - scanLines * uScanLineIntensity * 0.2;

    // Moving scan beam highlight
    vec3 scanBeamColor = hsl2rgb(vec3(fract(hue + 0.5), 1.0, 0.8));
    holoColor += scanBeamColor * vScanLine * 0.4;

    // ==========================================
    // Chromatic Aberration / Color Fringing
    // ==========================================

    float fringe = sin(vUv.y * 150.0 + uTime * 12.0) * 0.015;
    holoColor.r += fringe;
    holoColor.b -= fringe;

    // Edge chromatic shift
    holoColor.r += vFresnel * sin(uTime * 4.0) * 0.15;
    holoColor.g += vFresnel * sin(uTime * 4.0 + 2.094) * 0.15;
    holoColor.b += vFresnel * sin(uTime * 4.0 + 4.188) * 0.15;

    // ==========================================
    // Glitch Effect
    // ==========================================

    if (vGlitch > 0.0) {
        // Color channel split
        float glitchOffset = vGlitch * 0.15;
        holoColor.r += glitchOffset;
        holoColor.b -= glitchOffset;

        // Random color blocks
        vec2 blockCoord = floor(vUv * 25.0);
        float blockNoise = hash(blockCoord + floor(uTime * 25.0));

        if (blockNoise > 0.85) {
            // Cyan glitch blocks
            holoColor = vec3(0.0, 1.0, 1.0);
        } else if (blockNoise > 0.75) {
            // Magenta glitch blocks
            holoColor = vec3(1.0, 0.0, 1.0);
        }

        // Horizontal shift bands
        float bandY = floor(vUv.y * 30.0);
        float bandShift = hash(vec2(bandY, floor(uTime * 30.0)));
        if (bandShift > 0.9) {
            holoColor = rainbow(fract(hue + bandShift));
        }
    }

    // ==========================================
    // Emissive Glow
    // ==========================================

    // Self-illumination based on color intensity
    float luminance = dot(holoColor, vec3(0.299, 0.587, 0.114));
    vec3 emissive = holoColor * uEmissiveStrength * (0.5 + luminance * 0.5);

    // Edge glow (emissive fresnel)
    emissive += fresnelColor * vFresnel * uEmissiveStrength * 0.5;

    holoColor += emissive;

    // ==========================================
    // Noise and Grain
    // ==========================================

    // Film grain
    float grain = noise(vUv * 800.0 + uTime * 150.0) * 0.08;
    holoColor += grain - 0.04;

    // Digital noise sparkles
    float digitalNoise = step(0.985, noise(vUv * 200.0 + uTime * 80.0));
    holoColor += digitalNoise * 0.4;

    // ==========================================
    // Flickering
    // ==========================================

    float flicker = sin(uTime * 40.0) * 0.015 + 1.0;
    float randomFlicker = step(0.993, hash(vec2(floor(uTime * 80.0), 0.0)));
    flicker -= randomFlicker * 0.25;

    holoColor *= flicker;

    // ==========================================
    // Alpha Calculation
    // ==========================================

    float alpha = uOpacity;

    // Fresnel-based transparency (more opaque at edges)
    alpha += vFresnel * 0.3;

    // Scan line alpha variation
    alpha *= 1.0 - scanLines * 0.15;

    // Flicker alpha
    alpha *= flicker;

    // Clamp alpha
    alpha = clamp(alpha, 0.0, 1.0);

    // ==========================================
    // Final Output
    // ==========================================

    // Clamp colors (allow some HDR for bloom)
    holoColor = clamp(holoColor, 0.0, 2.0);

    gl_FragColor = vec4(holoColor, alpha);
}
