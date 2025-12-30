/**
 * Glassmorphic Card - Vertex Shader
 * Advanced Surface Calculation for Glass Effects
 *
 * Features:
 * - Screen-space UV calculation for background sampling
 * - Smooth surface animation
 * - Hover state transformation
 * - Mouse-based parallax rotation
 */

// ==========================================
// Uniforms
// ==========================================

uniform float uTime;
uniform float uHover;           // 0-1 hover transition
uniform vec2 uMouse;            // Mouse position (-1 to 1)
uniform float uParallaxStrength;

// ==========================================
// Varyings (passed to fragment shader)
// ==========================================

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec4 vScreenPosition;   // For background texture sampling
varying float vFresnel;

void main() {
    // ==========================================
    // UV Coordinates
    // ==========================================

    vUv = uv;

    // ==========================================
    // Normal Calculation
    // ==========================================

    // View-space normal for fresnel
    vNormal = normalize(normalMatrix * normal);

    // World-space normal for refraction
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    // ==========================================
    // Hover Animation
    // ==========================================

    vec3 animatedPosition = position;

    // Scale up slightly on hover
    float hoverScale = 1.0 + uHover * 0.05;
    animatedPosition *= hoverScale;

    // Subtle breathing animation
    float breathe = sin(uTime * 2.0) * 0.003;
    animatedPosition.z += breathe;

    // ==========================================
    // Mouse Parallax Rotation
    // ==========================================

    // Rotate based on mouse position (subtle parallax)
    float rotateX = uMouse.y * uParallaxStrength * 0.1;
    float rotateY = uMouse.x * uParallaxStrength * 0.1;

    // Apply rotation around center
    mat3 rotationX = mat3(
        1.0, 0.0, 0.0,
        0.0, cos(rotateX), -sin(rotateX),
        0.0, sin(rotateX), cos(rotateX)
    );

    mat3 rotationY = mat3(
        cos(rotateY), 0.0, sin(rotateY),
        0.0, 1.0, 0.0,
        -sin(rotateY), 0.0, cos(rotateY)
    );

    animatedPosition = rotationY * rotationX * animatedPosition;

    // ==========================================
    // Surface Ripple (subtle)
    // ==========================================

    float ripple = sin(uTime * 1.5 + position.x * 3.0 + position.y * 2.0) * 0.002;
    animatedPosition.z += ripple * (1.0 + uHover * 0.5);

    // ==========================================
    // Transform Pipeline
    // ==========================================

    // World position
    vec4 worldPosition = modelMatrix * vec4(animatedPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    vPosition = animatedPosition;

    // View position (camera space)
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;

    // Clip position
    vec4 clipPosition = projectionMatrix * viewPosition;
    gl_Position = clipPosition;

    // ==========================================
    // Screen Position (for background sampling)
    // ==========================================

    // Convert clip space to screen UV (0-1)
    vScreenPosition = clipPosition;

    // ==========================================
    // Pre-calculate Fresnel
    // ==========================================

    vec3 viewDir = normalize(-vViewPosition);
    vFresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
}
