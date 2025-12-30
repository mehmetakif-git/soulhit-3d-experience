/**
 * Environment.js
 * Scene Environment Manager
 *
 * Manages scene lighting, fog, and ambient effects.
 * Creates a cohesive visual environment for the 3D experience.
 */

import * as THREE from 'three';

/**
 * @class Environment
 * @description Manages scene lighting and atmospheric effects
 */
class Environment {
    /**
     * Create environment
     * @param {THREE.Scene} scene - The scene to add lights to
     * @param {Object} options - Environment configuration
     */
    constructor(scene, options = {}) {
        /** @type {THREE.Scene} */
        this.scene = scene;

        // ==========================================
        // Configuration
        // ==========================================

        const {
            ambientIntensity = 0.4,
            ambientColor = 0xffffff,
            mainLightIntensity = 1.0,
            mainLightColor = 0xffffff,
            enableFog = false,
            fogColor = 0x000011,
            fogNear = 10,
            fogFar = 50
        } = options;

        /** @type {Object} Light references for updates */
        this.lights = {};

        // ==========================================
        // Setup Environment
        // ==========================================

        this.setupAmbientLight(ambientColor, ambientIntensity);
        this.setupMainLight(mainLightColor, mainLightIntensity);
        this.setupAccentLights();

        if (enableFog) {
            this.setupFog(fogColor, fogNear, fogFar);
        }

        console.log('%c[Environment] Initialized', 'color: #ffaa44;');
    }

    /**
     * Setup ambient light
     * @param {number} color - Light color
     * @param {number} intensity - Light intensity
     */
    setupAmbientLight(color, intensity) {
        this.lights.ambient = new THREE.AmbientLight(color, intensity);
        this.scene.add(this.lights.ambient);
    }

    /**
     * Setup main directional light with shadows
     * @param {number} color - Light color
     * @param {number} intensity - Light intensity
     */
    setupMainLight(color, intensity) {
        this.lights.main = new THREE.DirectionalLight(color, intensity);
        this.lights.main.position.set(5, 10, 7.5);

        // Shadow settings
        this.lights.main.castShadow = true;
        this.lights.main.shadow.mapSize.width = 2048;
        this.lights.main.shadow.mapSize.height = 2048;
        this.lights.main.shadow.camera.near = 0.5;
        this.lights.main.shadow.camera.far = 50;
        this.lights.main.shadow.camera.left = -10;
        this.lights.main.shadow.camera.right = 10;
        this.lights.main.shadow.camera.top = 10;
        this.lights.main.shadow.camera.bottom = -10;
        this.lights.main.shadow.bias = -0.0001;

        this.scene.add(this.lights.main);
    }

    /**
     * Setup accent lights for visual interest
     */
    setupAccentLights() {
        // Purple accent light
        this.lights.accent1 = new THREE.PointLight(0xff00ff, 0.5, 20);
        this.lights.accent1.position.set(-5, 3, 3);
        this.scene.add(this.lights.accent1);

        // Cyan accent light
        this.lights.accent2 = new THREE.PointLight(0x00ffff, 0.5, 20);
        this.lights.accent2.position.set(5, -3, 3);
        this.scene.add(this.lights.accent2);

        // Blue rim light
        this.lights.rim = new THREE.PointLight(0x4488ff, 0.3, 15);
        this.lights.rim.position.set(0, 5, -5);
        this.scene.add(this.lights.rim);
    }

    /**
     * Setup fog effect
     * @param {number} color - Fog color
     * @param {number} near - Near distance
     * @param {number} far - Far distance
     */
    setupFog(color, near, far) {
        this.scene.fog = new THREE.Fog(color, near, far);
    }

    /**
     * Update environment (for animated effects)
     * @param {number} elapsedTime - Time elapsed since start
     */
    update(elapsedTime) {
        // Subtle light animation
        if (this.lights.accent1) {
            this.lights.accent1.intensity = 0.5 + Math.sin(elapsedTime * 0.5) * 0.2;
        }
        if (this.lights.accent2) {
            this.lights.accent2.intensity = 0.5 + Math.cos(elapsedTime * 0.5) * 0.2;
        }
    }

    /**
     * Set ambient light intensity
     * @param {number} intensity
     */
    setAmbientIntensity(intensity) {
        if (this.lights.ambient) {
            this.lights.ambient.intensity = intensity;
        }
    }

    /**
     * Set main light intensity
     * @param {number} intensity
     */
    setMainLightIntensity(intensity) {
        if (this.lights.main) {
            this.lights.main.intensity = intensity;
        }
    }

    /**
     * Set fog parameters
     * @param {boolean} enabled
     * @param {Object} options
     */
    setFog(enabled, options = {}) {
        if (enabled) {
            const { color = 0x000011, near = 10, far = 50 } = options;
            this.scene.fog = new THREE.Fog(color, near, far);
        } else {
            this.scene.fog = null;
        }
    }

    /**
     * Get all lights
     * @returns {Object}
     */
    getLights() {
        return this.lights;
    }

    /**
     * Clean up resources
     */
    dispose() {
        Object.values(this.lights).forEach(light => {
            this.scene.remove(light);
            if (light.dispose) light.dispose();
        });
        this.lights = {};

        console.log('%c[Environment] Disposed', 'color: #ffaa44;');
    }
}

export { Environment };
export default Environment;
