/**
 * Camera.js
 * Camera Controller with Smooth Interpolation
 *
 * Manages the perspective camera with smooth lerp movement.
 * Provides look-at targeting with smooth interpolation.
 * Handles responsive aspect ratio updates.
 */

import * as THREE from 'three';

/**
 * @class CameraManager
 * @description Manages camera with smooth lerp interpolation
 */
class CameraManager {
    /** @type {CameraManager|null} Singleton instance */
    static instance = null;

    /**
     * Create camera manager
     * @param {Object} options - Camera configuration
     * @param {number} options.fov - Field of view (default: 45)
     * @param {number} options.near - Near clipping plane (default: 0.1)
     * @param {number} options.far - Far clipping plane (default: 100)
     * @param {Object} options.position - Initial position {x, y, z}
     * @param {number} options.lerpFactor - Smooth interpolation factor (default: 0.05)
     */
    constructor(options = {}) {
        // Singleton pattern
        if (CameraManager.instance) {
            return CameraManager.instance;
        }
        CameraManager.instance = this;

        // ==========================================
        // Configuration
        // ==========================================

        const {
            fov = 45,
            near = 0.1,
            far = 100,
            position = { x: 0, y: 0, z: 10 },
            lerpFactor = 0.05
        } = options;

        /** @type {number} Smooth interpolation factor */
        this.lerpFactor = lerpFactor;

        // ==========================================
        // Camera Setup
        // ==========================================

        /** @type {number} Aspect ratio */
        this.aspect = window.innerWidth / window.innerHeight;

        /** @type {THREE.PerspectiveCamera} Main camera */
        this.camera = new THREE.PerspectiveCamera(fov, this.aspect, near, far);

        // Set initial position
        this.camera.position.set(position.x, position.y, position.z);

        // ==========================================
        // Target Tracking (for smooth lerp)
        // ==========================================

        /** @type {THREE.Vector3} Target position for smooth movement */
        this.targetPosition = new THREE.Vector3(position.x, position.y, position.z);

        /** @type {THREE.Vector3} Current look-at point */
        this.lookAtPoint = new THREE.Vector3(0, 0, 0);

        /** @type {THREE.Vector3} Target look-at point for smooth interpolation */
        this.targetLookAt = new THREE.Vector3(0, 0, 0);

        /** @type {THREE.Vector3} Temporary vector for calculations */
        this._tempVector = new THREE.Vector3();

        /** @type {THREE.Vector3} Camera offset (for shake effects) */
        this._offset = new THREE.Vector3(0, 0, 0);

        /** @type {THREE.Vector3} Target offset (for device orientation) */
        this._targetOffset = new THREE.Vector3(0, 0, 0);

        /** @type {Object} Shake state */
        this._shake = {
            active: false,
            intensity: 0,
            duration: 0,
            elapsed: 0
        };

        // Initial look-at
        this.camera.lookAt(this.lookAtPoint);

        // ==========================================
        // Parallax Effect
        // ==========================================

        /** @type {Object} Mouse position normalized (-1 to 1) */
        this.mouse = { x: 0, y: 0 };

        /** @type {number} Parallax intensity */
        this.parallaxIntensity = 0.5;

        /** @type {boolean} Enable parallax effect */
        this.parallaxEnabled = true;

        // Bind mouse handler
        this.handleMouseMove = this.handleMouseMove.bind(this);
        window.addEventListener('mousemove', this.handleMouseMove);

        console.log('%c[Camera] Initialized with FOV:', 'color: #44aaff;', fov);
    }

