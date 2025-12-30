/**
 * ScrollManager.js
 * Advanced Scroll-Based Camera & Animation Controller
 *
 * Features:
 * - Multi-scene camera paths with smooth interpolation
 * - Orbital camera movement support
 * - Scene triggers for element visibility
 * - Custom easing functions
 * - Smooth scroll interpolation
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { EventEmitter } from '../core/EventEmitter.js';

/**
 * Easing functions for smooth camera transitions
 */
const Easing = {
    linear: t => t,
    easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    easeIn: t => t * t * t,
    easeOut: t => 1 - Math.pow(1 - t, 3),
    easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
    easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    easeInOutBack: t => {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return t < 0.5
            ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
            : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
};

/**
 * Scene definitions for the scroll experience
 */
const SCENE_DEFINITIONS = [
    {
        name: 'hero',
        start: 0,
        end: 0.2,
        camera: {
            positionStart: { x: 0, y: 0, z: 15 },
            positionEnd: { x: 0, y: 2, z: 12 },
            lookAtStart: { x: 0, y: 0, z: 0 },
            lookAtEnd: { x: 0, y: -1, z: 0 }
        },
        easing: 'easeInOut',
        effects: {
            particleColor: { r: 0.27, g: 0.53, b: 1.0 },
            bloomStrength: 1.5,
            fogDensity: 0.02
        }
    },
    {
        name: 'underwater',
        start: 0.2,
        end: 0.4,
        camera: {
            positionStart: { x: 0, y: 2, z: 12 },
            positionEnd: { x: 0, y: -5, z: 8 },
            lookAtStart: { x: 0, y: -1, z: 0 },
            lookAtEnd: { x: 0, y: -3, z: 0 }
        },
        easing: 'easeInOutQuart',
        effects: {
            particleColor: { r: 0.2, g: 0.6, b: 0.8 },
            bloomStrength: 2.0,
            fogDensity: 0.05,
            tint: { r: 0.1, g: 0.3, b: 0.5 }
        }
    },
    {
        name: 'spineReveal',
        start: 0.4,
        end: 0.6,
        camera: {
            positionStart: { x: 0, y: -5, z: 8 },
            positionEnd: { x: 0, y: 0, z: 18 },
            lookAtStart: { x: 0, y: -3, z: 0 },
            lookAtEnd: { x: 0, y: 0, z: 0 }
        },
        easing: 'easeOutExpo',
        effects: {
            particleColor: { r: 1.0, g: 0.3, b: 0.5 },
            bloomStrength: 1.8,
            fogDensity: 0.015,
            spineVisible: true
        }
    },
    {
        name: 'orbital',
        start: 0.6,
        end: 0.8,
        camera: {
            orbital: true,
            radius: 14,
            height: 2,
            startAngle: Math.PI / 2,  // Start from front
            endAngle: Math.PI * 2.5,  // Full rotation + half
            lookAt: { x: 0, y: 0, z: 0 }
        },
        easing: 'easeInOut',
        effects: {
            particleColor: { r: 0.8, g: 0.4, b: 1.0 },
            bloomStrength: 2.2,
            cardsOrbit: true
        }
    },
    {
        name: 'final',
        start: 0.8,
        end: 1.0,
        camera: {
            // Continue from orbital end position
            positionStart: { x: 0, y: 2, z: 14 },
            positionEnd: { x: 0, y: 5, z: 25 },
            lookAtStart: { x: 0, y: 0, z: 0 },
            lookAtEnd: { x: 0, y: 0, z: 0 }
        },
        easing: 'easeOut',
        effects: {
            particleColor: { r: 0.27, g: 0.53, b: 1.0 },
            bloomStrength: 1.5,
            fogDensity: 0.01,
            finalReveal: true
        }
    }
];

/**
 * @class ScrollManager
 * @extends EventEmitter
 * @description Advanced scroll-based camera and animation controller
 */
class ScrollManager extends EventEmitter {
    /** @type {ScrollManager|null} Singleton instance */
    static instance = null;

    /**
     * Create scroll manager
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Singleton pattern
        if (ScrollManager.instance) {
            return ScrollManager.instance;
        }

        super();
        ScrollManager.instance = this;

        // ==========================================
        // Configuration
        // ==========================================

        const {
            smoothness = 0.08,
            threshold = 0.1,
            scenes = SCENE_DEFINITIONS
        } = options;

        /** @type {number} Smooth interpolation factor */
        this.smoothness = smoothness;

        /** @type {number} Threshold for triggering updates */
        this.threshold = threshold;

        /** @type {Array} Scene definitions */
        this.scenes = scenes;

        // ==========================================
        // Scroll State
        // ==========================================

        /** @type {number} Current scroll position */
        this.scrollY = 0;

        /** @type {number} Target scroll position */
        this.targetScrollY = 0;

        /** @type {number} Previous scroll position */
        this.previousScrollY = 0;

        /** @type {number} Scroll velocity */
        this.velocity = 0;

        /** @type {number} Normalized scroll progress (0-1) */
        this.progress = 0;

        /** @type {string} Scroll direction */
        this.direction = 'none';

        /** @type {string} Current scene name */
        this.currentScene = 'hero';

        /** @type {string} Previous scene name */
        this.previousScene = null;

        // ==========================================
        // Camera State
        // ==========================================

        /** @type {THREE.Vector3} Current camera position */
        this.cameraPosition = new THREE.Vector3(0, 0, 15);

        /** @type {THREE.Vector3} Current look-at target */
        this.lookAtTarget = new THREE.Vector3(0, 0, 0);

        /** @type {THREE.Vector3} Interpolated camera position */
        this.smoothCameraPosition = new THREE.Vector3(0, 0, 15);

        /** @type {THREE.Vector3} Interpolated look-at target */
        this.smoothLookAtTarget = new THREE.Vector3(0, 0, 0);

        // ==========================================
        // Document Dimensions
        // ==========================================

        /** @type {number} Viewport height */
        this.viewportHeight = window.innerHeight;

        /** @type {number} Document scrollable height */
        this.documentHeight = 0;

        // ==========================================
        // Sections (legacy support)
        // ==========================================

        /** @type {Array<Object>} Registered scroll sections */
        this.sections = [];

        // ==========================================
        // Initialize
        // ==========================================

        this._bindEvents();
        this._updateDimensions();

        console.log('%c[ScrollManager] Advanced camera system initialized', 'color: #44ffaa;');
        console.log(`%c[ScrollManager] ${this.scenes.length} scenes configured`, 'color: #44ffaa;');
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        this._handleScroll = this._handleScroll.bind(this);
        this._handleResize = this._handleResize.bind(this);

        window.addEventListener('scroll', this._handleScroll, { passive: true });
        window.addEventListener('resize', this._handleResize);
    }

    /**
     * Handle scroll events
     * @private
     */
    _handleScroll() {
        this.targetScrollY = window.scrollY;
    }

    /**
     * Handle window resize
     * @private
     */
    _handleResize() {
        this.viewportHeight = window.innerHeight;
        this._updateDimensions();
    }

    /**
     * Update document dimensions
     * @private
     */
    _updateDimensions() {
        this.documentHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        ) - this.viewportHeight;
    }

    /**
     * Add a scroll section (legacy support)
     * @param {Object} config - Section configuration
     * @returns {Object} Section reference
     */
    addSection(config) {
        const section = {
            id: config.id || `section-${this.sections.length}`,
            start: config.start || 0,
            end: config.end || 1,
            onEnter: config.onEnter || null,
            onLeave: config.onLeave || null,
            onProgress: config.onProgress || null,
            isActive: false,
            progress: 0
        };

        this.sections.push(section);
        return section;
    }

    /**
     * Remove a section by ID
     * @param {string} id - Section ID
     */
    removeSection(id) {
        const index = this.sections.findIndex(s => s.id === id);
        if (index > -1) {
            this.sections.splice(index, 1);
        }
    }

    /**
     * Get current scene based on progress
     * @returns {Object|null} Current scene definition
     */
    getCurrentSceneDefinition() {
        for (const scene of this.scenes) {
            if (this.progress >= scene.start && this.progress <= scene.end) {
                return scene;
            }
        }
        return this.scenes[this.scenes.length - 1];
    }

    /**
     * Calculate local progress within a scene
     * @param {Object} scene - Scene definition
     * @returns {number} Progress 0-1 within scene
     */
    getSceneLocalProgress(scene) {
        if (!scene) return 0;
        const range = scene.end - scene.start;
        if (range <= 0) return 0;
        return Math.max(0, Math.min(1, (this.progress - scene.start) / range));
    }

    /**
     * Interpolate between two values
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} t - Progress 0-1
     * @param {string} easingName - Easing function name
     * @returns {number}
     */
    interpolate(start, end, t, easingName = 'linear') {
        const easingFn = Easing[easingName] || Easing.linear;
        const easedT = easingFn(t);
        return start + (end - start) * easedT;
    }

    /**
     * Interpolate between two Vector3 objects
     * @param {Object} start - Start {x, y, z}
     * @param {Object} end - End {x, y, z}
     * @param {number} t - Progress 0-1
     * @param {string} easingName - Easing function name
     * @returns {THREE.Vector3}
     */
    interpolateVector3(start, end, t, easingName = 'linear') {
        return new THREE.Vector3(
            this.interpolate(start.x, end.x, t, easingName),
            this.interpolate(start.y, end.y, t, easingName),
            this.interpolate(start.z, end.z, t, easingName)
        );
    }

    /**
     * Calculate camera position for current scroll progress
     * @private
     */
    _calculateCameraPosition() {
        const scene = this.getCurrentSceneDefinition();
        if (!scene || !scene.camera) return;

        const localProgress = this.getSceneLocalProgress(scene);
        const easing = scene.easing || 'linear';

        if (scene.camera.orbital) {
            // Orbital camera movement
            const { radius, height, startAngle, endAngle, lookAt } = scene.camera;
            const angle = this.interpolate(startAngle, endAngle, localProgress, easing);

            this.cameraPosition.x = Math.cos(angle) * radius;
            this.cameraPosition.z = Math.sin(angle) * radius;
            this.cameraPosition.y = height;

            this.lookAtTarget.set(lookAt.x, lookAt.y, lookAt.z);
        } else {
            // Linear camera path
            const { positionStart, positionEnd, lookAtStart, lookAtEnd } = scene.camera;

            if (positionStart && positionEnd) {
                const newPos = this.interpolateVector3(positionStart, positionEnd, localProgress, easing);
                this.cameraPosition.copy(newPos);
            }

            if (lookAtStart && lookAtEnd) {
                const newLookAt = this.interpolateVector3(lookAtStart, lookAtEnd, localProgress, easing);
                this.lookAtTarget.copy(newLookAt);
            }
        }
    }

    /**
     * Update scroll manager (call in animation loop)
     * @param {number} deltaTime - Time since last frame
     * @param {THREE.Camera} camera - Camera to update (optional)
     */
    update(deltaTime, camera = null) {
        // Store previous position
        this.previousScrollY = this.scrollY;

        // Smooth interpolation
        this.scrollY += (this.targetScrollY - this.scrollY) * this.smoothness;

        // Calculate velocity
        this.velocity = this.scrollY - this.previousScrollY;

        // Determine direction
        if (Math.abs(this.velocity) > this.threshold) {
            this.direction = this.velocity > 0 ? 'down' : 'up';
        } else {
            this.direction = 'none';
        }

        // Calculate progress
        this.progress = this.documentHeight > 0
            ? Math.max(0, Math.min(1, this.scrollY / this.documentHeight))
            : 0;

        // Get current scene
        const currentSceneDef = this.getCurrentSceneDefinition();
        const sceneName = currentSceneDef ? currentSceneDef.name : 'hero';

        // Detect scene change
        if (sceneName !== this.currentScene) {
            this.previousScene = this.currentScene;
            this.currentScene = sceneName;

            // Emit scene change event
            this.emit('sceneChange', {
                from: this.previousScene,
                to: this.currentScene,
                scene: currentSceneDef
            });

            console.log(`%c[ScrollManager] Scene: ${this.previousScene} → ${this.currentScene}`, 'color: #ffaa44;');
        }

        // Calculate camera position
        this._calculateCameraPosition();

        // Smooth camera interpolation
        this.smoothCameraPosition.lerp(this.cameraPosition, this.smoothness * 2);
        this.smoothLookAtTarget.lerp(this.lookAtTarget, this.smoothness * 2);

        // Apply to camera if provided
        if (camera) {
            camera.position.copy(this.smoothCameraPosition);
            camera.lookAt(this.smoothLookAtTarget);
        }

        // Update legacy sections
        this._updateSections();

        // Emit update event with all data
        this.emit('update', {
            scrollY: this.scrollY,
            targetScrollY: this.targetScrollY,
            velocity: this.velocity,
            progress: this.progress,
            direction: this.direction,
            scene: this.currentScene,
            sceneDefinition: currentSceneDef,
            localProgress: this.getSceneLocalProgress(currentSceneDef),
            cameraPosition: this.smoothCameraPosition.clone(),
            lookAtTarget: this.smoothLookAtTarget.clone()
        });
    }

    /**
     * Update section states (legacy support)
     * @private
     */
    _updateSections() {
        this.sections.forEach(section => {
            const wasActive = section.isActive;

            // Check if scroll is within section range
            const isInSection = this.progress >= section.start && this.progress <= section.end;

            // Calculate section progress
            if (isInSection) {
                section.progress = (this.progress - section.start) / (section.end - section.start);
                section.progress = Math.max(0, Math.min(1, section.progress));
            }

            // Handle enter/leave
            if (isInSection && !wasActive) {
                section.isActive = true;
                if (section.onEnter) {
                    section.onEnter(section);
                }
                this.emit('sectionEnter', section);
            } else if (!isInSection && wasActive) {
                section.isActive = false;
                if (section.onLeave) {
                    section.onLeave(section);
                }
                this.emit('sectionLeave', section);
            }

            // Progress callback
            if (isInSection && section.onProgress) {
                section.onProgress(section.progress, section);
            }
        });
    }

    /**
     * Scroll to a specific position
     * @param {number} target - Target scroll position in pixels
     * @param {number} duration - Animation duration in seconds
     */
    scrollTo(target, duration = 1) {
        gsap.to(window, {
            duration,
            scrollTo: { y: target, autoKill: false },
            ease: 'power3.inOut'
        });
    }

    /**
     * Scroll to a specific progress
     * @param {number} progress - Target progress (0-1)
     * @param {number} duration - Animation duration in seconds
     */
    scrollToProgress(progress, duration = 1) {
        const target = progress * this.documentHeight;
        this.scrollTo(target, duration);
    }

    /**
     * Scroll to a specific scene
     * @param {string} sceneName - Scene name
     * @param {number} duration - Animation duration in seconds
     */
    scrollToScene(sceneName, duration = 1) {
        const scene = this.scenes.find(s => s.name === sceneName);
        if (scene) {
            this.scrollToProgress(scene.start, duration);
        }
    }

    /**
     * Get current scroll data
     * @returns {Object}
     */
    getScrollData() {
        return {
            scrollY: this.scrollY,
            targetScrollY: this.targetScrollY,
            velocity: this.velocity,
            progress: this.progress,
            direction: this.direction,
            scene: this.currentScene,
            localProgress: this.getSceneLocalProgress(this.getCurrentSceneDefinition())
        };
    }

    /**
     * Get camera state
     * @returns {Object}
     */
    getCameraState() {
        return {
            position: this.smoothCameraPosition.clone(),
            lookAt: this.smoothLookAtTarget.clone(),
            targetPosition: this.cameraPosition.clone(),
            targetLookAt: this.lookAtTarget.clone()
        };
    }

    /**
     * Get all scene definitions
     * @returns {Array}
     */
    getScenes() {
        return this.scenes;
    }

    /**
     * Clean up resources
     */
    dispose() {
        window.removeEventListener('scroll', this._handleScroll);
        window.removeEventListener('resize', this._handleResize);
        this.sections = [];
        this.removeAllListeners();
        ScrollManager.instance = null;

        console.log('%c[ScrollManager] Disposed', 'color: #44ffaa;');
    }
}

export { ScrollManager, SCENE_DEFINITIONS, Easing };
export default ScrollManager;
