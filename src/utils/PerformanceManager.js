/**
 * PerformanceManager.js
 * Adaptive Performance & LOD System
 *
 * Features:
 * - FPS monitoring and adaptive quality
 * - LOD (Level of Detail) management
 * - Memory management
 * - Device capability detection
 * - Automatic quality scaling
 * - Performance statistics
 */

import * as THREE from 'three';

/**
 * Performance quality levels
 */
const QualityLevels = {
    ULTRA: 'ultra',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    POTATO: 'potato'
};

// Alias for backwards compatibility
const QualityLevel = QualityLevels;

/**
 * Quality presets configuration
 */
const QualityPresets = {
    ultra: {
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        shadowMapSize: 4096,
        shadowsEnabled: true,
        particleCount: 50000,
        postProcessingEnabled: true,
        bloomEnabled: true,
        dofEnabled: true,
        antialias: true,
        maxLights: 10
    },
    high: {
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        shadowMapSize: 2048,
        shadowsEnabled: true,
        particleCount: 30000,
        postProcessingEnabled: true,
        bloomEnabled: true,
        dofEnabled: false,
        antialias: true,
        maxLights: 6
    },
    medium: {
        pixelRatio: 1,
        shadowMapSize: 1024,
        shadowsEnabled: true,
        particleCount: 15000,
        postProcessingEnabled: true,
        bloomEnabled: true,
        dofEnabled: false,
        antialias: false,
        maxLights: 4
    },
    low: {
        pixelRatio: 1,
        shadowMapSize: 512,
        shadowsEnabled: false,
        particleCount: 8000,
        postProcessingEnabled: false,
        bloomEnabled: false,
        dofEnabled: false,
        antialias: false,
        maxLights: 2
    },
    potato: {
        pixelRatio: 0.75,
        shadowMapSize: 256,
        shadowsEnabled: false,
        particleCount: 3000,
        postProcessingEnabled: false,
        bloomEnabled: false,
        dofEnabled: false,
        antialias: false,
        maxLights: 1
    }
};

/**
 * @class PerformanceManager
 * @description Manages adaptive performance and LOD
 */
class PerformanceManager {
    /**
     * Create performance manager
     * @param {THREE.WebGLRenderer} renderer - The WebGL renderer
     * @param {Object} options - Configuration options
     */
    constructor(renderer, options = {}) {
        const {
            targetFPS = 60,
            autoAdjust = true,
            initialQuality = QualityLevel.HIGH,
            minQuality = QualityLevel.LOW,
            qualityCheckInterval = 2000,
            fpsThresholdUp = 55,
            fpsThresholdDown = 30
        } = options;

        /** @type {THREE.WebGLRenderer} */
        this.renderer = renderer;

        this.targetFPS = targetFPS;
        this.adaptiveQuality = autoAdjust;
        this.currentQuality = initialQuality;
        this.currentLevel = initialQuality; // Alias for external access
        this.minQuality = minQuality;
        this.fpsCheckInterval = qualityCheckInterval;
        this.fpsThresholdUp = fpsThresholdUp;
        this.fpsThresholdDown = fpsThresholdDown;

        // FPS tracking
        this.fps = 60;
        this.fpsHistory = [];
        this.fpsHistoryLength = 30;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.lastCheckTime = performance.now();

        // Memory tracking
        this.memoryUsage = 0;
        this.geometryCount = 0;
        this.textureCount = 0;

        // Event callbacks
        this._eventCallbacks = {};

        // Device detection
        this.deviceCapabilities = this._detectDeviceCapabilities();

        // Set initial quality based on device
        if (this.deviceCapabilities.isMobile) {
            this.currentQuality = QualityLevel.MEDIUM;
            this.currentLevel = QualityLevel.MEDIUM;
        } else if (this.deviceCapabilities.isLowEnd) {
            this.currentQuality = QualityLevel.LOW;
            this.currentLevel = QualityLevel.LOW;
        }

        console.log('%c[PerformanceManager] Initialized', 'color: #44ff88;');
        console.log('[PerformanceManager] Device:', this.deviceCapabilities);
        console.log('[PerformanceManager] Initial quality:', this.currentQuality);
    }

    /**
     * Subscribe to events
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this._eventCallbacks[event]) {
            this._eventCallbacks[event] = [];
        }
        this._eventCallbacks[event].push(callback);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @private
     */
    _emit(event, data) {
        if (this._eventCallbacks[event]) {
            this._eventCallbacks[event].forEach(callback => callback(data));
        }
    }

    /**
     * Detect device capabilities
     * @returns {Object}
     * @private
     */
    _detectDeviceCapabilities() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

        let maxTextureSize = 4096;
        let maxVertexUniforms = 128;
        let renderer = 'Unknown';

        if (gl) {
            maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowEnd = maxTextureSize < 4096 || maxVertexUniforms < 256;
        const hasWebGL2 = !!canvas.getContext('webgl2');
        const deviceMemory = navigator.deviceMemory || 4;
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;

        return {
            isMobile,
            isLowEnd,
            hasWebGL2,
            maxTextureSize,
            maxVertexUniforms,
            renderer,
            deviceMemory,
            hardwareConcurrency,
            devicePixelRatio: window.devicePixelRatio
        };
    }

