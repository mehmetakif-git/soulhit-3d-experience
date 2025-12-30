/**
 * Time.js
 * Time Management System
 *
 * Tracks delta time, elapsed time, and manages
 * the animation loop with requestAnimationFrame.
 * Provides FPS calculation for performance monitoring.
 */

import { EventEmitter } from './EventEmitter.js';

/**
 * @class Time
 * @extends EventEmitter
 * @description Manages time tracking and animation loop
 */
class Time extends EventEmitter {
    constructor() {
        super();

        // ==========================================
        // Time Properties
        // ==========================================

        /** @type {number} Time when the application started */
        this.startTime = Date.now();

        /** @type {number} Current timestamp */
        this.currentTime = this.startTime;

        /** @type {number} Previous frame timestamp */
        this.previousTime = this.startTime;

        /** @type {number} Time elapsed since start (seconds) */
        this.elapsedTime = 0;

        /** @type {number} Time since last frame (seconds) */
        this.deltaTime = 0.016; // Default to ~60fps

        /** @type {number} Current frame number */
        this.frame = 0;

        // ==========================================
        // FPS Tracking
        // ==========================================

        /** @type {number[]} Array of recent frame times for FPS calculation */
        this.frameTimes = [];

        /** @type {number} Number of samples to average for FPS */
        this.fpsSampleSize = 60;

        /** @type {number} Current calculated FPS */
        this.fps = 60;

        // ==========================================
        // Animation Frame
        // ==========================================

        /** @type {number|null} requestAnimationFrame ID */
        this.rafId = null;

        /** @type {boolean} Whether the time loop is running */
        this.isRunning = false;

        // Start the loop
        this.start();
    }

    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.previousTime = Date.now();
        this.tick();

        console.log('%c[Time] Animation loop started', 'color: #88ff88;');
    }

    /**
     * Stop the animation loop
     */
    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        console.log('%c[Time] Animation loop stopped', 'color: #ff8888;');
    }

    /**
     * Main tick function - called every frame
     * @private
     */
    tick() {
        if (!this.isRunning) return;

        // Request next frame first for smooth timing
        this.rafId = requestAnimationFrame(() => this.tick());

        // Calculate times
        this.currentTime = Date.now();
        this.deltaTime = (this.currentTime - this.previousTime) / 1000; // Convert to seconds
        this.elapsedTime = (this.currentTime - this.startTime) / 1000;

        // Clamp deltaTime to prevent huge jumps (e.g., when tab is inactive)
        this.deltaTime = Math.min(this.deltaTime, 0.1);

        // Update FPS tracking
        this.updateFPS();

        // Increment frame counter
        this.frame++;

        // Store previous time
        this.previousTime = this.currentTime;

        // Emit tick event with timing data
        this.emit('tick', {
            deltaTime: this.deltaTime,
            elapsedTime: this.elapsedTime,
            frame: this.frame,
            fps: this.fps
        });
    }

    /**
     * Update FPS calculation
     * @private
     */
    updateFPS() {
        // Add current frame time
        this.frameTimes.push(this.deltaTime);

        // Keep only recent samples
        if (this.frameTimes.length > this.fpsSampleSize) {
            this.frameTimes.shift();
        }

        // Calculate average FPS
        if (this.frameTimes.length > 0) {
            const averageDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
            this.fps = Math.round(1 / averageDelta);
        }
    }

    /**
     * Get current timing data
     * @returns {Object} Timing data object
     */
    getTimingData() {
        return {
            deltaTime: this.deltaTime,
            elapsedTime: this.elapsedTime,
            frame: this.frame,
            fps: this.fps
        };
    }

    /**
     * Reset the timer
     */
    reset() {
        this.startTime = Date.now();
        this.currentTime = this.startTime;
        this.previousTime = this.startTime;
        this.elapsedTime = 0;
        this.deltaTime = 0.016;
        this.frame = 0;
        this.frameTimes = [];
        this.fps = 60;
    }

    /**
     * Clean up and stop the time loop
     */
    dispose() {
        this.stop();
        this.removeAllListeners();
    }
}

export { Time };
export default Time;
