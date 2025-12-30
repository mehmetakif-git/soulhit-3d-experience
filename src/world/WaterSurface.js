/**
 * WaterSurface.js
 * Gerstner Waves Water Surface System
 *
 * Creates realistic ocean/water surface using GPU-computed Gerstner waves.
 * Features:
 * - 4 layered Gerstner waves for complex motion
 * - Depth-based color gradient
 * - Fresnel reflection effect
 * - Specular sun highlights
 * - Subsurface scattering
 * - Foam on wave peaks
 * - Animated caustic patterns
 */

import * as THREE from 'three';
import gsap from 'gsap';

// Import shaders
import waterVertexShader from '../shaders/water/vertex.glsl?raw';
import waterFragmentShader from '../shaders/water/fragment.glsl?raw';

/**
 * Default wave configurations
 * Each wave has: direction, amplitude, frequency (wavelength), speed
 */
const DEFAULT_WAVES = [
    {
        direction: new THREE.Vector2(1.0, 0.0),
        amplitude: 0.25,
        frequency: 8.0,     // wavelength in units
        speed: 1.2
    },
    {
        direction: new THREE.Vector2(0.7, 0.7),
        amplitude: 0.15,
        frequency: 12.0,
        speed: 1.5
    },
    {
        direction: new THREE.Vector2(-0.5, 0.8),
        amplitude: 0.1,
        frequency: 16.0,
        speed: 2.0
    },
    {
        direction: new THREE.Vector2(0.3, -0.9),
        amplitude: 0.08,
        frequency: 20.0,
        speed: 2.5
    }
];

/**
 * @class WaterSurface
 * @description Realistic water surface with Gerstner wave displacement
 */
class WaterSurface {
    /**
     * Create water surface
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        const {
            // Geometry
            width = 100,
            height = 100,
            widthSegments = 256,
            heightSegments = 256,
            position = new THREE.Vector3(0, 0, 0),

            // Waves
            waves = DEFAULT_WAVES,
            steepness = 0.5,

            // Colors
            waterColorDeep = new THREE.Color(0x001525),
            waterColorShallow = new THREE.Color(0x1a4d5c),
            waterColorFoam = new THREE.Color(0xffffff),

            // Lighting
            lightDirection = new THREE.Vector3(0.5, 0.8, 0.3),
            lightColor = new THREE.Color(0xffffff),
            specularPower = 128.0,
            specularIntensity = 0.8,

            // Fresnel
            fresnelPower = 3.0,
            fresnelBias = 0.1,

            // Foam
            foamThreshold = 0.3,
            foamIntensity = 1.5,

            // Caustics
            causticScale = 1.0,
            causticIntensity = 0.3,

            // Subsurface scattering
            subsurfaceColor = new THREE.Color(0x40c0a0),
            subsurfaceIntensity = 0.4,

            // Opacity
            opacity = 0.85
        } = options;

        // Store configuration
        this.width = width;
        this.height = height;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;
        this.waves = waves;
        this.steepness = steepness;

        // Create geometry
        this._createGeometry();

        // Create material with shaders
        this._createMaterial({
            waterColorDeep,
            waterColorShallow,
            waterColorFoam,
            lightDirection,
            lightColor,
            specularPower,
            specularIntensity,
            fresnelPower,
            fresnelBias,
            foamThreshold,
            foamIntensity,
            causticScale,
            causticIntensity,
            subsurfaceColor,
            subsurfaceIntensity,
            opacity
        });

        // Create mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(position);
        this.mesh.rotation.x = -Math.PI / 2; // Rotate to horizontal
        this.mesh.receiveShadow = true;

        // Visibility state
        this.visible = true;
        this.targetOpacity = opacity;

        console.log('%c[WaterSurface] Initialized with Gerstner waves', 'color: #40c0ff;');
        console.log(`%c[WaterSurface] Geometry: ${width}x${height}, ${widthSegments}x${heightSegments} segments`, 'color: #40c0ff;');
    }

    /**
     * Create water plane geometry
     * @private
     */
    _createGeometry() {
        this.geometry = new THREE.PlaneGeometry(
            this.width,
            this.height,
            this.widthSegments,
            this.heightSegments
        );

        // Compute bounding sphere for frustum culling
        this.geometry.computeBoundingSphere();
    }