    /**
     * Update FPS counter (call every frame)
     * @param {number} deltaTime
     */
    update(deltaTime) {
        this.frameCount++;
        const currentTime = performance.now();

        // Calculate FPS every second
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastTime));
            this.fpsHistory.push(this.fps);

            if (this.fpsHistory.length > this.fpsHistoryLength) {
                this.fpsHistory.shift();
            }

            this.frameCount = 0;
            this.lastTime = currentTime;
        }

        // Check for quality adjustment
        if (this.adaptiveQuality && currentTime - this.lastCheckTime >= this.fpsCheckInterval) {
            this._checkQualityAdjustment();
            this.lastCheckTime = currentTime;
        }
    }

    /**
     * Check if quality should be adjusted
     * @private
     */
    _checkQualityAdjustment() {
        if (this.fpsHistory.length < 5) return;

        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        const qualityLevels = Object.values(QualityLevel);
        const currentIndex = qualityLevels.indexOf(this.currentQuality);
        const minIndex = qualityLevels.indexOf(this.minQuality);

        // Lower quality if FPS is too low
        if (avgFPS < this.fpsThresholdDown && currentIndex < qualityLevels.length - 1) {
            const newIndex = Math.min(currentIndex + 1, minIndex);
            this._setQuality(qualityLevels[newIndex]);
        }
        // Raise quality if FPS is good
        else if (avgFPS > this.fpsThresholdUp && currentIndex > 0) {
            this._setQuality(qualityLevels[currentIndex - 1]);
        }
    }

    /**
     * Set quality level
     * @param {string} quality
     * @private
     */
    _setQuality(quality) {
        if (quality === this.currentQuality) return;

        const previousQuality = this.currentQuality;
        this.currentQuality = quality;
        this.currentLevel = quality; // Keep alias in sync

        console.log(`%c[PerformanceManager] Quality changed: ${previousQuality} -> ${quality}`, 'color: #ffaa44;');

        // Emit event
        this._emit('qualityChange', {
            level: quality,
            previousLevel: previousQuality,
            preset: QualityPresets[quality]
        });
    }

    /**
     * Force set quality level
     * @param {string} quality
     */
    setQuality(quality) {
        if (!QualityPresets[quality]) {
            console.warn(`[PerformanceManager] Unknown quality level: ${quality}`);
            return;
        }
        this._setQuality(quality);
    }

    /**
     * Get current quality settings
     * @returns {Object}
     */
    getQualitySettings() {
        return QualityPresets[this.currentQuality];
    }

    /**
     * Get current quality preset (alias for getQualitySettings)
     * @returns {Object}
     */
    getQualityPreset() {
        return this.getQualitySettings();
    }

    /**
     * Get current FPS
     * @returns {number}
     */
    getFPS() {
        return this.fps;
    }

    /**
     * Get average FPS
     * @returns {number}
     */
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return 60;
        return Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
    }

    /**
     * Update memory stats from renderer
     * @param {THREE.WebGLRenderer} renderer
     */
    updateMemoryStats(renderer) {
        const info = renderer.info;
        this.geometryCount = info.memory.geometries;
        this.textureCount = info.memory.textures;

        if (performance.memory) {
            this.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576);
        }
    }

    /**
     * Get performance statistics
     * @returns {Object}
     */
    getStats() {
        return {
            fps: this.fps,
            averageFPS: this.getAverageFPS(),
            quality: this.currentQuality,
            memoryUsage: this.memoryUsage,
            geometryCount: this.geometryCount,
            textureCount: this.textureCount,
            device: this.deviceCapabilities
        };
    }

    /**
     * Check if effects should be enabled based on quality
     * @param {string} effectName
     * @returns {boolean}
     */
    shouldEnableEffect(effectName) {
        const settings = this.getQualitySettings();

        switch (effectName) {
            case 'shadows':
                return settings.shadowsEnabled;
            case 'postProcessing':
                return settings.postProcessingEnabled;
            case 'bloom':
                return settings.bloomEnabled;
            case 'dof':
                return settings.dofEnabled;
            case 'antialias':
                return settings.antialias;
            default:
                return true;
        }
    }

    /**
     * Get recommended particle count
     * @returns {number}
     */
    getRecommendedParticleCount() {
        return this.getQualitySettings().particleCount;
    }

    /**
     * Get recommended shadow map size
     * @returns {number}
     */
    getRecommendedShadowMapSize() {
        return this.getQualitySettings().shadowMapSize;
    }

    /**
     * Get recommended pixel ratio
     * @returns {number}
     */
    getRecommendedPixelRatio() {
        return this.getQualitySettings().pixelRatio;
    }

    /**
     * Enable/disable adaptive quality
     * @param {boolean} enabled
     */
    setAdaptiveQuality(enabled) {
        this.adaptiveQuality = enabled;
    }

    /**
     * Enable/disable auto adjust (alias for setAdaptiveQuality)
     * @param {boolean} enabled
     */
    setAutoAdjust(enabled) {
        this.setAdaptiveQuality(enabled);
    }

    /**
     * Set quality change callback
     * @param {Function} callback
     */
    setOnQualityChange(callback) {
        this.onQualityChange = callback;
    }

    /**
     * Dispose manager
     */
    dispose() {
        this.onQualityChange = null;
        this.fpsHistory = [];
        console.log('%c[PerformanceManager] Disposed', 'color: #44ff88;');
    }
}

export { PerformanceManager, QualityLevels, QualityLevel, QualityPresets };
export default PerformanceManager;
