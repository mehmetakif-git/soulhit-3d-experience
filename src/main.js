/**
 * Soulhit 3D Experience
 * Main Entry Point - Production Ready
 *
 * Features:
 * - Professional loading screen with progress
 * - WebGL capability detection
 * - Error handling and fallbacks
 * - Debug mode support
 *
 * Debug Mode: Add #debug to URL to enable debug controls
 * Example: http://localhost:5173/#debug
 */

import * as THREE from 'three';
import './style.css';

// Loading screen (imported first for immediate display)
import { LoadingScreen } from './utils/LoadingScreen.js';

// Main experience
import { Experience } from './Experience.js';

// ==========================================
// Global State
// ==========================================

let loadingScreen = null;
let experience = null;

// ==========================================
// WebGL Detection
// ==========================================

/**
 * Check if WebGL is supported
 * @returns {Object} WebGL support info
 */
function checkWebGLSupport() {
    const canvas = document.createElement('canvas');

    // Try WebGL 2 first
    let gl = canvas.getContext('webgl2');
    if (gl) {
        return { supported: true, version: 2, context: gl };
    }

    // Fall back to WebGL 1
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
        return { supported: true, version: 1, context: gl };
    }

    return { supported: false, version: 0, context: null };
}

/**
 * Get WebGL capabilities for debugging
 * @param {WebGLRenderingContext} gl
 * @returns {Object}
 */
function getWebGLCapabilities(gl) {
    if (!gl) return null;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    return {
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown',
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
        maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)
    };
}

// ==========================================
// Application Initialization
// ==========================================

/**
 * Initialize the application when DOM is ready
 */
async function init() {
    // ==========================================
    // Create Loading Screen (Immediately)
    // ==========================================

    loadingScreen = new LoadingScreen({
        backgroundColor: '#000011',
        primaryColor: '#4488ff',
        logoText: 'SOULHIT',
        showProgress: true,
        minDisplayTime: 1500
    });

    loadingScreen.setStatus('Checking capabilities...');
    loadingScreen.setProgress(5);

    // ==========================================
    // Check WebGL Support
    // ==========================================

    const webglSupport = checkWebGLSupport();

    if (!webglSupport.supported) {
        console.error('%c[Main] WebGL not supported!', 'color: #ff4444;');
        // Loading screen will show error automatically
        return;
    }

    const capabilities = getWebGLCapabilities(webglSupport.context);
    console.log('%c[Main] WebGL Capabilities:', 'color: #44ff44;', capabilities);

    loadingScreen.setProgress(10, 'WebGL detected');

    // ==========================================
    // Get Canvas Element
    // ==========================================

    const canvas = document.getElementById('webgl');

    if (!canvas) {
        console.error('%c[Main] Canvas element #webgl not found!', 'color: #ff4444;');
        loadingScreen.setStatus('Error: Canvas not found');
        return;
    }

    loadingScreen.setProgress(15, 'Initializing renderer...');

    // ==========================================
    // Create Experience with Progress Callbacks
    // ==========================================

    try {
        experience = new Experience(canvas, {
            // Pass loading progress callback
            onProgress: (progress, status) => {
                // Scale progress from 15-90 for experience loading
                const scaledProgress = 15 + (progress * 0.75);
                loadingScreen.setProgress(scaledProgress, status);
            }
        });

        // Wait for experience to be ready
        await experience.ready();

        loadingScreen.setProgress(95, 'Finalizing...');

    } catch (error) {
        console.error('%c[Main] Failed to initialize experience:', 'color: #ff4444;', error);
        loadingScreen.setStatus('Failed to initialize. Please refresh.');
        return;
    }

    // ==========================================
    // Complete Loading
    // ==========================================

    loadingScreen.complete(() => {
        console.log('%c[Main] Loading complete, experience started', 'color: #88ff88;');

        // Start any entrance animations
        if (experience.onLoadComplete) {
            experience.onLoadComplete();
        }
    });

    // ==========================================
    // Expose to window for debugging
    // ==========================================

    if (window.location.hash === '#debug') {
        window.experience = experience;
        window.THREE = THREE;
        window.loadingScreen = loadingScreen;
        console.log('%c[Main] Debug objects exposed to window', 'color: #88ff88;');
        console.log('  - window.experience');
        console.log('  - window.THREE');
        console.log('  - window.loadingScreen');
    }

    // ==========================================
    // Log Startup Info
    // ==========================================

    console.log(`
%c╔══════════════════════════════════════════╗
║     SOULHIT 3D EXPERIENCE                ║
║     Three.js r${THREE.REVISION.padEnd(28)}║
║     WebGL ${webglSupport.version}${' '.repeat(31)}║
║     Press 'H' to toggle debug panel      ║
╚══════════════════════════════════════════╝
    `, 'color: #4488ff; font-weight: bold;');

    // ==========================================
    // Handle Page Unload
    // ==========================================

    window.addEventListener('beforeunload', () => {
        if (experience) {
            experience.dispose();
        }
        if (loadingScreen) {
            loadingScreen.dispose();
        }
    });

    // ==========================================
    // Handle Visibility Change (Tab Switch)
    // ==========================================

    document.addEventListener('visibilitychange', () => {
        if (experience) {
            if (document.hidden) {
                experience.pause();
            } else {
                experience.resume();
            }
        }
    });
}

// ==========================================
// Error Handling
// ==========================================

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
    console.error('%c[Main] Uncaught error:', 'color: #ff4444;', event.error);

    // Show error in loading screen if still visible
    if (loadingScreen && !loadingScreen.isComplete) {
        loadingScreen.setStatus('An error occurred. Please refresh.');
    }
});

/**
 * Unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('%c[Main] Unhandled promise rejection:', 'color: #ff4444;', event.reason);
});

// ==========================================
// Start Application
// ==========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
