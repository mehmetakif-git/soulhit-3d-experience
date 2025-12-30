/**
 * ChromaticAberrationPass.js
 * Custom Post-Processing Pass for Chromatic Aberration
 *
 * Features:
 * - RGB channel offset/separation
 * - Radial distortion from center
 * - Configurable intensity
 * - Direction control
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Chromatic Aberration Vertex Shader
 * Simple fullscreen quad shader
 */
const ChromaticAberrationVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Chromatic Aberration Fragment Shader
 * Separates RGB channels with offset based on distance from center
 */
const ChromaticAberrationFragmentShader = `
precision highp float;

uniform sampler2D tDiffuse;
uniform float uIntensity;
uniform float uRadialIntensity;
uniform vec2 uDirection;
uniform vec2 uCenter;
uniform float uTime;
uniform bool uAnimated;

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec2 center = uCenter;

    // ==========================================
    // Calculate Radial Distance
    // ==========================================

    vec2 toCenter = uv - center;
    float dist = length(toCenter);

    // Radial intensity falloff (stronger at edges)
    float radialFactor = dist * dist * uRadialIntensity;

    // ==========================================
    // Animated Offset (optional)
    // ==========================================

    vec2 direction = uDirection;
    if (uAnimated) {
        float animOffset = sin(uTime * 2.0) * 0.3;
        direction += vec2(animOffset * 0.1, animOffset * 0.05);
    }

    // ==========================================
    // Calculate Channel Offsets
    // ==========================================

    // Base offset from intensity
    float baseOffset = uIntensity;

    // Add radial component
    float totalOffset = baseOffset + radialFactor;

    // Direction-based offset
    vec2 redOffset = direction * totalOffset;
    vec2 greenOffset = vec2(0.0); // Green stays centered
    vec2 blueOffset = -direction * totalOffset;

    // Add radial component to offset
    vec2 radialOffset = normalize(toCenter + 0.001) * radialFactor * 0.5;
    redOffset += radialOffset;
    blueOffset -= radialOffset;

    // ==========================================
    // Sample Each Channel
    // ==========================================

    float r = texture2D(tDiffuse, uv + redOffset).r;
    float g = texture2D(tDiffuse, uv + greenOffset).g;
    float b = texture2D(tDiffuse, uv + blueOffset).b;

    // Get alpha from center sample
    float a = texture2D(tDiffuse, uv).a;

    // ==========================================
    // Subtle Barrel Distortion (optional)
    // ==========================================

    // Add slight lens distortion effect
    float barrelStrength = 0.02 * uIntensity * 10.0;
    vec2 distortedUV = uv + toCenter * dist * dist * barrelStrength;

    // Blend with distorted sample
    vec3 distortedColor = texture2D(tDiffuse, distortedUV).rgb;
    vec3 aberratedColor = vec3(r, g, b);

    vec3 finalColor = mix(aberratedColor, distortedColor, 0.1);

    // ==========================================
    // Output
    // ==========================================

    gl_FragColor = vec4(finalColor, a);
}
`;

/**
 * @class ChromaticAberrationPass
 * @extends Pass
 * @description Custom post-processing pass for chromatic aberration effect
 */
class ChromaticAberrationPass extends Pass {
    /**
     * Create chromatic aberration pass
     * @param {Object} options - Pass options
     */
    constructor(options = {}) {
        super();

        const {
            intensity = 0.003,
            radialIntensity = 0.5,
            direction = new THREE.Vector2(1.0, 0.5),
            center = new THREE.Vector2(0.5, 0.5),
            animated = false
        } = options;

        this.uniforms = {
            tDiffuse: { value: null },
            uIntensity: { value: intensity },
            uRadialIntensity: { value: radialIntensity },
            uDirection: { value: direction.clone().normalize() },
            uCenter: { value: center },
            uTime: { value: 0 },
            uAnimated: { value: animated }
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: ChromaticAberrationVertexShader,
            fragmentShader: ChromaticAberrationFragmentShader,
            depthTest: false,
            depthWrite: false
        });

        this.fsQuad = new FullScreenQuad(this.material);

        // Store for external access
        this.intensity = intensity;
        this.radialIntensity = radialIntensity;
    }

    /**
     * Set chromatic aberration intensity
     * @param {number} value - Intensity value (0.001-0.01 recommended)
     */
    setIntensity(value) {
        this.intensity = value;
        this.uniforms.uIntensity.value = value;
    }

    /**
     * Set radial intensity
     * @param {number} value - Radial intensity (0-2)
     */
    setRadialIntensity(value) {
        this.radialIntensity = value;
        this.uniforms.uRadialIntensity.value = value;
    }

    /**
     * Set aberration direction
     * @param {number} x
     * @param {number} y
     */
    setDirection(x, y) {
        this.uniforms.uDirection.value.set(x, y).normalize();
    }

    /**
     * Set center point for radial effect
     * @param {number} x - X coordinate (0-1)
     * @param {number} y - Y coordinate (0-1)
     */
    setCenter(x, y) {
        this.uniforms.uCenter.value.set(x, y);
    }

    /**
     * Enable/disable animation
     * @param {boolean} enabled
     */
    setAnimated(enabled) {
        this.uniforms.uAnimated.value = enabled;
    }

    /**
     * Render the pass
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.WebGLRenderTarget} writeBuffer
     * @param {THREE.WebGLRenderTarget} readBuffer
     * @param {number} deltaTime
     * @param {boolean} maskActive
     */
    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        // Update time uniform
        this.uniforms.uTime.value += deltaTime;

        // Set input texture
        this.uniforms.tDiffuse.value = readBuffer.texture;

        // Render to output
        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear) renderer.clear();
        }

        this.fsQuad.render(renderer);
    }

    /**
     * Dispose resources
     */
    dispose() {
        this.material.dispose();
        this.fsQuad.dispose();
    }
}

export { ChromaticAberrationPass };
export default ChromaticAberrationPass;
