/**
 * Renderer.js
 * WebGL 2.0 Renderer Manager
 *
 * Production-ready WebGL renderer with:
 * - WebGL 2.0 context
 * - Shadow mapping
 * - Antialiasing
 * - High-performance settings
 * - Tone mapping
 */

import * as THREE from 'three';

/**
 * @class RendererManager
 * @description Manages WebGL 2.0 renderer with production settings
 */
class RendererManager {
    /** @type {RendererManager|null} Singleton instance */
    static instance = null;

    /**
     * Create renderer manager
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Object} options - Renderer configuration
     * @param {boolean} options.antialias - Enable antialiasing (default: true)
     * @param {boolean} options.alpha - Enable alpha channel (default: true)
     * @param {boolean} options.shadows - Enable shadow maps (default: true)
     * @param {string} options.powerPreference - Power preference (default: 'high-performance')
     */
    constructor(canvas, options = {}) {
        // Singleton pattern
        if (RendererManager.instance) {
            return RendererManager.instance;
        }
        RendererManager.instance = this;

        // ==========================================
        // Configuration
        // ==========================================

        const {
            antialias = true,
            alpha = true,
            shadows = true,
            powerPreference = 'high-performance'
        } = options;

        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;

        // ==========================================
        // Create WebGL 2.0 Renderer
        // ==========================================

        /** @type {THREE.WebGLRenderer} */
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias,
            alpha,
            powerPreference
        });

        // ==========================================
        // Renderer Settings
        // ==========================================

        // Pixel ratio (capped at 2 for performance)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Initial size
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Color settings
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Tone mapping for HDR-like visuals
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // ==========================================
        // Shadow Settings
        // ==========================================

        if (shadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = true;
        }

        // ==========================================
        // Clear Color
        // ==========================================

        this.renderer.setClearColor(0x000000, alpha ? 0 : 1);

        // ==========================================
        // Performance Logging
        // ==========================================

        this.logCapabilities();
    }

    /**
     * Log WebGL capabilities for debugging
     */
    logCapabilities() {
        const gl = this.renderer.getContext();
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

        console.log('%c[Renderer] WebGL Configuration:', 'color: #ff8844; font-weight: bold;');
        console.log(`  WebGL Version: ${gl.getParameter(gl.VERSION)}`);
        console.log(`  GLSL Version: ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`);

        if (debugInfo) {
            console.log(`  GPU: ${gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`);
            console.log(`  Vendor: ${gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}`);
        }

        console.log(`  Max Texture Size: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
        console.log(`  Max Vertex Attribs: ${gl.getParameter(gl.MAX_VERTEX_ATTRIBS)}`);
        console.log(`  Pixel Ratio: ${this.renderer.getPixelRatio()}`);
        console.log(`  Shadow Maps: ${this.renderer.shadowMap.enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Handle window resize
     * @param {Object} sizes - Viewport sizes {width, height, pixelRatio}
     */
    handleResize(sizes) {
        this.renderer.setSize(sizes.width, sizes.height);
        this.renderer.setPixelRatio(sizes.pixelRatio);
    }

    /**
     * Render a scene with a camera
     * @param {THREE.Scene} scene - Scene to render
     * @param {THREE.Camera} camera - Camera to use
     */
    render(scene, camera) {
        this.renderer.render(scene, camera);
    }

    /**
     * Set tone mapping exposure
     * @param {number} exposure - Exposure value
     */
    setExposure(exposure) {
        this.renderer.toneMappingExposure = exposure;
    }

    /**
     * Set tone mapping type
     * @param {THREE.ToneMapping} toneMapping - Tone mapping type
     */
    setToneMapping(toneMapping) {
        this.renderer.toneMapping = toneMapping;
    }

    /**
     * Set clear color
     * @param {number} color - Hex color
     * @param {number} alpha - Alpha value (0-1)
     */
    setClearColor(color, alpha = 1) {
        this.renderer.setClearColor(color, alpha);
    }

    /**
     * Enable/disable shadows
     * @param {boolean} enabled
     */
    setShadowsEnabled(enabled) {
        this.renderer.shadowMap.enabled = enabled;
    }

    /**
     * Get the renderer instance
     * @returns {THREE.WebGLRenderer}
     */
    getRenderer() {
        return this.renderer;
    }

    /**
     * Get the canvas element
     * @returns {HTMLCanvasElement}
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Get render info (for debugging)
     * @returns {Object}
     */
    getInfo() {
        return {
            render: this.renderer.info.render,
            memory: this.renderer.info.memory,
            programs: this.renderer.info.programs?.length || 0
        };
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        RendererManager.instance = null;

        console.log('%c[Renderer] Disposed', 'color: #ff8844;');
    }
}

export { RendererManager };
export default RendererManager;
