/**
 * Scene.js
 * Scene Manager with Singleton Pattern
 *
 * Manages the Three.js scene with:
 * - Singleton pattern for global access
 * - Clean object management
 * - Disposal utilities
 */

import * as THREE from 'three';

/**
 * @class SceneManager
 * @description Manages the Three.js scene with singleton pattern
 */
class SceneManager {
    /** @type {SceneManager|null} Singleton instance */
    static instance = null;

    /**
     * Create scene manager
     * @param {Object} options - Scene configuration
     * @param {number} options.backgroundColor - Background color (default: 0x000000)
     * @param {boolean} options.fog - Enable fog (default: false)
     * @param {number} options.fogColor - Fog color (default: 0x000000)
     * @param {number} options.fogNear - Fog near distance (default: 10)
     * @param {number} options.fogFar - Fog far distance (default: 50)
     */
    constructor(options = {}) {
        // Singleton pattern
        if (SceneManager.instance) {
            return SceneManager.instance;
        }
        SceneManager.instance = this;

        // ==========================================
        // Configuration
        // ==========================================

        const {
            backgroundColor = 0x000000,
            fog = false,
            fogColor = 0x000000,
            fogNear = 10,
            fogFar = 50
        } = options;

        // ==========================================
        // Create Scene
        // ==========================================

        /** @type {THREE.Scene} Main scene */
        this.scene = new THREE.Scene();

        // Set background
        this.scene.background = new THREE.Color(backgroundColor);

        // ==========================================
        // Fog Setup
        // ==========================================

        if (fog) {
            this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
        }

        // ==========================================
        // Object Tracking
        // ==========================================

        /** @type {Map<string, THREE.Object3D>} Named objects registry */
        this.objects = new Map();

        console.log('%c[Scene] Initialized', 'color: #88ff44;');
    }

    /**
     * Add an object to the scene
     * @param {THREE.Object3D} object - Object to add
     * @param {string} [name] - Optional name for retrieval
     */
    add(object, name) {
        this.scene.add(object);

        if (name) {
            this.objects.set(name, object);
        }
    }

    /**
     * Remove an object from the scene
     * @param {THREE.Object3D|string} objectOrName - Object or name to remove
     */
    remove(objectOrName) {
        let object;

        if (typeof objectOrName === 'string') {
            object = this.objects.get(objectOrName);
            this.objects.delete(objectOrName);
        } else {
            object = objectOrName;
            // Remove from registry if exists
            for (const [name, obj] of this.objects.entries()) {
                if (obj === object) {
                    this.objects.delete(name);
                    break;
                }
            }
        }

        if (object) {
            this.scene.remove(object);
            this.disposeObject(object);
        }
    }

    /**
     * Get a named object
     * @param {string} name - Object name
     * @returns {THREE.Object3D|undefined}
     */
    get(name) {
        return this.objects.get(name);
    }

    /**
     * Set background color
     * @param {number} color - Hex color
     */
    setBackground(color) {
        this.scene.background = new THREE.Color(color);
    }

    /**
     * Set background to a texture or cube texture
     * @param {THREE.Texture|THREE.CubeTexture} texture
     */
    setBackgroundTexture(texture) {
        this.scene.background = texture;
    }

    /**
     * Set environment map
     * @param {THREE.Texture} envMap - Environment map texture
     */
    setEnvironment(envMap) {
        this.scene.environment = envMap;
    }

    /**
     * Enable/disable fog
     * @param {boolean} enabled
     * @param {Object} options - Fog options
     */
    setFog(enabled, options = {}) {
        if (enabled) {
            const { color = 0x000000, near = 10, far = 50 } = options;
            this.scene.fog = new THREE.Fog(color, near, far);
        } else {
            this.scene.fog = null;
        }
    }

    /**
     * Get the scene instance
     * @returns {THREE.Scene}
     */
    getScene() {
        return this.scene;
    }

    /**
     * Traverse all objects in the scene
     * @param {Function} callback - Callback for each object
     */
    traverse(callback) {
        this.scene.traverse(callback);
    }

    /**
     * Dispose a single object and its resources
     * @param {THREE.Object3D} object
     * @private
     */
    disposeObject(object) {
        object.traverse((child) => {
            // Dispose geometry
            if (child.geometry) {
                child.geometry.dispose();
            }

            // Dispose materials
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => this.disposeMaterial(mat));
                } else {
                    this.disposeMaterial(child.material);
                }
            }
        });
    }

    /**
     * Dispose a material and its textures
     * @param {THREE.Material} material
     * @private
     */
    disposeMaterial(material) {
        // Dispose all possible texture maps
        const textureProperties = [
            'map', 'lightMap', 'bumpMap', 'normalMap',
            'specularMap', 'envMap', 'alphaMap', 'aoMap',
            'displacementMap', 'emissiveMap', 'gradientMap',
            'metalnessMap', 'roughnessMap'
        ];

        textureProperties.forEach(prop => {
            if (material[prop]) {
                material[prop].dispose();
            }
        });

        material.dispose();
    }

    /**
     * Clear all objects from the scene
     */
    clear() {
        // Dispose all tracked objects
        this.objects.forEach((object) => {
            this.scene.remove(object);
            this.disposeObject(object);
        });
        this.objects.clear();

        // Remove remaining children (except camera/lights if needed)
        while (this.scene.children.length > 0) {
            const child = this.scene.children[0];
            this.scene.remove(child);
            this.disposeObject(child);
        }
    }

    /**
     * Clean up all resources
     */
    dispose() {
        this.clear();
        SceneManager.instance = null;

        console.log('%c[Scene] Disposed', 'color: #88ff44;');
    }
}

export { SceneManager };
export default SceneManager;