    /**
     * Create shader material
     * @param {Object} params - Material parameters
     * @private
     */
    _createMaterial(params) {
        // Create uniforms
        this.uniforms = {
            // Time
            uTime: { value: 0 },

            // Wave parameters (4 waves)
            uWaveDirection1: { value: this.waves[0].direction.clone().normalize() },
            uWaveDirection2: { value: this.waves[1].direction.clone().normalize() },
            uWaveDirection3: { value: this.waves[2].direction.clone().normalize() },
            uWaveDirection4: { value: this.waves[3].direction.clone().normalize() },

            uWaveAmplitude1: { value: this.waves[0].amplitude },
            uWaveAmplitude2: { value: this.waves[1].amplitude },
            uWaveAmplitude3: { value: this.waves[2].amplitude },
            uWaveAmplitude4: { value: this.waves[3].amplitude },

            uWaveFrequency1: { value: this.waves[0].frequency },
            uWaveFrequency2: { value: this.waves[1].frequency },
            uWaveFrequency3: { value: this.waves[2].frequency },
            uWaveFrequency4: { value: this.waves[3].frequency },

            uWaveSpeed1: { value: this.waves[0].speed },
            uWaveSpeed2: { value: this.waves[1].speed },
            uWaveSpeed3: { value: this.waves[2].speed },
            uWaveSpeed4: { value: this.waves[3].speed },

            uSteepness: { value: this.steepness },

            // Colors
            uWaterColorDeep: { value: params.waterColorDeep },
            uWaterColorShallow: { value: params.waterColorShallow },
            uWaterColorFoam: { value: params.waterColorFoam },

            // Lighting
            uLightDirection: { value: params.lightDirection.clone().normalize() },
            uLightColor: { value: params.lightColor },
            uSpecularPower: { value: params.specularPower },
            uSpecularIntensity: { value: params.specularIntensity },

            // Fresnel
            uFresnelPower: { value: params.fresnelPower },
            uFresnelBias: { value: params.fresnelBias },

            // Foam
            uFoamThreshold: { value: params.foamThreshold },
            uFoamIntensity: { value: params.foamIntensity },

            // Caustics
            uCausticScale: { value: params.causticScale },
            uCausticIntensity: { value: params.causticIntensity },

            // Subsurface
            uSubsurfaceColor: { value: params.subsurfaceColor },
            uSubsurfaceIntensity: { value: params.subsurfaceIntensity },

            // Opacity
            uOpacity: { value: params.opacity }
        };

        // Create shader material
        this.material = new THREE.ShaderMaterial({
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            uniforms: this.uniforms,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: true,
            depthTest: true
        });
    }

    /**
     * Update water surface (call every frame)
     * @param {number} elapsedTime - Total elapsed time
     * @param {number} deltaTime - Time since last frame
     */
    update(elapsedTime, deltaTime) {
        // Update time uniform for wave animation
        this.uniforms.uTime.value = elapsedTime;
    }

    /**
     * Set wave parameters for a specific wave
     * @param {number} index - Wave index (0-3)
     * @param {Object} params - Wave parameters
     */
    setWave(index, params) {
        if (index < 0 || index > 3) return;

        const i = index + 1; // Uniform names are 1-indexed

        if (params.direction !== undefined) {
            this.uniforms[`uWaveDirection${i}`].value.copy(params.direction).normalize();
        }
        if (params.amplitude !== undefined) {
            this.uniforms[`uWaveAmplitude${i}`].value = params.amplitude;
        }
        if (params.frequency !== undefined) {
            this.uniforms[`uWaveFrequency${i}`].value = params.frequency;
        }
        if (params.speed !== undefined) {
            this.uniforms[`uWaveSpeed${i}`].value = params.speed;
        }
    }

    /**
     * Set overall wave steepness
     * @param {number} steepness - Steepness value (0-1)
     */
    setSteepness(steepness) {
        this.steepness = Math.max(0, Math.min(1, steepness));
        this.uniforms.uSteepness.value = this.steepness;
    }

    /**
     * Set water colors
     * @param {Object} colors - Color configuration
     */
    setColors(colors) {
        if (colors.deep !== undefined) {
            this.uniforms.uWaterColorDeep.value.set(colors.deep);
        }
        if (colors.shallow !== undefined) {
            this.uniforms.uWaterColorShallow.value.set(colors.shallow);
        }
        if (colors.foam !== undefined) {
            this.uniforms.uWaterColorFoam.value.set(colors.foam);
        }
    }

