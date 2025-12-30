/**
 * CursorEffects.js
 * Custom Cursor with Trail and Ripple Effects
 *
 * Features:
 * - Custom cursor replacement
 * - Smooth cursor trail
 * - Click ripple animations
 * - Hover state transitions
 * - Mobile touch support
 */

import gsap from 'gsap';

/**
 * @class CursorEffects
 * @description Manages custom cursor visuals and interactions
 */
class CursorEffects {
    /**
     * Create cursor effects manager
     * @param {Object} options
     */
    constructor(options = {}) {
        const {
            enabled = true,
            cursorSize = 20,
            cursorColor = '#4488ff',
            trailLength = 8,
            trailFade = true,
            rippleEnabled = true,
            rippleColor = '#4488ff',
            rippleSize = 100,
            hideNativeCursor = true
        } = options;

        this.enabled = enabled;
        this.cursorSize = cursorSize;
        this.cursorColor = cursorColor;
        this.trailLength = trailLength;
        this.trailFade = trailFade;
        this.rippleEnabled = rippleEnabled;
        this.rippleColor = rippleColor;
        this.rippleSize = rippleSize;
        this.hideNativeCursor = hideNativeCursor;

        /** @type {Object} Current cursor position */
        this.position = { x: 0, y: 0 };

        /** @type {Object} Target position (for lerp) */
        this.target = { x: 0, y: 0 };

        /** @type {boolean} Is cursor hovering interactive element */
        this.isHovering = false;

        /** @type {boolean} Is cursor pressed */
        this.isPressed = false;

        /** @type {Array} Trail particles */
        this.trail = [];

        /** @type {HTMLElement} Container element */
        this.container = null;

        /** @type {HTMLElement} Main cursor element */
        this.cursorElement = null;

        /** @type {HTMLElement} Cursor ring element */
        this.ringElement = null;

        /** @type {number} Animation frame ID */
        this.rafId = null;

        /** @type {boolean} Is touch device */
        this.isTouchDevice = 'ontouchstart' in window;

        // Don't initialize on touch devices
        if (!this.isTouchDevice && this.enabled) {
            this._init();
        }

        console.log('%c[CursorEffects] Initialized', 'color: #88ffaa;');
    }

    /**
     * Initialize cursor elements and events
     * @private
     */
    _init() {
        this._createElements();
        this._createStyles();
        this._bindEvents();
        this._startAnimation();

        if (this.hideNativeCursor) {
            document.body.style.cursor = 'none';
        }
    }

    /**
     * Create DOM elements for cursor
     * @private
     */
    _createElements() {
        // Container
        this.container = document.createElement('div');
        this.container.className = 'cursor-effects-container';
        document.body.appendChild(this.container);

        // Main cursor dot
        this.cursorElement = document.createElement('div');
        this.cursorElement.className = 'cursor-dot';
        this.container.appendChild(this.cursorElement);

        // Cursor ring
        this.ringElement = document.createElement('div');
        this.ringElement.className = 'cursor-ring';
        this.container.appendChild(this.ringElement);

        // Trail elements
        for (let i = 0; i < this.trailLength; i++) {
            const trail = document.createElement('div');
            trail.className = 'cursor-trail';
            trail.style.opacity = this.trailFade ? (1 - i / this.trailLength) * 0.5 : 0.3;
            this.container.appendChild(trail);
            this.trail.push({
                element: trail,
                x: 0,
                y: 0
            });
        }
    }

