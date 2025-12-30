/**
 * MobileSupport.js
 * Mobile Device Support & Touch Gestures
 *
 * Features:
 * - Touch event handling
 * - Pinch-to-zoom
 * - Swipe gestures
 * - Device orientation
 * - Responsive viewport
 * - Touch-friendly UI adjustments
 */

import * as THREE from 'three';

/**
 * @class MobileSupport
 * @description Manages mobile/touch interactions
 */
class MobileSupport {
    /**
     * Create mobile support manager
     * @param {HTMLElement} element - Target element for touch events
     * @param {Object} options - Configuration options
     */
    constructor(element = document.body, options = {}) {
        const {
            enablePinch = true,
            enablePinchZoom = true,
            enableSwipe = true,
            enableDoubleTap = true,
            enableOrientation = false,
            swipeThreshold = 50,
            tapThreshold = 200
        } = options;

        this.element = element || document.body;
        this.enablePinchZoom = enablePinch || enablePinchZoom;
        this.enableSwipe = enableSwipe;
        this.enableDoubleTap = enableDoubleTap;
        this.enableOrientation = enableOrientation;
        this.swipeThreshold = swipeThreshold;
        this.tapThreshold = tapThreshold;

        // Touch state
        this.touches = [];
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.lastTouchPos = { x: 0, y: 0 };
        this.pinchStartDistance = 0;
        this.currentZoom = 1;

        // Device orientation
        this.orientation = { alpha: 0, beta: 0, gamma: 0 };
        this.orientationEnabled = false;

        // Event callbacks (legacy)
        this.onTap = null;
        this.onDoubleTap = null;
        this.onSwipe = null;
        this.onPinch = null;
        this.onPan = null;
        this.onOrientationChange = null;

        // Event system callbacks
        this._eventCallbacks = {};

        // Double tap detection
        this.lastTapTime = 0;
        this.doubleTapDelay = 300;

        // Detect device
        this.isMobile = this._detectMobile();
        this.hasTouch = 'ontouchstart' in window;

        // Initialize
        if (this.hasTouch) {
            this._init();
        }

        // Setup viewport
        this._setupViewport();

        console.log('%c[MobileSupport] Initialized', 'color: #ff88ff;');
        console.log('[MobileSupport] Mobile device:', this.isMobile);
    }

