/**
 * LightingSystem.js
 * Professional 3-Point Lighting with Animated Accents
 *
 * Features:
 * - 3-point lighting setup (key, fill, back)
 * - Animated rim/accent lights
 * - Color cycling options
 * - Shadow configuration
 * - Performance modes
 */

import * as THREE from 'three';
import gsap from 'gsap';

/**
 * @class LightingSystem
 * @description Professional lighting setup for 3D scenes
 */
class LightingSystem {
    /**
     * Create lighting system
     * @param {THREE.Scene} scene
     * @param {THREE.WebGLRenderer} renderer - Optional renderer reference
     * @param {Object} options
     */
    constructor(scene, renderer = null, options = {}) {
        // Handle case where renderer is actually options (backwards compat)
        if (renderer && !renderer.render && typeof renderer === 'object') {
            options = renderer;
            renderer = null;
        }

        this.renderer = renderer;
        const {
            // Key light (main)
            keyLightIntensity = 1.5,
            keyLightColor = 0xffffff,
            keyLightPosition = { x: 5, y: 8, z: 5 },

            // Fill light (soften shadows)
            fillLightIntensity = 0.5,
            fillLightColor = 0x8888ff,
            fillLightPosition = { x: -5, y: 3, z: 3 },

            // Back light (rim/separation)
            backLightIntensity = 0.8,
            backLightColor = 0xff8844,
            backLightPosition = { x: 0, y: 5, z: -8 },

            // Ambient
            ambientIntensity = 0.2,
            ambientColor = 0x111122,

            // Accent lights
            accentLightsEnabled = true,
            accentLightCount = 3,

            // Shadows
            shadowsEnabled = true,
            enableShadows = true,
            shadowMapSize = 2048,

            // Animation
            animationEnabled = true,
            enableAnimatedLights = true,

            // Preset
            preset = 'neutral'
        } = options;

        // Use either shadowsEnabled or enableShadows
        const useShadows = shadowsEnabled && enableShadows;

        this.scene = scene;
        this.lights = {};
        this.accentLights = [];
        this.animationEnabled = animationEnabled && enableAnimatedLights;
        this.shadowMapSize = shadowMapSize;
        this.time = 0;

        // ==========================================
        // Ambient Light
        // ==========================================

        this.lights.ambient = new THREE.AmbientLight(ambientColor, ambientIntensity);
        scene.add(this.lights.ambient);

        // ==========================================
        // Key Light (Main Light)
        // ==========================================

        this.lights.key = new THREE.DirectionalLight(keyLightColor, keyLightIntensity);
        this.lights.key.position.set(keyLightPosition.x, keyLightPosition.y, keyLightPosition.z);

        if (useShadows) {
            this.lights.key.castShadow = true;
            this.lights.key.shadow.mapSize.width = shadowMapSize;
            this.lights.key.shadow.mapSize.height = shadowMapSize;
            this.lights.key.shadow.camera.near = 0.5;
            this.lights.key.shadow.camera.far = 50;
            this.lights.key.shadow.camera.left = -15;
            this.lights.key.shadow.camera.right = 15;
            this.lights.key.shadow.camera.top = 15;
            this.lights.key.shadow.camera.bottom = -15;
            this.lights.key.shadow.bias = -0.0001;
            this.lights.key.shadow.normalBias = 0.02;
        }

        scene.add(this.lights.key);

        // ==========================================
        // Fill Light
        // ==========================================

        this.lights.fill = new THREE.DirectionalLight(fillLightColor, fillLightIntensity);
        this.lights.fill.position.set(fillLightPosition.x, fillLightPosition.y, fillLightPosition.z);
        scene.add(this.lights.fill);

        // ==========================================
        // Back Light (Rim Light)
        // ==========================================

        this.lights.back = new THREE.DirectionalLight(backLightColor, backLightIntensity);
        this.lights.back.position.set(backLightPosition.x, backLightPosition.y, backLightPosition.z);
        scene.add(this.lights.back);

        // ==========================================
        // Accent Point Lights
        // ==========================================

        if (accentLightsEnabled) {
            this._createAccentLights(accentLightCount);
        }

        // ==========================================
        // Hemisphere Light (sky/ground)
        // ==========================================

        this.lights.hemisphere = new THREE.HemisphereLight(0x4488ff, 0x222244, 0.3);
        scene.add(this.lights.hemisphere);

        // Apply initial preset
        if (preset !== 'neutral') {
            this.setPreset(preset);
        }

        console.log('%c[LightingSystem] 3-point lighting initialized', 'color: #ffcc44;');
    }

