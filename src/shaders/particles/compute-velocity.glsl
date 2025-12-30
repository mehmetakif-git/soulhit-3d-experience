/**
 * GPU Particle System - Velocity Compute Shader
 *
 * This shader calculates forces acting on each particle:
 * - Flow field using curl noise (creates fluid-like motion)
 * - Mouse attraction/repulsion
 * - Turbulence for organic movement
 * - Damping for smooth deceleration
 *
 * Curl Noise Explanation:
 * Regular noise creates converging/diverging flows (particles bunch up).
 * Curl noise takes the "curl" (rotation) of a noise field, creating
 * divergence-free flow - particles swirl but don't compress.
 * This mimics fluid dynamics and looks much more natural.
 */

precision highp float;
precision highp sampler2D;

// Textures from previous frame
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

// Time
uniform float uTime;
uniform float uDeltaTime;

// Flow field settings
uniform float uFlowFieldScale;     // Size of noise features
uniform float uFlowFieldSpeed;     // Animation speed
uniform float uFlowFieldStrength;  // Force magnitude

// Mouse interaction
uniform vec3 uMousePosition;       // Mouse position in 3D space
uniform float uMouseRadius;        // Influence radius
uniform float uMouseStrength;      // Attraction strength (negative = repel)

// Physics
uniform float uDamping;            // Velocity damping (0-1)
uniform float uTurbulence;         // Random force strength
uniform float uMaxVelocity;        // Speed limit

// ==========================================
// 3D Simplex Noise
// ==========================================

/**
 * Simplex noise produces smooth, natural-looking gradients
 * Much faster than Perlin noise for 3D
 */

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

/**
 * 3D Simplex Noise
 * Returns value in range [-1, 1]
 */
float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients
    float n_ = 0.142857142857; // 1.0/7.0
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix contributions
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ==========================================
// Curl Noise
// ==========================================

/**
 * Curl Noise - Creates divergence-free flow field
 *
 * The curl of a vector field F is:
 * curl(F) = (dFz/dy - dFy/dz, dFx/dz - dFz/dx, dFy/dx - dFx/dy)
 *
 * We compute this by sampling the noise at offset positions
 * and calculating partial derivatives numerically.
 */
vec3 curlNoise(vec3 p) {
    const float epsilon = 0.0001;
    vec3 curl;

    // Sample noise at offset positions
    float n1, n2;

    // Partial derivatives for x component
    n1 = snoise(p + vec3(0.0, epsilon, 0.0));
    n2 = snoise(p - vec3(0.0, epsilon, 0.0));
    float a = (n1 - n2) / (2.0 * epsilon);

    n1 = snoise(p + vec3(0.0, 0.0, epsilon));
    n2 = snoise(p - vec3(0.0, 0.0, epsilon));
    float b = (n1 - n2) / (2.0 * epsilon);

    curl.x = a - b;

    // Partial derivatives for y component
    n1 = snoise(p + vec3(0.0, 0.0, epsilon));
    n2 = snoise(p - vec3(0.0, 0.0, epsilon));
    a = (n1 - n2) / (2.0 * epsilon);

    n1 = snoise(p + vec3(epsilon, 0.0, 0.0));
    n2 = snoise(p - vec3(epsilon, 0.0, 0.0));
    b = (n1 - n2) / (2.0 * epsilon);

    curl.y = a - b;

    // Partial derivatives for z component
    n1 = snoise(p + vec3(epsilon, 0.0, 0.0));
    n2 = snoise(p - vec3(epsilon, 0.0, 0.0));
    a = (n1 - n2) / (2.0 * epsilon);

    n1 = snoise(p + vec3(0.0, epsilon, 0.0));
    n2 = snoise(p - vec3(0.0, epsilon, 0.0));
    b = (n1 - n2) / (2.0 * epsilon);

    curl.z = a - b;

    return curl;
}

/**
 * Fractal Brownian Motion Curl Noise
 * Adds multiple octaves for more detail
 */
vec3 fbmCurlNoise(vec3 p, int octaves, float lacunarity, float gain) {
    vec3 sum = vec3(0.0);
    float amplitude = 1.0;
    float frequency = 1.0;
    float maxValue = 0.0;

    for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;
        sum += curlNoise(p * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }

    return sum / maxValue;
}

// ==========================================
// Random Hash
// ==========================================

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 hash3(vec2 p) {
    vec3 q = vec3(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3)),
        dot(p, vec2(419.2, 371.9))
    );
    return fract(sin(q) * 43758.5453) * 2.0 - 1.0;
}

// ==========================================
// Main Computation
// ==========================================

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read current state
    vec4 posData = texture2D(texturePosition, uv);
    vec3 position = posData.xyz;
    float lifetime = posData.w;

    vec3 velocity = texture2D(textureVelocity, uv).xyz;

    // ==========================================
    // Force Accumulation
    // ==========================================

    vec3 force = vec3(0.0);

    // ==========================================
    // 1. Flow Field Force (Curl Noise)
    // ==========================================

    // Animate the flow field over time
    vec3 flowFieldPos = position * uFlowFieldScale + vec3(uTime * uFlowFieldSpeed);

    // Use FBM curl noise for complex, multi-scale flow
    vec3 flowForce = fbmCurlNoise(flowFieldPos, 3, 2.0, 0.5);

    force += flowForce * uFlowFieldStrength;

    // ==========================================
    // 2. Mouse Interaction
    // ==========================================

    vec3 toMouse = uMousePosition - position;
    float distToMouse = length(toMouse);

    if (distToMouse < uMouseRadius && distToMouse > 0.001) {
        // Normalize direction
        vec3 mouseDir = toMouse / distToMouse;

        // Smooth falloff based on distance
        float influence = 1.0 - smoothstep(0.0, uMouseRadius, distToMouse);
        influence = pow(influence, 2.0); // Quadratic falloff

        // Apply attraction/repulsion force
        force += mouseDir * uMouseStrength * influence;
    }

    // ==========================================
    // 3. Turbulence (High-frequency noise)
    // ==========================================

    vec3 turbulencePos = position * 3.0 + vec3(uTime * 2.0);
    vec3 turbulenceForce = vec3(
        snoise(turbulencePos),
        snoise(turbulencePos + vec3(100.0)),
        snoise(turbulencePos + vec3(200.0))
    );

    force += turbulenceForce * uTurbulence;

    // ==========================================
    // 4. Subtle center attraction (keeps particles bounded)
    // ==========================================

    float distFromCenter = length(position);
    if (distFromCenter > 5.0) {
        vec3 toCenter = -normalize(position);
        float pullStrength = smoothstep(5.0, 15.0, distFromCenter) * 0.5;
        force += toCenter * pullStrength;
    }

    // ==========================================
    // Velocity Integration
    // ==========================================

    // Apply forces to velocity
    vec3 newVelocity = velocity + force * uDeltaTime;

    // Apply damping (simulates air resistance)
    newVelocity *= (1.0 - uDamping * uDeltaTime);

    // Clamp velocity to maximum speed
    float speed = length(newVelocity);
    if (speed > uMaxVelocity) {
        newVelocity = (newVelocity / speed) * uMaxVelocity;
    }

    // ==========================================
    // Reset velocity for new particles
    // ==========================================

    if (lifetime <= 0.01) {
        // Small random initial velocity for newly spawned particles
        newVelocity = hash3(uv + vec2(uTime)) * 0.5;
    }

    // ==========================================
    // Output
    // ==========================================

    gl_FragColor = vec4(newVelocity, 1.0);
}
