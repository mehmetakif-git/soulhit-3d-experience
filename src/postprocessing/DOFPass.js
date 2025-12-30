/**
 * DOFPass.js
 * Custom Post-Processing Pass for Depth of Field
 *
 * Features:
 * - Bokeh-style blur for out-of-focus areas
 * - Configurable focus distance
 * - Aperture control (blur amount)
 * - Depth-based focus falloff
 * - Hexagonal bokeh shape option
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * DOF Vertex Shader
 * Simple fullscreen quad
 */
const DOFVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * DOF Fragment Shader
 * Implements bokeh-style depth of field blur
 */
const DOFFragmentShader = `
precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float uFocus;          // Focus distance (0-1 in depth space)
uniform float uAperture;       // Blur amount
uniform float uMaxBlur;        // Maximum blur radius
uniform float uNear;           // Camera near plane
uniform float uFar;            // Camera far plane
uniform vec2 uResolution;
uniform float uBokehScale;     // Bokeh size multiplier
uniform bool uHexagonal;       // Use hexagonal bokeh shape
uniform float uFocusRange;     // Range around focus that stays sharp
uniform float uTime;

varying vec2 vUv;

// ==========================================
// Constants
// ==========================================

const float PI = 3.14159265359;
const int SAMPLES = 32;         // Number of blur samples
const float GOLDEN_ANGLE = 2.39996323;

// ==========================================
// Utility Functions
// ==========================================

// Linearize depth from depth buffer
float linearizeDepth(float depth) {
    float z = depth * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

// Get depth at UV
float getDepth(vec2 uv) {
    return texture2D(tDepth, uv).r;
}

// Calculate circle of confusion (blur amount based on depth)
float getCoC(float depth) {
    float linearDepth = linearizeDepth(depth);
    float focusDepth = linearizeDepth(uFocus);

    // Distance from focus plane
    float focusDiff = abs(linearDepth - focusDepth);

    // Smooth falloff within focus range
    float cocFactor = smoothstep(0.0, uFocusRange, focusDiff);

    // Scale by aperture
    return cocFactor * uAperture;
}

// Hexagonal bokeh shape
float hexagonalWeight(vec2 offset) {
    vec2 absOffset = abs(offset);
    float hex = max(absOffset.x * 0.866025 + absOffset.y * 0.5, absOffset.y);
    return smoothstep(1.0, 0.9, hex * 2.0);
}

// ==========================================
// Bokeh Blur
// ==========================================

vec3 bokehBlur(vec2 uv, float coc) {
    vec3 color = vec3(0.0);
    float totalWeight = 0.0;

    // Pixel size for offsets
    vec2 pixelSize = 1.0 / uResolution;

    // Maximum blur radius in pixels
    float maxRadius = uMaxBlur * uBokehScale;
    float radius = coc * maxRadius;

    // Early exit for minimal blur
    if (radius < 0.5) {
        return texture2D(tDiffuse, uv).rgb;
    }

    // ==========================================
    // Golden Angle Spiral Sampling
    // ==========================================

    for (int i = 0; i < SAMPLES; i++) {
        // Spiral pattern using golden angle
        float angle = float(i) * GOLDEN_ANGLE;
        float r = sqrt(float(i) / float(SAMPLES)) * radius;

        vec2 offset;
        offset.x = cos(angle) * r * pixelSize.x;
        offset.y = sin(angle) * r * pixelSize.y;

        // Sample position
        vec2 sampleUV = uv + offset;

        // Check bounds
        if (sampleUV.x < 0.0 || sampleUV.x > 1.0 ||
            sampleUV.y < 0.0 || sampleUV.y > 1.0) {
            continue;
        }

        // Sample color
        vec3 sampleColor = texture2D(tDiffuse, sampleUV).rgb;

        // Calculate weight
        float weight = 1.0;

        // Hexagonal bokeh shape (optional)
        if (uHexagonal && r > 0.0) {
            vec2 normalizedOffset = offset / (radius * pixelSize);
            weight *= hexagonalWeight(normalizedOffset);
        }

        // Depth-aware weighting
        float sampleDepth = getDepth(sampleUV);
        float sampleCoC = getCoC(sampleDepth);

        // Samples that are more in-focus should contribute less blur
        weight *= smoothstep(0.0, coc * 0.5, sampleCoC);

        // Highlight preservation (brighter samples get more weight)
        float luminance = dot(sampleColor, vec3(0.299, 0.587, 0.114));
        weight *= 1.0 + luminance * 0.5;

        color += sampleColor * weight;
        totalWeight += weight;
    }

    // Normalize
    if (totalWeight > 0.0) {
        color /= totalWeight;
    } else {
        color = texture2D(tDiffuse, uv).rgb;
    }

    return color;
}

// ==========================================
// Main
// ==========================================

void main() {
    vec2 uv = vUv;

    // Get depth at current pixel
    float depth = getDepth(uv);

    // Calculate circle of confusion
    float coc = getCoC(depth);

    // Apply bokeh blur
    vec3 blurredColor = bokehBlur(uv, coc);

    // Original color for comparison
    vec3 originalColor = texture2D(tDiffuse, uv).rgb;

    // Blend based on CoC
    float blendFactor = smoothstep(0.0, 0.1, coc);
    vec3 finalColor = mix(originalColor, blurredColor, blendFactor);

    // ==========================================
    // Debug Visualization (optional)
    // ==========================================

    // Uncomment to visualize depth or CoC:
    // finalColor = vec3(depth);
    // finalColor = vec3(coc);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * @class DOFPass
 * @extends Pass
 * @description Custom post-processing pass for depth of field bokeh effect
 */
class DOFPass extends Pass {
    /**
     * Create DOF pass
     * @param {THREE.Scene} scene - The scene
     * @param {THREE.Camera} camera - The camera
     * @param {Object} options - Pass options
     */
    constructor(scene, camera, options = {}) {
        super();

        this.scene = scene;
        this.camera = camera;

        const {
            focus = 0.5,
            aperture = 0.025,
            maxBlur = 0.02,
            bokehScale = 3.0,
            hexagonal = false,
            focusRange = 2.0,
            width = window.innerWidth,
            height = window.innerHeight
        } = options;

        // ==========================================
        // Create Depth Render Target
        // ==========================================

        this.depthTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            type: THREE.FloatType,
            depthBuffer: true,
            depthTexture: new THREE.DepthTexture()
        });

        this.depthTarget.depthTexture.format = THREE.DepthFormat;
        this.depthTarget.depthTexture.type = THREE.UnsignedIntType;

        // ==========================================
        // Setup Uniforms
        // ==========================================

        this.uniforms = {
            tDiffuse: { value: null },
            tDepth: { value: this.depthTarget.depthTexture },
            uFocus: { value: focus },
            uAperture: { value: aperture },
            uMaxBlur: { value: maxBlur },
            uNear: { value: camera.near },
            uFar: { value: camera.far },
            uResolution: { value: new THREE.Vector2(width, height) },
            uBokehScale: { value: bokehScale },
            uHexagonal: { value: hexagonal },
            uFocusRange: { value: focusRange },
            uTime: { value: 0 }
        };

        // ==========================================
        // Create Material
        // ==========================================

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: DOFVertexShader,
            fragmentShader: DOFFragmentShader,
            depthTest: false,
            depthWrite: false
        });

        this.fsQuad = new FullScreenQuad(this.material);

        // Store values for external access
        this.focus = focus;
        this.aperture = aperture;
        this.maxBlur = maxBlur;
    }

    /**
     * Set focus distance
     * @param {number} value - Focus distance (0-1 in normalized depth)
     */
    setFocus(value) {
        this.focus = value;
        this.uniforms.uFocus.value = value;
    }

    /**
     * Set aperture (blur amount)
     * @param {number} value - Aperture value (0.001-0.1 recommended)
     */
    setAperture(value) {
        this.aperture = value;
        this.uniforms.uAperture.value = value;
    }

    /**
     * Set maximum blur
     * @param {number} value - Max blur radius (0.01-0.1)
     */
    setMaxBlur(value) {
        this.maxBlur = value;
        this.uniforms.uMaxBlur.value = value;
    }

    /**
     * Set focus range
     * @param {number} value - Range around focus that stays sharp
     */
    setFocusRange(value) {
        this.uniforms.uFocusRange.value = value;
    }

    /**
     * Set bokeh shape
     * @param {boolean} hexagonal - Use hexagonal bokeh
     */
    setHexagonal(hexagonal) {
        this.uniforms.uHexagonal.value = hexagonal;
    }

    /**
     * Set bokeh scale
     * @param {number} scale - Bokeh size multiplier
     */
    setBokehScale(scale) {
        this.uniforms.uBokehScale.value = scale;
    }

    /**
     * Update camera parameters
     */
    updateCamera() {
        this.uniforms.uNear.value = this.camera.near;
        this.uniforms.uFar.value = this.camera.far;
    }

    /**
     * Handle resize
     * @param {number} width
     * @param {number} height
     */
    setSize(width, height) {
        this.depthTarget.setSize(width, height);
        this.uniforms.uResolution.value.set(width, height);
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
        // Update time
        this.uniforms.uTime.value += deltaTime;

        // ==========================================
        // Render Scene to Depth Target
        // ==========================================

        // Store current render target
        const currentRenderTarget = renderer.getRenderTarget();

        // Render scene to get depth
        renderer.setRenderTarget(this.depthTarget);
        renderer.render(this.scene, this.camera);

        // Restore render target
        renderer.setRenderTarget(currentRenderTarget);

        // ==========================================
        // Apply DOF Effect
        // ==========================================

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
        this.depthTarget.dispose();
        this.material.dispose();
        this.fsQuad.dispose();
    }
}

export { DOFPass };
export default DOFPass;
