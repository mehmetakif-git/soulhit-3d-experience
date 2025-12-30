/**
 * ScrollManager.js
 * Scroll-Based Animation Controller
 *
 * Manages scroll position with smooth interpolation.
 * Triggers animations based on scroll sections.
 */

import gsap from 'gsap';
import { EventEmitter } from '../core/EventEmitter.js';

/**
 * @class ScrollManager
 * @extends EventEmitter
 * @description Manages scroll-based animations and interactions
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
            smoothness = 0.1,
            threshold = 0.1
        } = options;

        /** @type {number} Smooth interpolation factor */
        this.smoothness = smoothness;

        /** @type {number} Threshold for triggering updates */
        this.threshold = threshold;

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

        // ==========================================
        // Document Dimensions
        // ==========================================

        /** @type {number} Viewport height */
        this.viewportHeight = window.innerHeight;

        /** @type {number} Document scrollable height */
        this.documentHeight = 0;

        // ==========================================
        // Sections
        // ==========================================

        /** @type {Array<Object>} Registered scroll sections */
        this.sections = [];

        // ==========================================
        // Initialize
        // ==========================================

        this._bindEvents();
        this._updateDimensions();

        console.log('%c[ScrollManager] Initialized', 'color: #44ffaa;');
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
     * Add a scroll section
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
     * Update scroll manager (call in animation loop)
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
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

        // Update sections
        this._updateSections();

        // Emit update event
        this.emit('update', this.getScrollData());
    }

    /**
     * Update section states
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
     * Scroll to an element
     * @param {HTMLElement|string} element - Element or selector
     * @param {number} duration - Animation duration in seconds
     * @param {number} offset - Offset from element top
     */
    scrollToElement(element, duration = 1, offset = 0) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            const rect = el.getBoundingClientRect();
            const target = rect.top + window.scrollY + offset;
            this.scrollTo(target, duration);
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
            direction: this.direction
        };
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

export { ScrollManager };
export default ScrollManager;
