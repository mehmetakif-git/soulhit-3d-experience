/**
 * LoadingScreen.js
 * Professional Loading Screen with Progress
 *
 * Features:
 * - Animated loading UI
 * - Progress tracking
 * - Smooth fade out
 * - WebGL detection
 * - Error handling display
 */

import gsap from 'gsap';

/**
 * @class LoadingScreen
 * @description Manages loading screen display and progress
 */
class LoadingScreen {
    /**
     * Create loading screen
     * @param {Object} options
     */
    constructor(options = {}) {
        const {
            backgroundColor = '#000011',
            primaryColor = '#4488ff',
            textColor = '#ffffff',
            logoText = 'SOULHIT',
            showProgress = true,
            minDisplayTime = 1500
        } = options;

        this.backgroundColor = backgroundColor;
        this.primaryColor = primaryColor;
        this.textColor = textColor;
        this.logoText = logoText;
        this.showProgress = showProgress;
        this.minDisplayTime = minDisplayTime;

        this.progress = 0;
        this.startTime = Date.now();
        this.isComplete = false;
        this.onComplete = null;

        this.container = null;
        this.progressBar = null;
        this.progressText = null;
        this.statusText = null;

        this._createElements();
        this._checkWebGL();
    }

    /**
     * Create loading screen DOM elements
     * @private
     */
    _createElements() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'loading-screen';
        this.container.innerHTML = `
            <div class="loading-content">
                <div class="loading-logo">
                    <span class="logo-text">${this.logoText}</span>
                    <span class="logo-subtitle">3D Experience</span>
                </div>

                <div class="loading-spinner">
                    <div class="spinner-ring"></div>
                    <div class="spinner-ring"></div>
                    <div class="spinner-ring"></div>
                </div>

                <div class="loading-progress-container" ${!this.showProgress ? 'style="display:none"' : ''}>
                    <div class="loading-progress-bar">
                        <div class="loading-progress-fill"></div>
                    </div>
                    <div class="loading-progress-text">0%</div>
                </div>

                <div class="loading-status">Initializing...</div>
            </div>

            <div class="loading-error" style="display:none">
                <div class="error-icon">⚠</div>
                <div class="error-title">WebGL Not Supported</div>
                <div class="error-message">
                    Your browser or device doesn't support WebGL, which is required for this experience.
                    Please try using a modern browser like Chrome, Firefox, or Edge.
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${this.backgroundColor};
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 100000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            }

            .loading-content {
                text-align: center;
                color: ${this.textColor};
            }

            .loading-logo {
                margin-bottom: 40px;
            }

            .logo-text {
                display: block;
                font-size: 48px;
                font-weight: 700;
                letter-spacing: 8px;
                background: linear-gradient(135deg, ${this.primaryColor}, #ff4488);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: logoGlow 2s ease-in-out infinite alternate;
            }

            .logo-subtitle {
                display: block;
                font-size: 14px;
                letter-spacing: 4px;
                opacity: 0.6;
                margin-top: 8px;
                text-transform: uppercase;
            }

            @keyframes logoGlow {
                from { filter: drop-shadow(0 0 10px ${this.primaryColor}40); }
                to { filter: drop-shadow(0 0 20px ${this.primaryColor}80); }
            }

            .loading-spinner {
                position: relative;
                width: 80px;
                height: 80px;
                margin: 0 auto 30px;
            }

            .spinner-ring {
                position: absolute;
                width: 100%;
                height: 100%;
                border: 2px solid transparent;
                border-top-color: ${this.primaryColor};
                border-radius: 50%;
                animation: spin 1.5s linear infinite;
            }

            .spinner-ring:nth-child(2) {
                width: 70%;
                height: 70%;
                top: 15%;
                left: 15%;
                border-top-color: #ff4488;
                animation-duration: 1.2s;
                animation-direction: reverse;
            }

            .spinner-ring:nth-child(3) {
                width: 40%;
                height: 40%;
                top: 30%;
                left: 30%;
                border-top-color: #44ff88;
                animation-duration: 0.9s;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .loading-progress-container {
                margin-bottom: 20px;
            }

            .loading-progress-bar {
                width: 200px;
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                overflow: hidden;
                margin: 0 auto 10px;
            }

            .loading-progress-fill {
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, ${this.primaryColor}, #ff4488);
                border-radius: 2px;
                transition: width 0.3s ease;
            }

            .loading-progress-text {
                font-size: 14px;
                opacity: 0.7;
            }

            .loading-status {
                font-size: 12px;
                opacity: 0.5;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .loading-error {
                text-align: center;
                color: ${this.textColor};
                max-width: 400px;
                padding: 20px;
            }

            .error-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }

            .error-title {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 16px;
                color: #ff4444;
            }

            .error-message {
                font-size: 14px;
                line-height: 1.6;
                opacity: 0.8;
            }

            #loading-screen.fade-out {
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.5s ease;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.container);

        // Get references
        this.progressBar = this.container.querySelector('.loading-progress-fill');
        this.progressText = this.container.querySelector('.loading-progress-text');
        this.statusText = this.container.querySelector('.loading-status');
        this.contentElement = this.container.querySelector('.loading-content');
        this.errorElement = this.container.querySelector('.loading-error');

        this.styleElement = style;
    }

    /**
     * Check for WebGL support
     * @private
     */
    _checkWebGL() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            this._showError();
            return false;
        }

        return true;
    }

    /**
     * Show error message
     * @private
     */
    _showError() {
        this.contentElement.style.display = 'none';
        this.errorElement.style.display = 'block';
    }

    /**
     * Update progress
     * @param {number} progress - Progress value (0-100)
     * @param {string} status - Status text
     */
    setProgress(progress, status = null) {
        this.progress = Math.min(100, Math.max(0, progress));

        if (this.progressBar) {
            this.progressBar.style.width = `${this.progress}%`;
        }

        if (this.progressText) {
            this.progressText.textContent = `${Math.round(this.progress)}%`;
        }

        if (status && this.statusText) {
            this.statusText.textContent = status;
        }
    }

    /**
     * Set status text
     * @param {string} status
     */
    setStatus(status) {
        if (this.statusText) {
            this.statusText.textContent = status;
        }
    }

    /**
     * Complete loading and hide screen
     * @param {Function} callback
     */
    complete(callback = null) {
        if (this.isComplete) return;

        this.setProgress(100, 'Complete!');

        // Ensure minimum display time
        const elapsed = Date.now() - this.startTime;
        const delay = Math.max(0, this.minDisplayTime - elapsed);

        setTimeout(() => {
            this.hide(callback);
        }, delay);
    }

    /**
     * Hide loading screen
     * @param {Function} callback
     */
    hide(callback = null) {
        this.isComplete = true;

        gsap.to(this.container, {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: () => {
                this.container.style.display = 'none';

                if (callback) callback();
                if (this.onComplete) this.onComplete();
            }
        });
    }

    /**
     * Show loading screen
     */
    show() {
        this.isComplete = false;
        this.progress = 0;
        this.startTime = Date.now();

        this.container.style.display = 'flex';
        this.container.style.opacity = '1';

        if (this.progressBar) {
            this.progressBar.style.width = '0%';
        }
    }

    /**
     * Set completion callback
     * @param {Function} callback
     */
    setOnComplete(callback) {
        this.onComplete = callback;
    }

    /**
     * Dispose loading screen
     */
    dispose() {
        if (this.container) {
            this.container.remove();
        }
        if (this.styleElement) {
            this.styleElement.remove();
        }
    }
}

export { LoadingScreen };
export default LoadingScreen;
