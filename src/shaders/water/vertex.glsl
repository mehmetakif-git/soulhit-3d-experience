/**
 * Gerstner Waves Water Surface - Vertex Shader (GLSL 300 ES)
 *
 * Implements realistic ocean wave displacement using Gerstner wave algorithm.
 * Multiple wave layers create complex, natural-looking water movement.
 *
 * Gerstner Wave Equation:
 * - Horizontal displacement: x' = x + (A/k) * D.x * cos(k * (D.x*x + D.y*z) - w*t)
 * - Vertical displacement: y' = A * sin(k * (D.x*x + D.y*z) - w*t)
 * - Where k = 2*PI/wavelength, w = sqrt(g*k), A = amplitude, D = direction
 */

precision highp float;

// Vertex attributes
in vec3 position;
in vec2 uv;
in vec3 normal;

// Transform matrices (provided by Three.js)
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

// Time uniform
uniform float uTime;

// Wave parameters (4 waves for complex motion)
uniform vec2 uWaveDirection1;
uniform vec2 uWaveDirection2;
uniform vec2 uWaveDirection3;
uniform vec2 uWaveDirection4;

uniform float uWaveAmplitude1;
uniform float uWaveAmplitude2;
uniform float uWaveAmplitude3;
uniform float uWaveAmplitude4;

uniform float uWaveFrequency1;
uniform float uWaveFrequency2;
uniform float uWaveFrequency3;
uniform float uWaveFrequency4;

uniform float uWaveSpeed1;
uniform float uWaveSpeed2;
uniform float uWaveSpeed3;
uniform float uWaveSpeed4;

// Steepness parameter (0-1, higher = sharper peaks)
uniform float uSteepness;

// Output to fragment shader
out vec2 vUv;
out vec3 vWorldPosition;
out vec3 vNormal;
out float vElevation;
out vec3 vTangent;
out vec3 vBinormal;

// Constants
const float PI = 3.14159265359;
const float GRAVITY = 9.8;

/**
 * Gerstner Wave Calculation
 *
 * @param position - Vertex position (xz plane)
 * @param direction - Wave direction (normalized)
 * @param amplitude - Wave height
 * @param wavelength - Distance between wave peaks
 * @param speed - Wave movement speed multiplier
 * @param time - Current time
 * @param steepness - Wave steepness (0-1)
 *
 * @returns vec3 displacement to add to vertex
 */
vec3 gerstnerWave(
    vec3 pos,
    vec2 direction,
    float amplitude,
    float wavelength,
    float speed,
    float time,
    float steepness,
    inout vec3 tangent,
    inout vec3 binormal
) {
    // Wave number k = 2*PI / wavelength
    float k = 2.0 * PI / wavelength;

    // Angular frequency w = sqrt(g * k) for deep water
    float w = sqrt(GRAVITY * k);

    // Normalized direction
    vec2 d = normalize(direction);

    // Phase: k * (D dot P) - w * t * speed
    float phase = k * (d.x * pos.x + d.y * pos.z) - w * time * speed;

    // Steepness factor (Q in Gerstner formula)
    // Q = steepness / (k * A * numWaves) to prevent looping
    float Q = steepness / (k * amplitude * 4.0);

    // Gerstner displacement
    float cosPhase = cos(phase);
    float sinPhase = sin(phase);

    // Horizontal displacement (creates the characteristic circular motion)
    float xDisplacement = Q * amplitude * d.x * cosPhase;
    float zDisplacement = Q * amplitude * d.y * cosPhase;

    // Vertical displacement
    float yDisplacement = amplitude * sinPhase;

    // Compute partial derivatives for normal calculation
    // These accumulate across all waves

    // Tangent partial derivatives (along x)
    tangent += vec3(
        -Q * d.x * d.x * k * amplitude * sinPhase,
        d.x * k * amplitude * cosPhase,
        -Q * d.x * d.y * k * amplitude * sinPhase
    );

    // Binormal partial derivatives (along z)
    binormal += vec3(
        -Q * d.x * d.y * k * amplitude * sinPhase,
        d.y * k * amplitude * cosPhase,
        -Q * d.y * d.y * k * amplitude * sinPhase
    );

    return vec3(xDisplacement, yDisplacement, zDisplacement);
}

void main() {
    vUv = uv;

    // Start with original position
    vec3 pos = position;

    // Initialize tangent and binormal for normal calculation
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    // Apply all 4 Gerstner waves
    pos += gerstnerWave(
        position, uWaveDirection1, uWaveAmplitude1, uWaveFrequency1,
        uWaveSpeed1, uTime, uSteepness, tangent, binormal
    );

    pos += gerstnerWave(
        position, uWaveDirection2, uWaveAmplitude2, uWaveFrequency2,
        uWaveSpeed2, uTime, uSteepness, tangent, binormal
    );

    pos += gerstnerWave(
        position, uWaveDirection3, uWaveAmplitude3, uWaveFrequency3,
        uWaveSpeed3, uTime, uSteepness, tangent, binormal
    );

    pos += gerstnerWave(
        position, uWaveDirection4, uWaveAmplitude4, uWaveFrequency4,
        uWaveSpeed4, uTime, uSteepness, tangent, binormal
    );

    // Calculate normal from tangent and binormal (cross product)
    vec3 calculatedNormal = normalize(cross(binormal, tangent));

    // Pass to fragment shader
    vNormal = normalize(normalMatrix * calculatedNormal);
    vTangent = normalize(normalMatrix * tangent);
    vBinormal = normalize(normalMatrix * binormal);
    vElevation = pos.y;

    // Transform to world space
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;

    // Final position
    vec4 viewPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * viewPosition;
}
