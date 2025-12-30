/**
 * SpineModel.js
 * Professional 3D Model Loader with Holographic Shader
 *
 * Features:
 * - GLTFLoader for .glb model support
 * - DRACOLoader for compression
 * - Holographic/iridescent shader material
 * - Metallic material option
 * - Smooth rotation animation
 * - Scale and position control
 * - Animation mixer support
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import gsap from 'gsap';

// Import holographic shaders
import holographicVertexShader from '../shaders/holographic/vertex.glsl?raw';
import holographicFragmentShader from '../shaders/holographic/fragment.glsl?raw';

/**
 * Material types for model rendering
 */
const MaterialType = {
    ORIGINAL: 'original',
    HOLOGRAPHIC: 'holographic',
    METALLIC: 'metallic',
    WIREFRAME: 'wireframe'
};

/**
 * @class SpineModel
 * @description Professional 3D model loader with custom shader support
 */
class SpineModel {
    /**
     * Create model loader
     * @param {Object} options - Loader options
     */
    constructor(options = {}) {
        const {
            dracoPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
        } = options;

        /** @type {THREE.Group} Container for the model */
        this.group = new THREE.Group();

        /** @type {THREE.Object3D|null} Loaded model */
        this.model = null;

        /** @type {THREE.AnimationMixer|null} Animation mixer */
        this.mixer = null;

        /** @type {Object} Animation clips */
        this.animations = {};

        /** @type {THREE.AnimationAction|null} Current animation */
        this.currentAction = null;

        /** @type {string} Current material type */
        this.currentMaterialType = MaterialType.ORIGINAL;

        /** @type {Object} Original materials backup */
        this.originalMaterials = new Map();

        /** @type {THREE.ShaderMaterial|null} Holographic material */
        this.holographicMaterial = null;

        /** @type {THREE.MeshStandardMaterial|null} Metallic material */
        this.metallicMaterial = null;

        /** @type {Object} Rotation animation settings */
        this.rotation = {
            enabled: true,
            speed: { x: 0, y: 0.3, z: 0 },
            target: { x: 0, y: 0, z: 0 }
        };

        /** @type {boolean} Loading state */
        this.isLoaded = false;

        // ==========================================
        // Setup Loaders
        // ==========================================

        // DRACO loader for compressed meshes
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath(dracoPath);

        // GLTF loader
        this.gltfLoader = new GLTFLoader();
        this.gltfLoader.setDRACOLoader(this.dracoLoader);

        // Create materials
        this._createMaterials();

        console.log('%c[SpineModel] Professional loader initialized', 'color: #ff88aa;');
    }