    /**
     * Create CSS styles
     * @private
     */
    _createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .cursor-effects-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 10000;
                overflow: hidden;
            }

            .cursor-dot {
                position: absolute;
                width: ${this.cursorSize * 0.4}px;
                height: ${this.cursorSize * 0.4}px;
                background: ${this.cursorColor};
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: transform 0.1s ease, background 0.2s ease;
                box-shadow: 0 0 10px ${this.cursorColor}80;
            }

            .cursor-dot.hovering {
                transform: translate(-50%, -50%) scale(0.5);
                background: #ffffff;
            }

            .cursor-dot.pressed {
                transform: translate(-50%, -50%) scale(0.3);
            }

            .cursor-ring {
                position: absolute;
                width: ${this.cursorSize}px;
                height: ${this.cursorSize}px;
                border: 2px solid ${this.cursorColor};
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: transform 0.15s ease, border-color 0.2s ease, width 0.2s ease, height 0.2s ease;
                opacity: 0.8;
            }

            .cursor-ring.hovering {
                width: ${this.cursorSize * 2}px;
                height: ${this.cursorSize * 2}px;
                border-color: #ffffff;
                opacity: 0.5;
            }

            .cursor-ring.pressed {
                transform: translate(-50%, -50%) scale(0.8);
                border-color: #ffffff;
            }

            .cursor-trail {
                position: absolute;
                width: ${this.cursorSize * 0.3}px;
                height: ${this.cursorSize * 0.3}px;
                background: ${this.cursorColor};
                border-radius: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
            }

            .cursor-ripple {
                position: absolute;
                border: 2px solid ${this.rippleColor};
                border-radius: 50%;
                transform: translate(-50%, -50%) scale(0);
                opacity: 1;
                pointer-events: none;
            }

            /* Hide cursor on interactive elements */
            a, button, [data-cursor-hover] {
                cursor: none !important;
            }
        `;
        document.head.appendChild(style);
        this.styleElement = style;
    }

    /**
     * Bind mouse events
     * @private
     */
    _bindEvents() {
        // Mouse move
        this._onMouseMove = this._onMouseMove.bind(this);
        window.addEventListener('mousemove', this._onMouseMove, { passive: true });

        // Mouse down/up
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);

        // Hover detection
        this._onMouseOver = this._onMouseOver.bind(this);
        this._onMouseOut = this._onMouseOut.bind(this);
        document.addEventListener('mouseover', this._onMouseOver);
        document.addEventListener('mouseout', this._onMouseOut);

        // Window blur/focus
        this._onWindowBlur = this._onWindowBlur.bind(this);
        this._onWindowFocus = this._onWindowFocus.bind(this);
        window.addEventListener('blur', this._onWindowBlur);
        window.addEventListener('focus', this._onWindowFocus);
    }

    /**
     * Handle mouse move
     * @param {MouseEvent} event
     * @private
     */
    _onMouseMove(event) {
        this.target.x = event.clientX;
        this.target.y = event.clientY;
    }

    /**
     * Handle mouse down
     * @param {MouseEvent} event
     * @private
     */
    _onMouseDown(event) {
        this.isPressed = true;
        this.cursorElement.classList.add('pressed');
        this.ringElement.classList.add('pressed');

        if (this.rippleEnabled) {
            this._createRipple(event.clientX, event.clientY);
        }
    }

    /**
     * Handle mouse up
     * @private
     */
    _onMouseUp() {
        this.isPressed = false;
        this.cursorElement.classList.remove('pressed');
        this.ringElement.classList.remove('pressed');
    }

    /**
     * Handle mouse over (hover detection)
     * @param {MouseEvent} event
     * @private
     */
    _onMouseOver(event) {
        const target = event.target;
        const isInteractive = target.matches('a, button, [data-cursor-hover], input, textarea, select');

        if (isInteractive && !this.isHovering) {
            this.isHovering = true;
            this.cursorElement.classList.add('hovering');
            this.ringElement.classList.add('hovering');
        }
    }

    /**
     * Handle mouse out
     * @param {MouseEvent} event
     * @private
     */
    _onMouseOut(event) {
        const target = event.target;
        const isInteractive = target.matches('a, button, [data-cursor-hover], input, textarea, select');

        if (isInteractive && this.isHovering) {
            this.isHovering = false;
            this.cursorElement.classList.remove('hovering');
            this.ringElement.classList.remove('hovering');
        }
    }

    /**
     * Handle window blur
     * @private
     */
    _onWindowBlur() {
        this.container.style.opacity = '0';
    }

    /**
     * Handle window focus
     * @private
     */
    _onWindowFocus() {
        this.container.style.opacity = '1';
    }

    /**
     * Create ripple effect
     * @param {number} x
     * @param {number} y
     * @private
     */
    _createRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'cursor-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.style.width = `${this.rippleSize}px`;
        ripple.style.height = `${this.rippleSize}px`;
        this.container.appendChild(ripple);

        // Animate ripple
        gsap.to(ripple, {
            scale: 1.5,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.out',
            onComplete: () => {
                ripple.remove();
            }
        });
    }

    /**
     * Start animation loop
     * @private
     */
    _startAnimation() {
        const animate = () => {
            // Lerp cursor position
            this.position.x += (this.target.x - this.position.x) * 0.15;
            this.position.y += (this.target.y - this.position.y) * 0.15;

            // Update main cursor
            this.cursorElement.style.left = `${this.position.x}px`;
            this.cursorElement.style.top = `${this.position.y}px`;

            // Update ring (slower follow)
            const ringX = this.position.x + (this.target.x - this.position.x) * 0.5;
            const ringY = this.position.y + (this.target.y - this.position.y) * 0.5;
            this.ringElement.style.left = `${ringX}px`;
            this.ringElement.style.top = `${ringY}px`;

            // Update trail
            let prevX = this.position.x;
            let prevY = this.position.y;

            this.trail.forEach((particle, i) => {
                const speed = 0.3 - (i * 0.02);
                particle.x += (prevX - particle.x) * speed;
                particle.y += (prevY - particle.y) * speed;

                particle.element.style.left = `${particle.x}px`;
                particle.element.style.top = `${particle.y}px`;

                prevX = particle.x;
                prevY = particle.y;
            });

            this.rafId = requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Create ripple effect at position (public method)
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createRipple(x, y) {
        if (this.rippleEnabled && this.container) {
            this._createRipple(x, y);
        }
    }

    /**
     * Update cursor position (for external calls)
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    update(x, y) {
        this.target.x = x;
        this.target.y = y;
    }

    /**
     * Set cursor color
     * @param {string} color
     */
    setColor(color) {
        this.cursorColor = color;
        this.cursorElement.style.background = color;
        this.cursorElement.style.boxShadow = `0 0 10px ${color}80`;
        this.ringElement.style.borderColor = color;

        this.trail.forEach(particle => {
            particle.element.style.background = color;
        });
    }

    /**
     * Show cursor
     */
    show() {
        if (this.container) {
            this.container.style.opacity = '1';
        }
    }

    /**
     * Hide cursor
     */
    hide() {
        if (this.container) {
            this.container.style.opacity = '0';
        }
    }

    /**
     * Enable/disable cursor
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.container) {
            this.container.style.display = enabled ? 'block' : 'none';
        }
        document.body.style.cursor = enabled && this.hideNativeCursor ? 'none' : 'auto';
    }

    /**
     * Clean up
     */
    dispose() {
        // Cancel animation
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        // Remove event listeners
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('mouseover', this._onMouseOver);
        document.removeEventListener('mouseout', this._onMouseOut);
        window.removeEventListener('blur', this._onWindowBlur);
        window.removeEventListener('focus', this._onWindowFocus);

        // Remove DOM elements
        if (this.container) {
            this.container.remove();
        }
        if (this.styleElement) {
            this.styleElement.remove();
        }

        // Restore native cursor
        document.body.style.cursor = 'auto';

        console.log('%c[CursorEffects] Disposed', 'color: #88ffaa;');
    }
}

export { CursorEffects };
export default CursorEffects;
