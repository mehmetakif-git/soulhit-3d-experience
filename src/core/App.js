/**
 * App.js
 * Main Application Class - Singleton Pattern
 *
 * Central hub for the entire 3D experience.
 * Manages initialization, update loop, and cleanup.
 * Uses event-driven architecture for communication between modules.
 */

import * as THREE from 'three';
import { EventEmitter } from './EventEmitter.js';
import { Time } from './Time.js';
import { SceneManager } from './Scene.js';
import { CameraManager } from './Camera.js';
import { RendererManager } from './Renderer.js';
import { Debug } from '../utils/Debug.js';

/**
 * @class App
 * @extends EventEmitter
 * @description Main application singleton that orchestrates all 3D components
 */
class App extends EventEmitter {
    /** @type {App|null} Singleton instance */
    static instance = null;

    /**
     * Creates or returns the singleton App instance
     * @param {HTMLCanvasElement} [canvas] - Canvas element for WebGL rendering
     */
    constructor(canvas) {
        // Singleton pattern - return existing instance if available
        if (App.instance) {
            return App.instance;
        }

        super();
        App.instance = this;

        // ==========================================
        // Core Properties
        // ==========================================

        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;

        /** @type {Object} Viewport dimensions */
        this.sizes = {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: Math.min(window.devicePixelRatio, 2)
        };

        /** @type {boolean} Debug mode flag */
        this.debug = window.location.hash === '#debug';

        // ==========================================
        // Initialize Core Systems
        // ==========================================

        // Debug GUI (only in debug mode)
        if (this.debug) {
            this.debugUI = new Debug();
            console.log('%c[DEBUG MODE ENABLED]', 'color: #00ff00; font-weight: bold;');
        }

        // Time tracking system
        this.time = new Time();

        // Scene manager
        this.sceneManager = new SceneManager();
        this.scene = this.sceneManager.getScene();

        // Camera manager with smooth interpolation
        this.cameraManager = new CameraManager({
            fov: 45,
            near: 0.1,
            far: 100,
            position: { x: 0, y: 0, z: 10 }
        });
        this.camera = this.cameraManager.getCamera();

        // Renderer manager with WebGL 2.0
        this.rendererManager = new RendererManager(this.canvas, {
            antialias: true,
            alpha: true,
            shadows: true
        });
        this.renderer = this.rendererManager.getRenderer();

        // ==========================================
        // Event Bindings
        // ==========================================

        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);

        // Time update events
        this.time.on('tick', () => this.update());

        // Log initialization
        console.log(`%c[App] Initialized - Three.js r${THREE.REVISION}`, 'color: #4488ff;');
    }

    /**
     * Handle window resize events
     * Updates sizes and notifies all managers
     */
    handleResize() {
        // Update sizes
        this.sizes.width = window.innerWidth;
        this.sizes.height = window.innerHeight;
        this.sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

        // Notify managers
        this.cameraManager.handleResize(this.sizes);
        this.rendererManager.handleResize(this.sizes);

        // Emit resize event for other listeners
        this.emit('resize', this.sizes);
    }

    /**
     * Main update loop - called every frame
     * Updates all managers and renders the scene
     */
    update() {
        const { deltaTime, elapsedTime } = this.time;

        // Update camera (smooth interpolation)
        this.cameraManager.update(deltaTime);

        // Emit update event for external listeners
        this.emit('update', { deltaTime, elapsedTime });

        // Render the scene
        this.rendererManager.render(this.scene, this.camera);
    }

    /**
     * Clean up and dispose all resources
     * Should be called when destroying the application
     */
    dispose() {
        console.log('%c[App] Disposing resources...', 'color: #ff8800;');

        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);

        // Stop time updates
        this.time.dispose();

        // Dispose managers
        this.cameraManager.dispose();
        this.rendererManager.dispose();
        this.sceneManager.dispose();

        // Dispose debug UI
        if (this.debugUI) {
            this.debugUI.dispose();
        }

        // Clear singleton
        App.instance = null;

        // Emit dispose event
        this.emit('dispose');

        console.log('%c[App] Disposed successfully', 'color: #00ff00;');
    }

    /**
     * Get the singleton instance
     * @returns {App|null}
     */
    static getInstance() {
        return App.instance;
    }
}

export { App };
export default App;
