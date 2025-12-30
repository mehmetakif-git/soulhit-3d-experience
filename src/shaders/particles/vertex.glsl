/**
 * GPU Particle System - Render Vertex Shader (GLSL 300 ES)
 *
 * This shader reads particle positions from FBO texture and renders them.
 *
 * Key Concept - FBO Texture Lookup:
 * The particle positions are stored in a texture computed by the GPU.
 * Each particle has a UV coordinate that maps to its data in the texture.
 * We sample the texture to get the position, then transform to screen space.
 *
 * The 'reference' attribute contains the UV coordinates for each particle
 * to look up its position in the FBO texture.
 */

precision highp float;
precision highp sampler2D;

// FBO texture containing particle positions (xyz) and lifetime (w)
uniform sampler2D texturePosition;

// Rendering parameters
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;

// Camera distance for size calculations
uniform float uCameraDistance;

// Particle appearance
uniform float uSizeVariation;
uniform float uAlphaVariation;

// Attribute: UV coordinates to sample particle's position from FBO
// This is set per-vertex and maps each vertex to a pixel in the FBO texture
in vec2 reference;

// Varyings to pass to fragment shader
out float vLifetime;
out float vAlpha;
out float vDistance;
out vec2 vReference;

// ==========================================
// Hash function for per-particle variation
// ==========================================
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    // ==========================================
    // Sample Position from FBO Texture
    // ==========================================

    // Each particle looks up its position using its unique UV coordinate
    vec4 positionData = texture(texturePosition, reference);

    // Extract position (xyz) and lifetime (w)
    vec3 particlePosition = positionData.xyz;
    float lifetime = positionData.w;

    // Pass to fragment shader
    vLifetime = lifetime;
    vReference = reference;

    // ==========================================
    // Per-Particle Variation
    // ==========================================

    // Use reference UV as seed for deterministic randomness
    float particleRandom = hash(reference);
    float particleRandom2 = hash(reference + vec2(0.5));

    // ==========================================
    // Transform to Screen Space
    // ==========================================

    vec4 modelPosition = modelMatrix * vec4(particlePosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    // ==========================================
    // Calculate Distance for Attenuation
    // ==========================================

    vDistance = -viewPosition.z;
    float distanceAttenuation = uCameraDistance / max(vDistance, 0.1);

    // ==========================================
    // Point Size Calculation
    // ==========================================

    // Base size with variation
    float sizeMultiplier = 1.0 + (particleRandom - 0.5) * uSizeVariation;

    // Lifetime-based size (fade in/out)
    float lifetimeSize = 1.0;
    // Fade in during first 15% of life
    lifetimeSize *= smoothstep(0.0, 0.15, lifetime);
    // Fade out during last 20% of life
    lifetimeSize *= smoothstep(0.0, 0.2, lifetime);

    // Subtle pulsing based on time and particle ID
    float pulse = 1.0 + sin(uTime * 3.0 + particleRandom * 6.28) * 0.1;

    // Final point size
    float finalSize = uSize * sizeMultiplier * lifetimeSize * pulse * distanceAttenuation * uPixelRatio;

    // Clamp to reasonable range
    gl_PointSize = clamp(finalSize, 1.0, 128.0);

    // ==========================================
    // Alpha Calculation
    // ==========================================

    // Base alpha with variation
    float baseAlpha = 0.8 + particleRandom2 * uAlphaVariation;

    // Lifetime fade:
    // - Fade IN when lifetime goes from 1.0 to 0.85 (new particles)
    // - Fade OUT when lifetime goes from 0.2 to 0.0 (dying particles)
    float fadeIn = 1.0 - smoothstep(0.85, 1.0, lifetime);
    float fadeOut = smoothstep(0.0, 0.2, lifetime);
    float lifetimeAlpha = fadeIn * fadeOut;

    // Distance fade (far particles fade out)
    float distanceFade = smoothstep(30.0, 10.0, vDistance);

    vAlpha = baseAlpha * lifetimeAlpha * distanceFade;
}
