/**
 * GPU Particle System - Position Compute Shader
 *
 * This shader runs on the GPU and updates particle positions each frame.
 * It reads from a texture where each pixel represents one particle:
 * - RGB channels store XYZ position
 * - Alpha channel stores lifetime (0-1, resets when expired)
 *
 * FBO (Frame Buffer Object) Explanation:
 * Instead of updating particles on CPU (slow for 50k+ particles),
 * we use the GPU. Each particle's data is stored as a pixel in a texture.
 * The compute shader reads the previous frame's texture and writes
 * updated values to a new texture. This ping-pong technique allows
 * massively parallel particle updates.
 */

precision highp float;
precision highp sampler2D;

// Position texture from previous frame
uniform sampler2D texturePosition;
// Velocity texture (computed in velocity shader)
uniform sampler2D textureVelocity;

// Time uniforms
uniform float uTime;
uniform float uDeltaTime;

// Simulation bounds
uniform float uBoundsRadius;

// Particle lifetime settings
uniform float uLifetimeMin;
uniform float uLifetimeMax;

// ==========================================
// Random Functions
// ==========================================

/**
 * Hash function for pseudo-random number generation
 * Converts 2D coordinates to a seemingly random value
 */
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/**
 * 3D hash for position randomization
 */
vec3 hash3(vec2 p) {
    vec3 q = vec3(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3)),
        dot(p, vec2(419.2, 371.9))
    );
    return fract(sin(q) * 43758.5453);
}

/**
 * Generate random position within a sphere
 */
vec3 randomSpherePosition(vec2 seed, float radius) {
    vec3 rand = hash3(seed);

    // Spherical coordinates
    float theta = rand.x * 6.28318530718; // 2 * PI
    float phi = acos(2.0 * rand.y - 1.0);
    float r = radius * pow(rand.z, 0.333333); // Cube root for uniform distribution

    return vec3(
        r * sin(phi) * cos(theta),
        r * sin(phi) * sin(theta),
        r * cos(phi)
    );
}

// ==========================================
// Main Computation
// ==========================================

void main() {
    // Get UV coordinates for this particle
    // gl_FragCoord contains pixel coordinates
    // resolution is provided by GPUComputationRenderer
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read current position and lifetime from texture
    // Each pixel = one particle
    vec4 posData = texture2D(texturePosition, uv);
    vec3 position = posData.xyz;
    float lifetime = posData.w;

    // Read velocity for this particle
    vec3 velocity = texture2D(textureVelocity, uv).xyz;

    // ==========================================
    // Lifetime Management
    // ==========================================

    // Decrease lifetime
    float lifetimeRange = uLifetimeMax - uLifetimeMin;
    float normalizedLifetime = lifetime;

    // Calculate lifetime decay rate (particles live 3-8 seconds)
    float decayRate = uDeltaTime / mix(uLifetimeMin, uLifetimeMax, hash(uv));
    normalizedLifetime -= decayRate;

    // ==========================================
    // Position Update
    // ==========================================

    // Apply velocity to position
    // Scale by deltaTime for frame-rate independence
    vec3 newPosition = position + velocity * uDeltaTime;

    // ==========================================
    // Particle Reset (when lifetime expires or out of bounds)
    // ==========================================

    float distanceFromCenter = length(newPosition);
    bool shouldReset = normalizedLifetime <= 0.0 || distanceFromCenter > uBoundsRadius * 1.5;

    if (shouldReset) {
        // Reset to random position within spawn sphere
        vec2 resetSeed = uv + vec2(uTime * 0.1, uTime * 0.17);
        newPosition = randomSpherePosition(resetSeed, uBoundsRadius * 0.3);

        // Reset lifetime
        normalizedLifetime = 1.0;
    }

    // ==========================================
    // Output
    // ==========================================

    // Write new position (xyz) and lifetime (w) to texture
    gl_FragColor = vec4(newPosition, normalizedLifetime);
}
