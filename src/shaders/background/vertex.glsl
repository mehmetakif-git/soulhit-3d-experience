/**
 * Gradient Background - Vertex Shader
 * Full-screen quad for background rendering
 */

varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