    /**
     * Subscribe to events
     * @param {string} event - Event name (tap, doubleTap, swipe, pinch, pan, orientation)
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
     * Detect if device is mobile
     * @returns {boolean}
     * @private
     */
    _detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }

    /**
     * Initialize touch events
     * @private
     */
    _init() {
        // Touch events
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        this.element.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this.element.addEventListener('touchmove', this._onTouchMove, { passive: false });
        this.element.addEventListener('touchend', this._onTouchEnd, { passive: false });
        this.element.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

        // Device orientation
        if (this.enableOrientation) {
            this._requestOrientationPermission();
        }

        // Prevent default behaviors
        this._preventDefaults();
    }

    /**
     * Setup viewport meta tag
     * @private
     */
    _setupViewport() {
        let viewport = document.querySelector('meta[name="viewport"]');

        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }

        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

        // Add mobile-specific styles
        const style = document.createElement('style');
        style.textContent = `
            html, body {
                touch-action: manipulation;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
                overscroll-behavior: none;
            }

            canvas {
                touch-action: none;
            }

            /* iOS safe area support */
            body {
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
            }

            /* Prevent pull-to-refresh */
            body {
                overscroll-behavior-y: contain;
            }
        `;
        document.head.appendChild(style);
        this.styleElement = style;
    }

    /**
     * Prevent default touch behaviors
     * @private
     */
    _preventDefaults() {
        // Prevent zoom on double tap
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());
        document.addEventListener('gestureend', (e) => e.preventDefault());

        // Prevent scroll bounce on iOS
        document.body.addEventListener('touchmove', (e) => {
            if (e.target === this.element || this.element.contains(e.target)) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * Request device orientation permission (iOS 13+)
     * @private
     */
    async _requestOrientationPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this._enableOrientation();
                }
            } catch (err) {
                console.warn('[MobileSupport] Orientation permission denied:', err);
            }
        } else {
            this._enableOrientation();
        }
    }

    /**
     * Enable device orientation tracking
     * @private
     */
    _enableOrientation() {
        this._onDeviceOrientation = this._onDeviceOrientation.bind(this);
        window.addEventListener('deviceorientation', this._onDeviceOrientation);
        this.orientationEnabled = true;
    }

    /**
     * Handle device orientation change
     * @param {DeviceOrientationEvent} event
     * @private
     */
    _onDeviceOrientation(event) {
        this.orientation = {
            alpha: event.alpha || 0, // Z axis (0-360)
            beta: event.beta || 0,   // X axis (-180 to 180)
            gamma: event.gamma || 0  // Y axis (-90 to 90)
        };

        // Emit event
        this._emit('orientation', this.orientation);

        // Legacy callback
        if (this.onOrientationChange) {
            this.onOrientationChange(this.orientation);
        }
    }

    /**
     * Handle touch start
     * @param {TouchEvent} event
     * @private
     */
    _onTouchStart(event) {
        this.touches = Array.from(event.touches);
        this.touchStartTime = Date.now();

        if (this.touches.length === 1) {
            // Single touch - potential tap or pan
            const touch = this.touches[0];
            this.touchStartPos = { x: touch.clientX, y: touch.clientY };
            this.lastTouchPos = { ...this.touchStartPos };
        } else if (this.touches.length === 2 && this.enablePinchZoom) {
            // Two touches - pinch gesture
            this.pinchStartDistance = this._getDistance(this.touches[0], this.touches[1]);
        }
    }

    /**
     * Handle touch move
     * @param {TouchEvent} event
     * @private
     */
    _onTouchMove(event) {
        event.preventDefault();
        this.touches = Array.from(event.touches);

        if (this.touches.length === 1) {
            // Single touch - pan
            const touch = this.touches[0];
            const deltaX = touch.clientX - this.lastTouchPos.x;
            const deltaY = touch.clientY - this.lastTouchPos.y;

            const panData = {
                deltaX,
                deltaY,
                x: touch.clientX,
                y: touch.clientY,
                center: { x: touch.clientX, y: touch.clientY },
                normalizedX: (touch.clientX / window.innerWidth) * 2 - 1,
                normalizedY: -(touch.clientY / window.innerHeight) * 2 + 1
            };

            // Emit event
            this._emit('pan', panData);

            // Legacy callback
            if (this.onPan) {
                this.onPan(panData);
            }

            this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
        } else if (this.touches.length === 2 && this.enablePinchZoom) {
            // Pinch gesture
            const currentDistance = this._getDistance(this.touches[0], this.touches[1]);
            const scale = currentDistance / this.pinchStartDistance;
            const delta = scale;

            const pinchData = {
                scale,
                delta,
                center: this._getCenter(this.touches[0], this.touches[1])
            };

            // Emit event
            this._emit('pinch', pinchData);

            // Legacy callback
            if (this.onPinch) {
                this.onPinch(pinchData);
            }
        }
    }

    /**
     * Handle touch end
     * @param {TouchEvent} event
     * @private
     */
    _onTouchEnd(event) {
        const touchDuration = Date.now() - this.touchStartTime;
        const touchDistance = this._getDistance(
            { clientX: this.touchStartPos.x, clientY: this.touchStartPos.y },
            { clientX: this.lastTouchPos.x, clientY: this.lastTouchPos.y }
        );

        // Detect tap
        if (touchDuration < this.tapThreshold && touchDistance < 10) {
            const now = Date.now();

            // Double tap check
            if (now - this.lastTapTime < this.doubleTapDelay && this.enableDoubleTap) {
                const doubleTapData = {
                    x: this.touchStartPos.x,
                    y: this.touchStartPos.y
                };

                // Emit event
                this._emit('doubleTap', doubleTapData);

                // Legacy callback
                if (this.onDoubleTap) {
                    this.onDoubleTap(doubleTapData);
                }
                this.lastTapTime = 0;
            } else {
                // Single tap
                const tapData = {
                    x: this.touchStartPos.x,
                    y: this.touchStartPos.y,
                    normalizedX: (this.touchStartPos.x / window.innerWidth) * 2 - 1,
                    normalizedY: -(this.touchStartPos.y / window.innerHeight) * 2 + 1
                };

                // Emit event
                this._emit('tap', tapData);

                // Legacy callback
                if (this.onTap) {
                    this.onTap(tapData);
                }
                this.lastTapTime = now;
            }
        }

        // Detect swipe
        if (this.enableSwipe && touchDistance > this.swipeThreshold && touchDuration < 500) {
            const deltaX = this.lastTouchPos.x - this.touchStartPos.x;
            const deltaY = this.lastTouchPos.y - this.touchStartPos.y;

            let direction;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }

            const swipeData = {
                direction,
                deltaX,
                deltaY,
                velocity: touchDistance / touchDuration
            };

            // Emit event
            this._emit('swipe', swipeData);

            // Legacy callback
            if (this.onSwipe) {
                this.onSwipe(swipeData);
            }
        }

        this.touches = [];
    }

    /**
     * Get distance between two touch points
     * @param {Touch} touch1
     * @param {Touch} touch2
     * @returns {number}
     * @private
     */
    _getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get center point between two touches
     * @param {Touch} touch1
     * @param {Touch} touch2
     * @returns {Object}
     * @private
     */
    _getCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }

    /**
     * Get normalized touch position for Three.js
     * @param {Object} touchPos
     * @returns {THREE.Vector2}
     */
    getNormalizedPosition(touchPos) {
        return new THREE.Vector2(
            (touchPos.x / window.innerWidth) * 2 - 1,
            -(touchPos.y / window.innerHeight) * 2 + 1
        );
    }

    /**
     * Check if device is mobile
     * @returns {boolean}
     */
    isMobileDevice() {
        return this.isMobile;
    }

    /**
     * Check if device has touch support
     * @returns {boolean}
     */
    hasTouchSupport() {
        return this.hasTouch;
    }

    /**
     * Get current orientation data
     * @returns {Object}
     */
    getOrientation() {
        return this.orientation;
    }

    /**
     * Set tap callback
     * @param {Function} callback
     */
    setOnTap(callback) {
        this.onTap = callback;
    }

    /**
     * Set double tap callback
     * @param {Function} callback
     */
    setOnDoubleTap(callback) {
        this.onDoubleTap = callback;
    }

    /**
     * Set swipe callback
     * @param {Function} callback
     */
    setOnSwipe(callback) {
        this.onSwipe = callback;
    }

    /**
     * Set pinch callback
     * @param {Function} callback
     */
    setOnPinch(callback) {
        this.onPinch = callback;
    }

    /**
     * Set pan callback
     * @param {Function} callback
     */
    setOnPan(callback) {
        this.onPan = callback;
    }

    /**
     * Set orientation change callback
     * @param {Function} callback
     */
    setOnOrientationChange(callback) {
        this.onOrientationChange = callback;
    }

    /**
     * Clean up
     */
    dispose() {
        // Remove touch events
        this.element.removeEventListener('touchstart', this._onTouchStart);
        this.element.removeEventListener('touchmove', this._onTouchMove);
        this.element.removeEventListener('touchend', this._onTouchEnd);
        this.element.removeEventListener('touchcancel', this._onTouchEnd);

        // Remove orientation listener
        if (this.orientationEnabled) {
            window.removeEventListener('deviceorientation', this._onDeviceOrientation);
        }

        // Remove style
        if (this.styleElement) {
            this.styleElement.remove();
        }

        console.log('%c[MobileSupport] Disposed', 'color: #ff88ff;');
    }
}

export { MobileSupport };
export default MobileSupport;