    /**
     * Create animated accent lights
     * @param {number} count
     * @private
     */
    _createAccentLights(count) {
        const colors = [0x4488ff, 0xff4488, 0x44ff88, 0xffaa44, 0x8844ff];
        const radius = 8;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;

            const light = new THREE.PointLight(colors[i % colors.length], 0.5, 15, 2);
            light.position.set(
                Math.cos(angle) * radius,
                2 + Math.sin(angle * 2) * 2,
                Math.sin(angle) * radius
            );

            // Store initial position for animation
            light.userData.initialAngle = angle;
            light.userData.radius = radius;
            light.userData.speed = 0.3 + Math.random() * 0.2;
            light.userData.verticalOffset = Math.random() * Math.PI * 2;

            this.scene.add(light);
            this.accentLights.push(light);
        }
    }

    /**
     * Update lighting animations
     * @param {number} elapsedTime
     * @param {number} deltaTime
     */
    update(elapsedTime, deltaTime) {
        this.time = elapsedTime;

        if (!this.animationEnabled) return;

        // Animate accent lights
        this.accentLights.forEach((light, i) => {
            const { initialAngle, radius, speed, verticalOffset } = light.userData;

            // Orbital motion
            const angle = initialAngle + elapsedTime * speed;
            light.position.x = Math.cos(angle) * radius;
            light.position.z = Math.sin(angle) * radius;

            // Vertical oscillation
            light.position.y = 2 + Math.sin(elapsedTime * 0.5 + verticalOffset) * 3;

            // Intensity pulse
            light.intensity = 0.4 + Math.sin(elapsedTime * 2 + i) * 0.2;
        });

        // Subtle key light animation
        const keyPulse = Math.sin(elapsedTime * 0.3) * 0.1;
        this.lights.key.intensity = 1.5 + keyPulse;

        // Back light color shift
        const hue = (Math.sin(elapsedTime * 0.1) * 0.5 + 0.5) * 0.1 + 0.05; // Orange range
        this.lights.back.color.setHSL(hue, 0.8, 0.5);
    }

    /**
     * Set key light intensity
     * @param {number} intensity
     */
    setKeyLightIntensity(intensity) {
        this.lights.key.intensity = intensity;
    }

    /**
     * Set fill light intensity
     * @param {number} intensity
     */
    setFillLightIntensity(intensity) {
        this.lights.fill.intensity = intensity;
    }

    /**
     * Set back light intensity
     * @param {number} intensity
     */
    setBackLightIntensity(intensity) {
        this.lights.back.intensity = intensity;
    }

    /**
     * Set ambient intensity
     * @param {number} intensity
     */
    setAmbientIntensity(intensity) {
        this.lights.ambient.intensity = intensity;
    }

    /**
     * Set key light color
     * @param {number|string} color
     */
    setKeyLightColor(color) {
        this.lights.key.color.set(color);
    }

    /**
     * Set fill light color
     * @param {number|string} color
     */
    setFillLightColor(color) {
        this.lights.fill.color.set(color);
    }

    /**
     * Set back light color
     * @param {number|string} color
     */
    setBackLightColor(color) {
        this.lights.back.color.set(color);
    }

    /**
     * Enable/disable shadows
     * @param {boolean} enabled
     */
    setShadowsEnabled(enabled) {
        this.lights.key.castShadow = enabled;
    }

    /**
     * Set shadow quality
     * @param {number} size - Shadow map size (512, 1024, 2048, 4096)
     */
    setShadowQuality(size) {
        this.lights.key.shadow.mapSize.width = size;
        this.lights.key.shadow.mapSize.height = size;
        this.lights.key.shadow.map?.dispose();
        this.lights.key.shadow.map = null;
    }

    /**
     * Set shadow map size (alias for setShadowQuality)
     * @param {number} size - Shadow map size (512, 1024, 2048, 4096)
     */
    setShadowMapSize(size) {
        this.setShadowQuality(size);
    }

    /**
     * Enable/disable animation
     * @param {boolean} enabled
     */
    setAnimationEnabled(enabled) {
        this.animationEnabled = enabled;
    }

    /**
     * Set lighting preset (instant, no animation)
     * @param {string} presetName
     */
    setPreset(presetName) {
        this.animateToPreset(presetName, 0.5);
    }

    /**
     * Play entrance animation for lights
     */
    playEntranceAnimation() {
        // Fade in all lights from 0
        const originalIntensities = {
            key: this.lights.key.intensity,
            fill: this.lights.fill.intensity,
            back: this.lights.back.intensity,
            ambient: this.lights.ambient.intensity,
            hemisphere: this.lights.hemisphere.intensity
        };

        // Set to 0
        this.lights.key.intensity = 0;
        this.lights.fill.intensity = 0;
        this.lights.back.intensity = 0;
        this.lights.ambient.intensity = 0;
        this.lights.hemisphere.intensity = 0;

        // Animate accent lights
        this.accentLights.forEach(light => {
            const originalIntensity = light.intensity;
            light.intensity = 0;
            gsap.to(light, {
                intensity: originalIntensity,
                duration: 1.5,
                delay: 0.5,
                ease: 'power2.out'
            });
        });

        // Animate main lights
        gsap.to(this.lights.key, {
            intensity: originalIntensities.key,
            duration: 1.2,
            delay: 0.2,
            ease: 'power2.out'
        });

        gsap.to(this.lights.fill, {
            intensity: originalIntensities.fill,
            duration: 1.0,
            delay: 0.3,
            ease: 'power2.out'
        });

        gsap.to(this.lights.back, {
            intensity: originalIntensities.back,
            duration: 1.0,
            delay: 0.4,
            ease: 'power2.out'
        });

        gsap.to(this.lights.ambient, {
            intensity: originalIntensities.ambient,
            duration: 0.8,
            delay: 0.1,
            ease: 'power2.out'
        });

        gsap.to(this.lights.hemisphere, {
            intensity: originalIntensities.hemisphere,
            duration: 1.0,
            delay: 0.2,
            ease: 'power2.out'
        });
    }

    /**
     * Set accent lights visibility
     * @param {boolean} visible
     */
    setAccentLightsVisible(visible) {
        this.accentLights.forEach(light => {
            light.visible = visible;
        });
    }

    /**
     * Animate to a preset
     * @param {string} presetName
     * @param {number} duration
     */
    animateToPreset(presetName, duration = 1) {
        const presets = {
            neutral: {
                keyIntensity: 1.5,
                fillIntensity: 0.5,
                backIntensity: 0.8,
                ambientIntensity: 0.2
            },
            dramatic: {
                keyIntensity: 2.0,
                fillIntensity: 0.2,
                backIntensity: 1.2,
                ambientIntensity: 0.1
            },
            soft: {
                keyIntensity: 1.0,
                fillIntensity: 0.8,
                backIntensity: 0.5,
                ambientIntensity: 0.4
            },
            night: {
                keyIntensity: 0.5,
                fillIntensity: 0.3,
                backIntensity: 0.6,
                ambientIntensity: 0.1
            }
        };

        const preset = presets[presetName];
        if (!preset) return;

        gsap.to(this.lights.key, { intensity: preset.keyIntensity, duration });
        gsap.to(this.lights.fill, { intensity: preset.fillIntensity, duration });
        gsap.to(this.lights.back, { intensity: preset.backIntensity, duration });
        gsap.to(this.lights.ambient, { intensity: preset.ambientIntensity, duration });
    }

    /**
     * Get all lights
     * @returns {Object}
     */
    getLights() {
        return this.lights;
    }

    /**
     * Clean up
     */
    dispose() {
        // Remove main lights
        Object.values(this.lights).forEach(light => {
            this.scene.remove(light);
            if (light.shadow?.map) {
                light.shadow.map.dispose();
            }
        });

        // Remove accent lights
        this.accentLights.forEach(light => {
            this.scene.remove(light);
        });

        this.lights = {};
        this.accentLights = [];

        console.log('%c[LightingSystem] Disposed', 'color: #ffcc44;');
    }
}

export { LightingSystem };
export default LightingSystem;