    /**
     * Handle mouse movement for parallax
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    /**
     * Update camera - smooth lerp interpolation
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        // Update shake effect
        this._updateShake(deltaTime);

        // Lerp target offset
        this._offset.lerp(this._targetOffset, this.lerpFactor);

        // Apply parallax offset to target position
        if (this.parallaxEnabled) {
            const parallaxX = this.mouse.x * this.parallaxIntensity;
            const parallaxY = this.mouse.y * this.parallaxIntensity;

            this._tempVector.set(
                this.targetPosition.x + parallaxX + this._offset.x,
                this.targetPosition.y + parallaxY + this._offset.y,
                this.targetPosition.z + this._offset.z
            );

            // Smooth lerp to target position
            this.camera.position.lerp(this._tempVector, this.lerpFactor);
        } else {
            // Smooth lerp to target position without parallax
            this._tempVector.copy(this.targetPosition).add(this._offset);
            this.camera.position.lerp(this._tempVector, this.lerpFactor);
        }

        // Smooth lerp for look-at target
        this.lookAtPoint.lerp(this.targetLookAt, this.lerpFactor);
        this.camera.lookAt(this.lookAtPoint);
    }

    /**
     * Update camera shake effect
     * @param {number} deltaTime
     * @private
     */
    _updateShake(deltaTime) {
        if (!this._shake.active) return;

        this._shake.elapsed += deltaTime;

        if (this._shake.elapsed >= this._shake.duration) {
            // Shake complete
            this._shake.active = false;
            this._offset.set(0, 0, 0);
            return;
        }

        // Calculate remaining intensity (fade out)
        const progress = this._shake.elapsed / this._shake.duration;
        const currentIntensity = this._shake.intensity * (1 - progress);

        // Random offset
        this._offset.set(
            (Math.random() - 0.5) * 2 * currentIntensity,
            (Math.random() - 0.5) * 2 * currentIntensity,
            0
        );
    }

    /**
     * Trigger camera shake effect
     * @param {number} intensity - Shake intensity (default: 0.1)
     * @param {number} duration - Shake duration in seconds (default: 0.5)
     */
    shake(intensity = 0.1, duration = 0.5) {
        this._shake.active = true;
        this._shake.intensity = intensity;
        this._shake.duration = duration;
        this._shake.elapsed = 0;
    }

    /**
     * Set target offset (for device orientation effects)
     * @param {number} x - X offset
     * @param {number} y - Y offset
     */
    setTargetOffset(x, y) {
        this._targetOffset.set(x, y, 0);
    }

    /**
     * Set camera target position (will lerp to it)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     */
    setPosition(x, y, z) {
        this.targetPosition.set(x, y, z);
    }

    /**
     * Set camera position immediately (no lerp)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     */
    setPositionImmediate(x, y, z) {
        this.targetPosition.set(x, y, z);
        this.camera.position.set(x, y, z);
    }

    /**
     * Set look-at target (will lerp to it)
     * @param {number} x - X target
     * @param {number} y - Y target
     * @param {number} z - Z target
     */
    lookAt(x, y, z) {
        this.targetLookAt.set(x, y, z);
    }

    /**
     * Set look-at immediately (no lerp)
     * @param {number} x - X target
     * @param {number} y - Y target
     * @param {number} z - Z target
     */
    lookAtImmediate(x, y, z) {
        this.targetLookAt.set(x, y, z);
        this.lookAtPoint.set(x, y, z);
        this.camera.lookAt(this.lookAtPoint);
    }

    /**
     * Set lerp factor for smooth movement
     * @param {number} factor - Lerp factor (0-1, lower = smoother)
     */
    setLerpFactor(factor) {
        this.lerpFactor = Math.max(0.01, Math.min(1, factor));
    }

    /**
     * Set parallax intensity
     * @param {number} intensity - Parallax intensity
     */
    setParallaxIntensity(intensity) {
        this.parallaxIntensity = intensity;
    }

    /**
     * Enable/disable parallax effect
     * @param {boolean} enabled
     */
    setParallaxEnabled(enabled) {
        this.parallaxEnabled = enabled;
    }

    /**
     * Handle window resize
     * @param {Object} sizes - Viewport sizes
     */
    handleResize(sizes) {
        this.aspect = sizes.width / sizes.height;
        this.camera.aspect = this.aspect;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Get the camera instance
     * @returns {THREE.PerspectiveCamera}
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Get camera position
     * @returns {THREE.Vector3}
     */
    getPosition() {
        return this.camera.position.clone();
    }

    /**
     * Clean up resources
     */
    dispose() {
        window.removeEventListener('mousemove', this.handleMouseMove);
        CameraManager.instance = null;
    }
}

export { CameraManager };
export default CameraManager;