    /**
     * Set light direction
     * @param {THREE.Vector3|Object} direction - Light direction
     */
    setLightDirection(direction) {
        if (direction instanceof THREE.Vector3) {
            this.uniforms.uLightDirection.value.copy(direction).normalize();
        } else {
            this.uniforms.uLightDirection.value.set(
                direction.x || 0,
                direction.y || 1,
                direction.z || 0
            ).normalize();
        }
    }

    /**
     * Set foam parameters
     * @param {Object} params - Foam parameters
     */
    setFoam(params) {
        if (params.threshold !== undefined) {
            this.uniforms.uFoamThreshold.value = params.threshold;
        }
        if (params.intensity !== undefined) {
            this.uniforms.uFoamIntensity.value = params.intensity;
        }
    }

    /**
     * Set caustic parameters
     * @param {Object} params - Caustic parameters
     */
    setCaustics(params) {
        if (params.scale !== undefined) {
            this.uniforms.uCausticScale.value = params.scale;
        }
        if (params.intensity !== undefined) {
            this.uniforms.uCausticIntensity.value = params.intensity;
        }
    }

    /**
     * Set water opacity
     * @param {number} opacity - Opacity value (0-1)
     */
    setOpacity(opacity) {
        this.uniforms.uOpacity.value = Math.max(0, Math.min(1, opacity));
    }

    /**
     * Show water surface with animation
     * @param {number} duration - Animation duration
     */
    show(duration = 1.0) {
        this.visible = true;
        this.mesh.visible = true;

        gsap.to(this.uniforms.uOpacity, {
            value: this.targetOpacity,
            duration: duration,
            ease: 'power2.out'
        });
    }

    /**
     * Hide water surface with animation
     * @param {number} duration - Animation duration
     */
    hide(duration = 1.0) {
        gsap.to(this.uniforms.uOpacity, {
            value: 0,
            duration: duration,
            ease: 'power2.out',
            onComplete: () => {
                this.visible = false;
                this.mesh.visible = false;
            }
        });
    }

    /**
     * Set visibility immediately
     * @param {boolean} visible
     */
    setVisible(visible) {
        this.visible = visible;
        this.mesh.visible = visible;
        this.uniforms.uOpacity.value = visible ? this.targetOpacity : 0;
    }

    /**
     * Get the water mesh
     * @returns {THREE.Mesh}
     */
    getMesh() {
        return this.mesh;
    }

    /**
     * Get wave height at a world position (approximate)
     * @param {number} x - X position
     * @param {number} z - Z position
     * @param {number} time - Current time
     * @returns {number} Approximate wave height
     */
    getHeightAt(x, z, time) {
        let height = 0;

        // Sum all wave contributions
        for (let i = 0; i < 4; i++) {
            const wave = this.waves[i];
            const dir = wave.direction.clone().normalize();
            const k = (2 * Math.PI) / wave.frequency;
            const w = Math.sqrt(9.8 * k);
            const phase = k * (dir.x * x + dir.y * z) - w * time * wave.speed;

            height += wave.amplitude * Math.sin(phase);
        }

        return height;
    }

    /**
     * Set wave amplitude with animation (for weather effects)
     * @param {number} multiplier - Amplitude multiplier (1 = normal)
     * @param {number} duration - Transition duration
     */
    setWaveIntensity(multiplier, duration = 2.0) {
        for (let i = 1; i <= 4; i++) {
            const baseAmplitude = this.waves[i - 1].amplitude;
            gsap.to(this.uniforms[`uWaveAmplitude${i}`], {
                value: baseAmplitude * multiplier,
                duration: duration,
                ease: 'power2.inOut'
            });
        }
    }

    /**
     * Apply calm water preset
     */
    setCalm() {
        this.setSteepness(0.3);
        this.setWaveIntensity(0.5);
        this.setFoam({ threshold: 0.5, intensity: 0.5 });
    }

    /**
     * Apply stormy water preset
     */
    setStormy() {
        this.setSteepness(0.8);
        this.setWaveIntensity(2.0);
        this.setFoam({ threshold: 0.1, intensity: 3.0 });
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.geometry) {
            this.geometry.dispose();
        }

        if (this.material) {
            this.material.dispose();
        }

        console.log('%c[WaterSurface] Disposed', 'color: #40c0ff;');
    }
}

export { WaterSurface, DEFAULT_WAVES };
export default WaterSurface;