    /**
     * Create custom materials
     * @private
     */
    _createMaterials() {
        // ==========================================
        // Holographic Material
        // ==========================================

        this.holographicMaterial = new THREE.ShaderMaterial({
            vertexShader: holographicVertexShader,
            fragmentShader: holographicFragmentShader,
            uniforms: {
                // Time
                uTime: { value: 0 },

                // Base appearance
                uColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
                uOpacity: { value: 0.9 },

                // Effects
                uScanLineIntensity: { value: 0.3 },
                uGlitchIntensity: { value: 0.5 },

                // Rainbow/Iridescence
                uRainbowSpeed: { value: 0.15 },
                uRainbowScale: { value: 0.8 },
                uIridescenceStrength: { value: 1.2 },

                // Emissive
                uEmissiveStrength: { value: 0.8 },

                // Metallic properties
                uMetalness: { value: 0.8 },
                uRoughness: { value: 0.2 },

                // Displacement
                uDisplacementScale: { value: 0.02 },
                uWaveSpeed: { value: 1.5 },
                uWaveFrequency: { value: 3.0 }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: true,
            blending: THREE.NormalBlending
        });

        // ==========================================
        // Metallic Material
        // ==========================================

        this.metallicMaterial = new THREE.MeshStandardMaterial({
            color: 0x8888ff,
            metalness: 0.95,
            roughness: 0.1,
            envMapIntensity: 1.5,
            transparent: false
        });

        // ==========================================
        // Wireframe Material
        // ==========================================

        this.wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
    }

    /**
     * Load a 3D model
     * @param {string} url - Model URL (.glb or .gltf)
     * @param {Object} options - Load options
     * @returns {Promise<THREE.Object3D>}
     */
    async load(url, options = {}) {
        const {
            scale = 1,
            position = { x: 0, y: 0, z: 0 },
            rotation = { x: 0, y: 0, z: 0 },
            castShadow = true,
            receiveShadow = true,
            materialType = MaterialType.HOLOGRAPHIC,
            autoRotate = true,
            rotationSpeed = { x: 0, y: 0.3, z: 0 }
        } = options;

        return new Promise((resolve, reject) => {
            console.log(`%c[SpineModel] Loading: ${url}`, 'color: #ff88aa;');

            this.gltfLoader.load(
                url,
                (gltf) => {
                    this.model = gltf.scene;

                    // Apply transforms
                    this.model.scale.setScalar(scale);
                    this.model.position.set(position.x, position.y, position.z);
                    this.model.rotation.set(rotation.x, rotation.y, rotation.z);

                    // Store original materials and setup shadows
                    this.model.traverse((child) => {
                        if (child.isMesh) {
                            // Backup original material
                            this.originalMaterials.set(child.uuid, child.material);

                            // Setup shadows
                            child.castShadow = castShadow;
                            child.receiveShadow = receiveShadow;

                            // Ensure geometry has UVs for shaders
                            if (!child.geometry.attributes.uv) {
                                console.warn('[SpineModel] Mesh missing UVs, generating...');
                                child.geometry.computeVertexNormals();
                            }
                        }
                    });

                    // Setup animations
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.mixer = new THREE.AnimationMixer(this.model);

                        gltf.animations.forEach((clip) => {
                            this.animations[clip.name] = this.mixer.clipAction(clip);
                        });

                        console.log(`%c[SpineModel] Loaded ${gltf.animations.length} animations:`, 'color: #ff88aa;', Object.keys(this.animations));
                    }

                    // Setup rotation
                    this.rotation.enabled = autoRotate;
                    this.rotation.speed = { ...rotationSpeed };

                    // Apply initial material
                    this.setMaterialType(materialType);

                    // Add to group
                    this.group.add(this.model);
                    this.isLoaded = true;

                    // Entrance animation
                    this._playEntranceAnimation();

                    console.log(`%c[SpineModel] Model loaded successfully`, 'color: #ff88aa;');
                    resolve(this.model);
                },
                (progress) => {
                    if (progress.total > 0) {
                        const percent = (progress.loaded / progress.total * 100).toFixed(0);
                        console.log(`%c[SpineModel] Loading: ${percent}%`, 'color: #888888;');
                    }
                },
                (error) => {
                    console.error('[SpineModel] Error loading model:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Play entrance animation
     * @private
     */
    _playEntranceAnimation() {
        if (!this.model) return;

        // Scale from 0
        this.model.scale.setScalar(0);

        gsap.to(this.model.scale, {
            x: this.model.userData.targetScale || 1,
            y: this.model.userData.targetScale || 1,
            z: this.model.userData.targetScale || 1,
            duration: 1.2,
            ease: 'elastic.out(1, 0.5)'
        });

        // Fade in holographic effect
        if (this.currentMaterialType === MaterialType.HOLOGRAPHIC) {
            this.holographicMaterial.uniforms.uOpacity.value = 0;
            gsap.to(this.holographicMaterial.uniforms.uOpacity, {
                value: 0.9,
                duration: 0.8,
                ease: 'power2.out'
            });
        }
    }

    /**
     * Set material type for the model
     * @param {string} type - Material type from MaterialType enum
     */
    setMaterialType(type) {
        if (!this.model) return;

        this.currentMaterialType = type;

        this.model.traverse((child) => {
            if (child.isMesh) {
                switch (type) {
                    case MaterialType.HOLOGRAPHIC:
                        child.material = this.holographicMaterial;
                        break;

                    case MaterialType.METALLIC:
                        child.material = this.metallicMaterial;
                        break;

                    case MaterialType.WIREFRAME:
                        child.material = this.wireframeMaterial;
                        break;

                    case MaterialType.ORIGINAL:
                    default:
                        const originalMat = this.originalMaterials.get(child.uuid);
                        if (originalMat) {
                            child.material = originalMat;
                        }
                        break;
                }
            }
        });

        console.log(`%c[SpineModel] Material changed to: ${type}`, 'color: #ff88aa;');
    }

    /**
     * Get holographic material uniforms for external control
     * @returns {Object} Uniforms object
     */
    getHolographicUniforms() {
        return this.holographicMaterial.uniforms;
    }

    /**
     * Set holographic parameters
     * @param {Object} params
     */
    setHolographicParams(params) {
        const uniforms = this.holographicMaterial.uniforms;

        if (params.color !== undefined) {
            uniforms.uColor.value.set(params.color);
        }
        if (params.opacity !== undefined) {
            uniforms.uOpacity.value = params.opacity;
        }
        if (params.scanLineIntensity !== undefined) {
            uniforms.uScanLineIntensity.value = params.scanLineIntensity;
        }
        if (params.glitchIntensity !== undefined) {
            uniforms.uGlitchIntensity.value = params.glitchIntensity;
        }
        if (params.rainbowSpeed !== undefined) {
            uniforms.uRainbowSpeed.value = params.rainbowSpeed;
        }
        if (params.rainbowScale !== undefined) {
            uniforms.uRainbowScale.value = params.rainbowScale;
        }
        if (params.iridescenceStrength !== undefined) {
            uniforms.uIridescenceStrength.value = params.iridescenceStrength;
        }
        if (params.emissiveStrength !== undefined) {
            uniforms.uEmissiveStrength.value = params.emissiveStrength;
        }
        if (params.metalness !== undefined) {
            uniforms.uMetalness.value = params.metalness;
        }
        if (params.roughness !== undefined) {
            uniforms.uRoughness.value = params.roughness;
        }
    }

    /**
     * Play an animation
     * @param {string} name - Animation name
     * @param {Object} options - Playback options
     */
    playAnimation(name, options = {}) {
        const {
            loop = THREE.LoopRepeat,
            crossFadeDuration = 0.5,
            timeScale = 1.0
        } = options;

        if (!this.animations[name]) {
            console.warn(`[SpineModel] Animation not found: ${name}`);
            return;
        }

        const action = this.animations[name];
        action.setLoop(loop);
        action.timeScale = timeScale;

        if (this.currentAction && this.currentAction !== action) {
            action.reset();
            action.crossFadeFrom(this.currentAction, crossFadeDuration);
        }

        action.play();
        this.currentAction = action;
    }

    /**
     * Stop current animation
     */
    stopAnimation() {
        if (this.currentAction) {
            this.currentAction.fadeOut(0.5);
            this.currentAction = null;
        }
    }

    /**
     * Enable/disable auto rotation
     * @param {boolean} enabled
     */
    setAutoRotate(enabled) {
        this.rotation.enabled = enabled;
    }

    /**
     * Set rotation speed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setRotationSpeed(x, y, z) {
        this.rotation.speed = { x, y, z };
    }

    /**
     * Update model
     * @param {number} elapsedTime - Total elapsed time
     * @param {number} deltaTime - Time since last frame
     */
    update(elapsedTime, deltaTime) {
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Update holographic shader time
        if (this.holographicMaterial) {
            this.holographicMaterial.uniforms.uTime.value = elapsedTime;
        }

        // Auto rotation
        if (this.rotation.enabled && this.model) {
            this.model.rotation.x += this.rotation.speed.x * deltaTime;
            this.model.rotation.y += this.rotation.speed.y * deltaTime;
            this.model.rotation.z += this.rotation.speed.z * deltaTime;
        }
    }

    /**
     * Set model position
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    /**
     * Set model rotation
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setRotation(x, y, z) {
        if (this.model) {
            this.model.rotation.set(x, y, z);
        }
    }

    /**
     * Set model scale
     * @param {number} scale
     */
    setScale(scale) {
        if (this.model) {
            this.model.scale.setScalar(scale);
            this.model.userData.targetScale = scale;
        }
    }

    /**
     * Get the model group
     * @returns {THREE.Group}
     */
    getGroup() {
        return this.group;
    }

    /**
     * Get the loaded model
     * @returns {THREE.Object3D|null}
     */
    getModel() {
        return this.model;
    }

    /**
     * Get animation names
     * @returns {string[]}
     */
    getAnimationNames() {
        return Object.keys(this.animations);
    }

    /**
     * Check if model is loaded
     * @returns {boolean}
     */
    isModelLoaded() {
        return this.isLoaded;
    }

    /**
     * Clean up resources
     */
    dispose() {
        // Stop animations
        this.stopAnimation();

        // Dispose model resources
        if (this.model) {
            this.model.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                // Note: Don't dispose original materials as they might be reused
            });
        }

        // Dispose custom materials
        if (this.holographicMaterial) {
            this.holographicMaterial.dispose();
        }
        if (this.metallicMaterial) {
            this.metallicMaterial.dispose();
        }
        if (this.wireframeMaterial) {
            this.wireframeMaterial.dispose();
        }

        // Clear original materials map
        this.originalMaterials.clear();

        // Dispose loaders
        this.dracoLoader.dispose();

        this.isLoaded = false;

        console.log('%c[SpineModel] Disposed', 'color: #ff88aa;');
    }
}

export { SpineModel, MaterialType };
export default SpineModel;
