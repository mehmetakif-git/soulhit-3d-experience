/**
 * Debug.js
 * Debug GUI Manager with lil-gui
 *
 * Provides a debug interface for tweaking parameters
 * during development. Only active in debug mode.
 */

import GUI from 'lil-gui';

/**
 * @class Debug
 * @description Manages debug GUI with lil-gui
 */
class Debug {
    /** @type {Debug|null} Singleton instance */
    static instance = null;

    /**
     * Create debug manager
     */
    constructor() {
        // Singleton pattern
        if (Debug.instance) {
            return Debug.instance;
        }
        Debug.instance = this;

        /** @type {GUI} Main GUI instance */
        this.gui = new GUI({
            width: 300,
            title: 'Debug Controls'
        });

        /** @type {Map<string, GUI>} Folder references */
        this.folders = new Map();

        /** @type {boolean} Visibility state */
        this.visible = true;

        // Setup keyboard toggle
        this._setupKeyboardToggle();

        // Add FPS display
        this._setupFPSMonitor();

        console.log('%c[Debug] GUI initialized', 'color: #ff44ff;');
    }

    /**
     * Setup keyboard shortcut to toggle GUI
     * @private
     */
    _setupKeyboardToggle() {
        window.addEventListener('keydown', (event) => {
            // Press 'H' to toggle GUI visibility
            if (event.key === 'h' || event.key === 'H') {
                this.toggle();
            }
        });
    }

    /**
     * Setup FPS monitor display
     * @private
     */
    _setupFPSMonitor() {
        this.fpsData = { fps: 60, frame: 0 };

        const statsFolder = this.addFolder('Performance');
        statsFolder.add(this.fpsData, 'fps').name('FPS').listen().disable();
        statsFolder.add(this.fpsData, 'frame').name('Frame').listen().disable();
    }

    /**
     * Update FPS display
     * @param {Object} timeData - Time data from Time class
     */
    updateFPS(timeData) {
        if (this.fpsData) {
            this.fpsData.fps = timeData.fps;
            this.fpsData.frame = timeData.frame;
        }
    }

    /**
     * Add a folder to the GUI
     * @param {string} name - Folder name
     * @returns {GUI}
     */
    addFolder(name) {
        if (this.folders.has(name)) {
            return this.folders.get(name);
        }

        const folder = this.gui.addFolder(name);
        this.folders.set(name, folder);
        return folder;
    }

    /**
     * Get a folder by name
     * @param {string} name - Folder name
     * @returns {GUI|undefined}
     */
    getFolder(name) {
        return this.folders.get(name);
    }

    /**
     * Add a control to the main GUI
     * @param {Object} object - Object containing the property
     * @param {string} property - Property name
     * @returns {Controller}
     */
    add(object, property) {
        return this.gui.add(object, property);
    }

    /**
     * Add a color control
     * @param {Object} object - Object containing the color
     * @param {string} property - Property name
     * @returns {Controller}
     */
    addColor(object, property) {
        return this.gui.addColor(object, property);
    }

    /**
     * Toggle GUI visibility
     */
    toggle() {
        this.visible = !this.visible;
        if (this.visible) {
            this.gui.show();
        } else {
            this.gui.hide();
        }
    }

    /**
     * Show the GUI
     */
    show() {
        this.visible = true;
        this.gui.show();
    }

    /**
     * Hide the GUI
     */
    hide() {
        this.visible = false;
        this.gui.hide();
    }

    /**
     * Check if debug mode is active
     * @returns {boolean}
     */
    static isActive() {
        return window.location.hash === '#debug';
    }

    /**
     * Get the singleton instance
     * @returns {Debug|null}
     */
    static getInstance() {
        return Debug.instance;
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.gui.destroy();
        this.folders.clear();
        Debug.instance = null;

        console.log('%c[Debug] Disposed', 'color: #ff44ff;');
    }
}

export { Debug };
export default Debug;
