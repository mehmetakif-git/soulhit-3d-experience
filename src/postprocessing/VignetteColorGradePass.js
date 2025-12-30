/**
 * VignetteColorGradePass.js
 * Combined Vignette and Color Grading Post-Processing
 *
 * Features:
 * - Smooth vignette effect
 * - Brightness/Contrast/Saturation
 * - Color tinting
 * - Gamma correction
 * - Film look presets
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Vignette + Color Grade Fragment Shader
 */
const VignetteColorGradeShader = {
    uniforms: {
        tDiffuse: { value: null },

        // Vignette
        uVignetteIntensity: { value: 0.4 },
        uVignetteRadius: { value: 0.8 },
        uVignetteSoftness: { value: 0.5 },
        uVignetteColor: { value: new THREE.Color(0x000000) },

        // Color Grading
        uBrightness: { value: 0.0 },
        uContrast: { value: 1.0 },
        uSaturation: { value: 1.0 },
        uGamma: { value: 1.0 },

        // Color Tint
        uTintColor: { value: new THREE.Color(0xffffff) },
        uTintIntensity: { value: 0.0 },

        // Lift/Gamma/Gain (color wheels)
        uLift: { value: new THREE.Color(0x000000) },
        uMidtones: { value: new THREE.Color(0x808080) },
        uGain: { value: new THREE.Color(0xffffff) },

        // Temperature/Tint
        uTemperature: { value: 0.0 },
        uTint: { value: 0.0 }
    },

    vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        precision highp float;

        uniform sampler2D tDiffuse;

        // Vignette uniforms
        uniform float uVignetteIntensity;
        uniform float uVignetteRadius;
        uniform float uVignetteSoftness;
        uniform vec3 uVignetteColor;

        // Color grading uniforms
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uGamma;

        // Tint
        uniform vec3 uTintColor;
        uniform float uTintIntensity;

        // Lift/Gamma/Gain
        uniform vec3 uLift;
        uniform vec3 uMidtones;
        uniform vec3 uGain;

        // Temperature/Tint
        uniform float uTemperature;
        uniform float uTint;

        varying vec2 vUv;

        // ==========================================
        // Color Functions
        // ==========================================

        vec3 adjustBrightness(vec3 color, float brightness) {
            return color + brightness;
        }

        vec3 adjustContrast(vec3 color, float contrast) {
            return (color - 0.5) * contrast + 0.5;
        }

        vec3 adjustSaturation(vec3 color, float saturation) {
            float luminance = dot(color, vec3(0.299, 0.587, 0.114));
            return mix(vec3(luminance), color, saturation);
        }

        vec3 adjustGamma(vec3 color, float gamma) {
            return pow(max(color, vec3(0.0)), vec3(1.0 / gamma));
        }

        // Temperature adjustment (simple approximation)
        vec3 adjustTemperature(vec3 color, float temperature) {
            // Positive = warmer (more red/yellow)
            // Negative = cooler (more blue)
            color.r += temperature * 0.1;
            color.b -= temperature * 0.1;
            return color;
        }

        // Tint adjustment (green/magenta)
        vec3 adjustTintGM(vec3 color, float tint) {
            color.g += tint * 0.1;
            return color;
        }

        // Lift/Gamma/Gain color grading
        vec3 liftGammaGain(vec3 color, vec3 lift, vec3 midtones, vec3 gain) {
            // Lift affects shadows
            color = color * (1.5 - 0.5 * lift) + 0.5 * lift - 0.5;

            // Midtones affect... midtones
            color = pow(max(color, vec3(0.0)), 1.0 / (1.5 - midtones + 0.5));

            // Gain affects highlights
            color = color * gain;

            return color;
        }

        // ==========================================
        // Vignette
        // ==========================================

        float vignette(vec2 uv, float intensity, float radius, float softness) {
            vec2 center = uv - 0.5;
            float dist = length(center);

            // Smooth vignette falloff
            float vig = smoothstep(radius, radius - softness, dist);

            return mix(1.0, vig, intensity);
        }

        // ==========================================
        // Main
        // ==========================================

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 color = texel.rgb;

            // ==========================================
            // Color Grading
            // ==========================================

            // Temperature and Tint
            color = adjustTemperature(color, uTemperature);
            color = adjustTintGM(color, uTint);

            // Brightness
            color = adjustBrightness(color, uBrightness);

            // Contrast
            color = adjustContrast(color, uContrast);

            // Saturation
            color = adjustSaturation(color, uSaturation);

            // Gamma
            color = adjustGamma(color, uGamma);

            // Color tint overlay
            color = mix(color, color * uTintColor, uTintIntensity);

            // ==========================================
            // Vignette
            // ==========================================

            float vig = vignette(vUv, uVignetteIntensity, uVignetteRadius, uVignetteSoftness);
            color = mix(uVignetteColor, color, vig);

            // ==========================================
            // Output
            // ==========================================

            // Clamp to valid range
            color = clamp(color, 0.0, 1.0);

            gl_FragColor = vec4(color, texel.a);
        }
    `
};

/**
 * Color grading presets
 */
const ColorGradePresets = {
    neutral: {
        brightness: 0,
        contrast: 1,
        saturation: 1,
        gamma: 1,
        temperature: 0,
        tint: 0,
        vignetteIntensity: 0.3
    },
    cinematic: {
        brightness: -0.05,
        contrast: 1.15,
        saturation: 0.9,
        gamma: 0.95,
        temperature: -0.1,
        tint: 0,
        vignetteIntensity: 0.5
    },
    warm: {
        brightness: 0.02,
        contrast: 1.05,
        saturation: 1.1,
        gamma: 1.0,
        temperature: 0.3,
        tint: 0.05,
        vignetteIntensity: 0.35
    },
    cold: {
        brightness: 0,
        contrast: 1.1,
        saturation: 0.85,
        gamma: 1.0,
        temperature: -0.3,
        tint: -0.05,
        vignetteIntensity: 0.4
    },
    vintage: {
        brightness: 0.05,
        contrast: 0.9,
        saturation: 0.7,
        gamma: 1.1,
        temperature: 0.2,
        tint: 0.1,
        vignetteIntensity: 0.6
    },
    scifi: {
        brightness: -0.02,
        contrast: 1.2,
        saturation: 1.15,
        gamma: 0.9,
        temperature: -0.15,
        tint: 0.1,
        vignetteIntensity: 0.45
    }
};

/**
 * @class VignetteColorGradePass
 * @extends Pass
 */
class VignetteColorGradePass extends Pass {
    /**
     * Create vignette and color grade pass
     * @param {Object} options
     */
    constructor(options = {}) {
        super();

        const {
            vignetteIntensity = 0.4,
            vignetteRadius = 0.8,
            vignetteSoftness = 0.5,
            vignetteColor = new THREE.Color(0x000000),
            brightness = 0,
            contrast = 1,
            saturation = 1,
            gamma = 1,
            tintColor = new THREE.Color(0xffffff),
            tintIntensity = 0,
            temperature = 0,
            tint = 0,
            preset = null
        } = options;

        // Clone shader
        this.uniforms = THREE.UniformsUtils.clone(VignetteColorGradeShader.uniforms);

        // Apply initial values
        this.uniforms.uVignetteIntensity.value = vignetteIntensity;
        this.uniforms.uVignetteRadius.value = vignetteRadius;
        this.uniforms.uVignetteSoftness.value = vignetteSoftness;
        this.uniforms.uVignetteColor.value = vignetteColor;
        this.uniforms.uBrightness.value = brightness;
        this.uniforms.uContrast.value = contrast;
        this.uniforms.uSaturation.value = saturation;
        this.uniforms.uGamma.value = gamma;
        this.uniforms.uTintColor.value = tintColor;
        this.uniforms.uTintIntensity.value = tintIntensity;
        this.uniforms.uTemperature.value = temperature;
        this.uniforms.uTint.value = tint;

        // Apply preset if specified
        if (preset && ColorGradePresets[preset]) {
            this.applyPreset(preset);
        }

        // Create material
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: VignetteColorGradeShader.vertexShader,
            fragmentShader: VignetteColorGradeShader.fragmentShader,
            depthTest: false,
            depthWrite: false
        });

        this.fsQuad = new FullScreenQuad(this.material);
    }

    /**
     * Apply a color grading preset
     * @param {string} presetName
     */
    applyPreset(presetName) {
        const preset = ColorGradePresets[presetName];
        if (!preset) {
            console.warn(`[VignetteColorGradePass] Unknown preset: ${presetName}`);
            return;
        }

        if (preset.brightness !== undefined) this.uniforms.uBrightness.value = preset.brightness;
        if (preset.contrast !== undefined) this.uniforms.uContrast.value = preset.contrast;
        if (preset.saturation !== undefined) this.uniforms.uSaturation.value = preset.saturation;
        if (preset.gamma !== undefined) this.uniforms.uGamma.value = preset.gamma;
        if (preset.temperature !== undefined) this.uniforms.uTemperature.value = preset.temperature;
        if (preset.tint !== undefined) this.uniforms.uTint.value = preset.tint;
        if (preset.vignetteIntensity !== undefined) this.uniforms.uVignetteIntensity.value = preset.vignetteIntensity;
    }

    // Setters for individual properties
    setVignetteIntensity(value) { this.uniforms.uVignetteIntensity.value = value; }
    setVignetteRadius(value) { this.uniforms.uVignetteRadius.value = value; }
    setVignetteSoftness(value) { this.uniforms.uVignetteSoftness.value = value; }
    setBrightness(value) { this.uniforms.uBrightness.value = value; }
    setContrast(value) { this.uniforms.uContrast.value = value; }
    setSaturation(value) { this.uniforms.uSaturation.value = value; }
    setGamma(value) { this.uniforms.uGamma.value = value; }
    setTemperature(value) { this.uniforms.uTemperature.value = value; }
    setGreenMagentaTint(value) { this.uniforms.uTint.value = value; }
    setTintColor(color) { this.uniforms.uTintColor.value.set(color); }
    setTintIntensity(value) { this.uniforms.uTintIntensity.value = value; }

    /**
     * Apply a color tint overlay (for scene effects)
     * @param {number} r - Red 0-1
     * @param {number} g - Green 0-1
     * @param {number} b - Blue 0-1
     * @param {number} intensity - Tint intensity 0-1
     */
    setTint(r, g, b, intensity = 0.3) {
        this.uniforms.uTintColor.value.setRGB(r, g, b);
        this.uniforms.uTintIntensity.value = intensity;
    }

    /**
     * Clear the color tint overlay
     */
    clearTint() {
        this.uniforms.uTintColor.value.setRGB(1, 1, 1);
        this.uniforms.uTintIntensity.value = 0;
    }

    /**
     * Alias for backward compatibility
     * @param {string} presetName
     */
    setPreset(presetName) {
        this.applyPreset(presetName);
    }

    /**
     * Render the pass
     */
    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        this.uniforms.tDiffuse.value = readBuffer.texture;

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

export { VignetteColorGradePass, ColorGradePresets };
export default VignetteColorGradePass;
