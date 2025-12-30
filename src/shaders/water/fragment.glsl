/**
 * Gerstner Waves Water Surface - Fragment Shader (GLSL 300 ES)
 *
 * Creates realistic water appearance with:
 * - Depth-based color gradient
 * - Fresnel reflection effect
 * - Specular highlights
 * - Subsurface scattering approximation
 * - Foam on wave peaks
 * - Caustic patterns
 */

precision highp float;

// Input from vertex shader
in vec2 vUv;
in vec3 vWorldPosition;
in vec3 vNormal;
in float vElevation;
in vec3 vTangent;
in vec3 vBinormal;

// Water colors
uniform vec3 uWaterColorDeep;
uniform vec3 uWaterColorShallow;
uniform vec3 uWaterColorFoam;

// Lighting
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform float uSpecularPower;
uniform float uSpecularIntensity;

// Camera (provided by Three.js when using cameraPosition)
uniform vec3 cameraPosition;

// Time for animated effects
uniform float uTime;

// Effect parameters
uniform float uFresnelPower;
uniform float uFresnelBias;
uniform float uFoamThreshold;
uniform float uFoamIntensity;
uniform float uCausticScale;
uniform float uCausticIntensity;
uniform float uOpacity;

// Subsurface scattering
uniform vec3 uSubsurfaceColor;
uniform float uSubsurfaceIntensity;

// Output
out vec4 fragColor;

// ==========================================
// Noise Functions for Foam and Caustics
// ==========================================

// Simple hash function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion (layered noise)
float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

// Caustic pattern (underwater light patterns)
float caustic(vec2 p, float time) {
    vec2 uv = p * uCausticScale;

    // Two moving noise layers that interfere
    float n1 = fbm(uv + vec2(time * 0.3, time * 0.2), 3);
    float n2 = fbm(uv * 1.5 - vec2(time * 0.2, time * 0.3), 3);

    // Create sharp caustic pattern through multiplication
    float causticPattern = n1 * n2 * 4.0;
    causticPattern = pow(causticPattern, 2.0);

    return clamp(causticPattern, 0.0, 1.0);
}

// ==========================================
// Fresnel Effect
// ==========================================

float fresnel(vec3 viewDir, vec3 normal, float power, float bias) {
    float facing = 1.0 - max(dot(viewDir, normal), 0.0);
    return bias + (1.0 - bias) * pow(facing, power);
}

// ==========================================
// Main
// ==========================================

void main() {
    // ==========================================
    // View Direction
    // ==========================================

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 normal = normalize(vNormal);

    // ==========================================
    // Base Water Color (depth gradient)
    // ==========================================

    // Map elevation to depth factor
    // Higher elevation = shallower (lighter)
    // Lower elevation = deeper (darker)
    float depthFactor = smoothstep(-0.5, 0.5, vElevation);

    vec3 waterColor = mix(uWaterColorDeep, uWaterColorShallow, depthFactor);

    // ==========================================
    // Fresnel Effect (reflection at grazing angles)
    // ==========================================

    float fresnelFactor = fresnel(viewDirection, normal, uFresnelPower, uFresnelBias);

    // Reflection color (sky approximation)
    vec3 reflectionColor = vec3(0.4, 0.6, 0.9);
    waterColor = mix(waterColor, reflectionColor, fresnelFactor * 0.4);

    // ==========================================
    // Specular Highlights
    // ==========================================

    vec3 lightDir = normalize(uLightDirection);

    // Blinn-Phong specular
    vec3 halfVector = normalize(lightDir + viewDirection);
    float specularFactor = pow(max(dot(normal, halfVector), 0.0), uSpecularPower);

    // Sun disk reflection (sharper)
    float sunDisk = pow(max(dot(reflect(-viewDirection, normal), lightDir), 0.0), 256.0);

    vec3 specular = uLightColor * specularFactor * uSpecularIntensity;
    specular += vec3(1.0, 0.95, 0.8) * sunDisk * 2.0;

    // ==========================================
    // Subsurface Scattering Approximation
    // ==========================================

    // Light passing through thin water at wave peaks
    float scatterFactor = max(dot(lightDir, -normal), 0.0);
    scatterFactor = pow(scatterFactor, 2.0);

    vec3 subsurface = uSubsurfaceColor * scatterFactor * uSubsurfaceIntensity;
    subsurface *= smoothstep(0.0, 0.3, vElevation); // More visible at peaks

    // ==========================================
    // Foam on Wave Peaks
    // ==========================================

    // Foam appears on wave crests
    float foamFactor = smoothstep(uFoamThreshold, uFoamThreshold + 0.2, vElevation);

    // Add noise to foam for natural look
    float foamNoise = fbm(vWorldPosition.xz * 5.0 + uTime * 0.5, 3);
    foamFactor *= foamNoise;
    foamFactor = clamp(foamFactor * uFoamIntensity, 0.0, 1.0);

    // Foam is white with some transparency
    vec3 foamColor = mix(waterColor, uWaterColorFoam, foamFactor);

    // ==========================================
    // Caustic Patterns (underwater light)
    // ==========================================

    float causticPattern = caustic(vWorldPosition.xz * 0.1, uTime);

    // Caustics more visible in shallow water
    float causticStrength = causticPattern * uCausticIntensity * depthFactor;
    vec3 caustics = vec3(0.5, 0.7, 1.0) * causticStrength;

    // ==========================================
    // Combine All Effects
    // ==========================================

    vec3 finalColor = foamColor;

    // Add subsurface scattering
    finalColor += subsurface;

    // Add caustics
    finalColor += caustics * 0.2;

    // Add specular highlights
    finalColor += specular;

    // ==========================================
    // Ambient Occlusion (wave troughs darker)
    // ==========================================

    float ao = smoothstep(-0.5, 0.2, vElevation) * 0.3 + 0.7;
    finalColor *= ao;

    // ==========================================
    // Rim Lighting (subtle glow at edges)
    // ==========================================

    float rim = 1.0 - max(dot(viewDirection, normal), 0.0);
    rim = pow(rim, 4.0) * 0.15;
    finalColor += uLightColor * rim;

    // ==========================================
    // Final Output
    // ==========================================

    // HDR tonemapping (simple Reinhard)
    finalColor = finalColor / (finalColor + vec3(1.0));

    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    // Alpha based on foam (foam is more opaque)
    float alpha = mix(uOpacity, 0.95, foamFactor);

    fragColor = vec4(finalColor, alpha);
}
