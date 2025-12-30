/**
 * Loader.js
 * Centralized asset loading manager with progress tracking
 */

import * as THREE from 'three';

/**
 * AssetLoader class
 * Manages loading of textures, models, fonts, and other assets
 */
export class AssetLoader {
    constructor() {
        // Create loading manager for progress tracking
        this.manager = new THREE.LoadingManager();

        // Initialize loaders
        this.textureLoader = new THREE.TextureLoader(this.manager);

        // Track loading progress
        this.totalItems = 0;
        this.loadedItems = 0;

        // Callbacks
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        this.onErrorCallback = null;

        this.setupManager();
    }

    /**
     * Setup loading manager callbacks
     */
    setupManager() {
        this.manager.onStart = (url, itemsLoaded, itemsTotal) => {
            this.totalItems = itemsTotal;
            console.log(`Started loading: ${url}`);
        };

        this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
            this.loadedItems = itemsLoaded;
            const progress = itemsLoaded / itemsTotal;

            if (this.onProgressCallback) {
                this.onProgressCallback(progress, url, itemsLoaded, itemsTotal);
            }
        };

        this.manager.onLoad = () => {
            console.log('All assets loaded');
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
        };

        this.manager.onError = (url) => {
            console.error(`Error loading: ${url}`);
            if (this.onErrorCallback) {
                this.onErrorCallback(url);
            }
        };
    }

    /**
     * Set progress callback
     * @param {Function} callback - Progress callback function
     */
    onProgress(callback) {
        this.onProgressCallback = callback;
        return this;
    }

    /**
     * Set complete callback
     * @param {Function} callback - Complete callback function
     */
    onComplete(callback) {
        this.onCompleteCallback = callback;
        return this;
    }

    /**
     * Set error callback
     * @param {Function} callback - Error callback function
     */
    onError(callback) {
        this.onErrorCallback = callback;
        return this;
    }

    /**
     * Load a texture
     * @param {string} url - Texture URL
     * @returns {Promise<THREE.Texture>}
     */
    loadTexture(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    resolve(texture);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    /**
     * Load multiple textures
     * @param {Object} textureMap - Object with name: url pairs
     * @returns {Promise<Object>} - Object with name: texture pairs
     */
    async loadTextures(textureMap) {
        const textures = {};
        const promises = [];

        for (const [name, url] of Object.entries(textureMap)) {
            const promise = this.loadTexture(url).then((texture) => {
                textures[name] = texture;
            });
            promises.push(promise);
        }

        await Promise.all(promises);
        return textures;
    }

    /**
     * Load a cube texture (environment map)
     * @param {string} path - Path to cube texture folder
     * @param {Array<string>} files - Array of 6 file names [px, nx, py, ny, pz, nz]
     * @returns {Promise<THREE.CubeTexture>}
     */
    loadCubeTexture(path, files = ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.CubeTextureLoader(this.manager);
            loader.setPath(path);
            loader.load(
                files,
                (texture) => resolve(texture),
                undefined,
                (error) => reject(error)
            );
        });
    }

    /**
     * Get current loading progress (0-1)
     * @returns {number}
     */
    getProgress() {
        if (this.totalItems === 0) return 1;
        return this.loadedItems / this.totalItems;
    }
}

export default AssetLoader;
