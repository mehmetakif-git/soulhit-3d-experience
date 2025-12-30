/**
 * Experience.js
 * Main Experience Controller - Production Ready
 *
 * Features:
 * - Complete post-processing stack
 * - Performance-adaptive quality
 * - Mobile touch support
 * - Cursor effects and interactions
 * - Professional lighting system
 * - Gradient background with stars
 *
 * Post-Processing Stack:
 * 1. RenderPass (base scene)
 * 2. UnrealBloomPass
 * 3. ChromaticAberrationPass
 * 4. DOFPass (Depth of Field)
 * 5. VignetteColorGradePass
 * 6. FXAAPass (anti-aliasing)
 */

import * as THREE from 'three';
import gsap from 'gsap';

// Core imports
import { App } from './core/App.js';
import { Debug } from './utils/Debug.js';

// World imports
import { Environment } from './world/Environment.js';
import { Particles } from './world/Particles.js';
import { GlassCards } from './world/GlassCards.js';
import { SpineModel, MaterialType } from './world/SpineModel.js';
import { LightingSystem } from './world/LightingSystem.js';
import { WaterSurface } from './world/WaterSurface.js';

// Utility imports
import { PerformanceManager, QualityLevels } from './utils/PerformanceManager.js';
import { CursorEffects } from './utils/CursorEffects.js';
import { MobileSupport } from './utils/MobileSupport.js';
import { ScrollManager } from './utils/ScrollManager.js';

// Post-processing imports
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Custom post-processing passes
import { ChromaticAberrationPass } from './postprocessing/ChromaticAberrationPass.js';
import { DOFPass } from './postprocessing/DOFPass.js';
import { VignetteColorGradePass } from './postprocessing/VignetteColorGradePass.js';

// Background shaders
import backgroundVertexShader from './shaders/background/vertex.glsl?raw';
import backgroundFragmentShader from './shaders/background/fragment.glsl?raw';

/**
 * @class Experience
 * @description Main experience controller with advanced post-processing
 */
class Experience {
    /** @type {Experience|null} Singleton instance */
    static instance = null;

    /**
     * Create the experience
     * @param {HTMLCanvasElement} canvas - Canvas element for rendering
     * @param {Object} options - Configuration options
     */
    constructor(canvas, options = {}) {
        // Singleton pattern
        if (Experience.instance) {
            return Experience.instance;
        }
        Experience.instance = this;

        const {
            onProgress = null
        } = options;

        /** @type {Function|null} Progress callback */
        this.onProgress = onProgress;

        /** @type {Function|null} Ready resolve function */
        this._readyResolve = null;

        /** @type {Promise} Ready promise */
        this._readyPromise = new Promise(resolve => {
            this._readyResolve = resolve;
        });

        /** @type {boolean} Paused state */
        this._isPaused = false;

        // ==========================================
        // Initialize Core App
        // ==========================================

        this._reportProgress(5, 'Creating renderer...');

        /** @type {App} Core application instance */
        this.app = new App(canvas);

        // Get references from app
        this.scene = this.app.scene;
        this.camera = this.app.camera;
        this.renderer = this.app.renderer;

        // ==========================================
        // Performance Manager
        // ==========================================

        this._reportProgress(10, 'Detecting device capabilities...');

        /** @type {PerformanceManager} Adaptive quality manager */
        this.performanceManager = new PerformanceManager(this.renderer, {
            targetFPS: 60,
            qualityCheckInterval: 2000,
            autoAdjust: true
        });

        // Subscribe to quality changes
        this.performanceManager.on('qualityChange', (data) => {
            this._onQualityChange(data);
        });

        // ==========================================
        // Mobile Support
        // ==========================================

        /** @type {MobileSupport} Touch gesture handler */
        this.mobileSupport = new MobileSupport(canvas, {
            enablePinch: true,
            enableSwipe: true,
            enableDoubleTap: true,
            enableOrientation: true
        });

        // Subscribe to mobile events
        this._initMobileEvents();

        // ==========================================
        // Scroll Manager
        // ==========================================

        /** @type {ScrollManager} Scroll-based animation controller */
        this.scrollManager = new ScrollManager({
            smoothness: 0.08,
            threshold: 0.1
        });

        // Subscribe to scroll events
        this._initScrollEvents();

        // ==========================================
        // Debug Reference
        // ==========================================

        this.debug = this.app.debug ? this.app.debugUI : null;

        // ==========================================
        // Mouse Tracking for Particles & Cards
        // ==========================================

        /** @type {THREE.Vector2} Normalized mouse coordinates */
        this.mouse = new THREE.Vector2(0, 0);

        /** @type {THREE.Vector3} Mouse position in 3D space */
        this.mouseWorld = new THREE.Vector3();

        /** @type {THREE.Raycaster} For mouse 3D position calculation */
        this.raycaster = new THREE.Raycaster();

        /** @type {THREE.Plane} Invisible plane for mouse intersection */
        this.mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        // ==========================================
        // Post-Processing Setup
        // ==========================================

        this._reportProgress(20, 'Setting up post-processing...');

        /** @type {EffectComposer} Post-processing composer */
        this.composer = null;

        /** @type {Object} Post-processing passes references */
        this.passes = {};

        /** @type {boolean} Post-processing enabled state */
        this.postProcessingEnabled = true;

        this._initPostProcessing();

        // ==========================================
        // Cursor Effects (Desktop)
        // ==========================================

        if (!this.mobileSupport.isMobile) {
            this._reportProgress(25, 'Creating cursor effects...');

            /** @type {CursorEffects} Custom cursor and trails */
            this.cursorEffects = new CursorEffects({
                trailLength: 20,
                trailFadeSpeed: 0.08,
                cursorSize: 20,
                rippleCount: 3
            });
        }

        // ==========================================
        // World Components
        // ==========================================

        /** @type {Object} World component references */
        this.world = {};

        // Initialize world (async for models)
        this._initWorld();

        // ==========================================
        // Event Subscriptions
        // ==========================================

        // Subscribe to app events
        this.app.on('update', (data) => this._update(data));
        this.app.on('resize', (sizes) => this._onResize(sizes));

        // Mouse events for particle and card interaction
        this._initMouseEvents();

        // Subscribe to time events for FPS monitoring
        if (this.debug) {
            this.app.time.on('tick', (data) => {
                this.debug.updateFPS(data);
            });
        }

        // ==========================================
        // Mark Ready
        // ==========================================

        this._reportProgress(100, 'Ready!');

        // Small delay to ensure all async operations complete
        setTimeout(() => {
            if (this._readyResolve) {
                this._readyResolve();
            }
        }, 100);

        console.log('%c[Experience] Initialized with Full Production Features', 'color: #ffff44; font-weight: bold;');
    }

    /**
     * Report loading progress
     * @param {number} progress - Progress 0-100
     * @param {string} status - Status message
     * @private
     */
    _reportProgress(progress, status) {
        if (this.onProgress) {
            this.onProgress(progress, status);
        }
    }

    /**
     * Returns a promise that resolves when experience is ready
     * @returns {Promise}
     */
    ready() {
        return this._readyPromise;
    }

    /**
     * Called when loading is complete
     */
    onLoadComplete() {
        // Play entrance animations
        if (this.world.lightingSystem) {
            this.world.lightingSystem.playEntranceAnimation();
        }

        // Fade in cursor effects
        if (this.cursorEffects) {
            this.cursorEffects.show();
        }
    }

    /**
     * Initialize post-processing stack
     * @private
     */
    _initPostProcessing() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const quality = this.performanceManager.getQualityPreset();

        // ==========================================
        // Create Effect Composer
        // ==========================================

        this.composer = new EffectComposer(this.renderer);

        // ==========================================
        // 1. Render Pass (Base Scene)
        // ==========================================

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        this.passes.render = renderPass;

        // ==========================================
        // 2. Unreal Bloom Pass
        // ==========================================

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            quality.bloomStrength || 1.5,
            0.4,    // Radius
            0.85    // Threshold
        );
        bloomPass.enabled = quality.enableBloom !== false;
        this.composer.addPass(bloomPass);
        this.passes.bloom = bloomPass;

        // ==========================================
        // 3. Chromatic Aberration Pass
        // ==========================================

        const chromaticPass = new ChromaticAberrationPass({
            intensity: 0.003,
            radialIntensity: 0.5,
            direction: new THREE.Vector2(1.0, 0.5),
            animated: false
        });
        chromaticPass.enabled = quality.enableChromatic !== false;
        this.composer.addPass(chromaticPass);
        this.passes.chromatic = chromaticPass;

        // ==========================================
        // 4. DOF Pass (Depth of Field)
        // ==========================================

        const dofPass = new DOFPass(this.scene, this.camera, {
            focus: 0.5,
            aperture: 0.015,
            maxBlur: 0.015,
            bokehScale: 2.5,
            hexagonal: false,
            focusRange: 3.0
        });
        dofPass.enabled = false; // Disabled by default for performance
        this.composer.addPass(dofPass);
        this.passes.dof = dofPass;

        // ==========================================
        // 5. Vignette & Color Grading Pass
        // ==========================================

        const vignettePass = new VignetteColorGradePass({
            preset: 'cinematic',
            vignetteIntensity: 0.35,
            vignetteRadius: 0.75
        });
        vignettePass.enabled = true;
        this.composer.addPass(vignettePass);
        this.passes.vignette = vignettePass;

        // ==========================================
        // 6. FXAA Pass (Anti-Aliasing)
        // ==========================================

        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
        fxaaPass.enabled = quality.enableFXAA !== false;
        this.composer.addPass(fxaaPass);
        this.passes.fxaa = fxaaPass;

        // ==========================================
        // 7. Output Pass (Final)
        // ==========================================

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
        this.passes.output = outputPass;

        console.log('%c[Experience] Post-processing stack initialized', 'color: #88ff88;');
    }

    /**
     * Initialize mouse event tracking
     * @private
     */
    _initMouseEvents() {
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseLeave = this._handleMouseLeave.bind(this);
        this._handleClick = this._handleClick.bind(this);

        window.addEventListener('mousemove', this._handleMouseMove);
        window.addEventListener('mouseleave', this._handleMouseLeave);
        window.addEventListener('click', this._handleClick);
    }

    /**
     * Initialize mobile touch events
     * @private
     */
    _initMobileEvents() {
        // Pan gesture - move camera/particles
        this.mobileSupport.on('pan', (data) => {
            // Convert touch to normalized coordinates
            const normalizedX = (data.center.x / window.innerWidth) * 2 - 1;
            const normalizedY = -(data.center.y / window.innerHeight) * 2 + 1;

            this.mouse.set(normalizedX, normalizedY);
            this._updateMouseWorld();
        });

        // Pinch gesture - zoom camera
        this.mobileSupport.on('pinch', (data) => {
            if (this.app.cameraManager) {
                const currentZ = this.camera.position.z;
                const newZ = currentZ - (data.delta - 1) * 5;
                this.camera.position.z = THREE.MathUtils.clamp(newZ, 5, 25);
            }
        });

        // Double tap - trigger interaction
        this.mobileSupport.on('doubleTap', (data) => {
            // Create ripple at touch position
            if (this.cursorEffects) {
                this.cursorEffects.createRipple(data.x, data.y);
            }
        });

        // Swipe gesture
        this.mobileSupport.on('swipe', (data) => {
            // Could be used for navigation or card switching
            console.log('[Experience] Swipe:', data.direction);
        });

        // Device orientation
        this.mobileSupport.on('orientation', (data) => {
            if (this.app.cameraManager) {
                // Subtle parallax from device tilt
                this.app.cameraManager.setTargetOffset(
                    data.gamma * 0.1,
                    data.beta * 0.05
                );
            }
        });
    }

    /**
     * Initialize scroll-based events and scene triggers
     * @private
     */
    _initScrollEvents() {
        // Get DOM elements
        this.scrollProgressElement = document.getElementById('scroll-progress');
        this.scrollIndicatorElement = document.getElementById('scroll-indicator');

        // ==========================================
        // Scene Change Handler
        // ==========================================

        this.scrollManager.on('sceneChange', (data) => {
            const { from, to, scene } = data;

            console.log(`%c[Experience] Scene transition: ${from} → ${to}`, 'color: #44ffaa;');

            // Apply scene-specific effects
            this._applySceneEffects(scene);

            // Handle specific scene transitions
            switch (to) {
                case 'hero':
                    this._onEnterHeroScene();
                    break;
                case 'underwater':
                    this._onEnterUnderwaterScene();
                    break;
                case 'spineReveal':
                    this._onEnterSpineRevealScene();
                    break;
                case 'orbital':
                    this._onEnterOrbitalScene();
                    break;
                case 'final':
                    this._onEnterFinalScene();
                    break;
            }

            // Hide scroll indicator after hero
            if (this.scrollIndicatorElement) {
                if (to === 'hero') {
                    this.scrollIndicatorElement.classList.remove('hidden');
                } else {
                    this.scrollIndicatorElement.classList.add('hidden');
                }
            }

            // Show/hide section content
            if (from) {
                this._hideSectionContent(from);
            }
            this._showSectionContent(to);
        });

        // ==========================================
        // Continuous Scroll Update Handler
        // ==========================================

        this.scrollManager.on('update', (scrollData) => {
            // Update progress bar
            if (this.scrollProgressElement) {
                this.scrollProgressElement.style.width = `${scrollData.progress * 100}%`;
            }

            // Apply camera position from ScrollManager
            if (scrollData.cameraPosition && scrollData.lookAtTarget) {
                this.camera.position.copy(scrollData.cameraPosition);
                this.camera.lookAt(scrollData.lookAtTarget);
            }

            // Continuous scene-specific updates
            this._updateSceneEffects(scrollData);
        });
    }

    /**
     * Apply effects when entering a scene
     * @param {Object} scene - Scene definition with effects
     * @private
     */
    _applySceneEffects(scene) {
        if (!scene || !scene.effects) return;

        const effects = scene.effects;

        // Update particle color
        if (effects.particleColor && this.world.particles) {
            gsap.to(this.world.particles.material.uniforms.uColor.value, {
                r: effects.particleColor.r,
                g: effects.particleColor.g,
                b: effects.particleColor.b,
                duration: 1.5,
                ease: 'power2.out'
            });
        }

        // Update bloom strength
        if (effects.bloomStrength !== undefined && this.passes.bloom) {
            gsap.to(this.passes.bloom, {
                strength: effects.bloomStrength,
                duration: 1.0,
                ease: 'power2.out'
            });
        }

        // Update fog density
        if (effects.fogDensity !== undefined && this.world.environment) {
            const fogFar = 30 + (1 - effects.fogDensity) * 50;
            gsap.to(this.scene.fog, {
                far: fogFar,
                duration: 1.5,
                ease: 'power2.out'
            });
        }

        // Scene tint via vignette pass
        if (effects.tint && this.passes.vignette) {
            // Apply underwater tint effect
            this.passes.vignette.setTint(effects.tint.r, effects.tint.g, effects.tint.b);
        }
    }

    /**
     * Continuous updates based on scroll progress
     * @param {Object} scrollData - Current scroll state
     * @private
     */
    _updateSceneEffects(scrollData) {
        const { scene, localProgress, sceneDefinition } = scrollData;

        // Orbital scene: rotate glass cards with camera
        if (scene === 'orbital' && sceneDefinition?.effects?.cardsOrbit) {
            if (this.world.glassCards) {
                const { startAngle, endAngle } = sceneDefinition.camera;
                const angle = startAngle + (endAngle - startAngle) * localProgress;

                // Rotate cards container opposite to camera for dramatic effect
                this.world.glassCards.getGroup().rotation.y = -angle * 0.3;
            }
        }
    }

    /**
     * Hero scene effects
     * @private
     */
    _onEnterHeroScene() {
        // Reset everything to initial state
        if (this.world.spineModel) {
            gsap.to(this.world.spineModel.getGroup().scale, {
                x: 0,
                y: 0,
                z: 0,
                duration: 0.5,
                ease: 'power2.out'
            });
        }

        if (this.world.glassCards) {
            gsap.to(this.world.glassCards.getGroup().rotation, {
                y: 0,
                duration: 1,
                ease: 'power2.out'
            });
        }

        // Clear any tint
        if (this.passes.vignette) {
            this.passes.vignette.clearTint();
        }
    }

    /**
     * Underwater dive scene effects
     * @private
     */
    _onEnterUnderwaterScene() {
        // Show water surface with animation
        if (this.world.waterSurface) {
            this.world.waterSurface.show(1.5);
        }

        // Subtle camera shake effect
        if (this.app.cameraManager) {
            this.app.cameraManager.shake(0.1, 0.5);
        }

        // Increase chromatic aberration
        if (this.passes.chromatic) {
            gsap.to(this.passes.chromatic, {
                intensity: 0.008,
                duration: 1,
                ease: 'power2.out'
            });
        }
    }

    /**
     * Spine reveal scene effects
     * @private
     */
    _onEnterSpineRevealScene() {
        // Hide water surface
        if (this.world.waterSurface) {
            this.world.waterSurface.hide(1.0);
        }

        // Reveal the spine model
        if (this.world.spineModel) {
            const group = this.world.spineModel.getGroup();

            // Entrance animation
            gsap.fromTo(group.scale,
                { x: 0, y: 0, z: 0 },
                {
                    x: 1,
                    y: 1,
                    z: 1,
                    duration: 1.5,
                    ease: 'elastic.out(1, 0.5)'
                }
            );

            // Start auto-rotation
            this.world.spineModel.setAutoRotate(true);
        }

        // Clear underwater tint
        if (this.passes.vignette) {
            this.passes.vignette.clearTint();
        }

        // Reset chromatic aberration
        if (this.passes.chromatic) {
            gsap.to(this.passes.chromatic, {
                intensity: 0.003,
                duration: 1,
                ease: 'power2.out'
            });
        }
    }

    /**
     * Orbital camera scene effects
     * @private
     */
    _onEnterOrbitalScene() {
        // Spread glass cards outward
        if (this.world.glassCards) {
            const cards = this.world.glassCards.getCards();
            cards.forEach((card, i) => {
                const angle = (i / cards.length) * Math.PI * 2;
                const radius = 6;

                gsap.to(card.position, {
                    x: Math.cos(angle) * radius,
                    z: Math.sin(angle) * radius,
                    duration: 1.5,
                    ease: 'power3.out'
                });
            });
        }

        // Increase bloom for dramatic effect
        if (this.passes.bloom) {
            gsap.to(this.passes.bloom, {
                radius: 0.6,
                threshold: 0.7,
                duration: 1,
                ease: 'power2.out'
            });
        }
    }

    /**
     * Final reveal scene effects
     * @private
     */
    _onEnterFinalScene() {
        // Bring glass cards back together
        if (this.world.glassCards) {
            const cards = this.world.glassCards.getCards();
            cards.forEach((card, i) => {
                gsap.to(card.position, {
                    x: (i - 1) * 5,
                    z: 0,
                    duration: 1.5,
                    ease: 'power3.out'
                });
            });

            // Reset rotation
            gsap.to(this.world.glassCards.getGroup().rotation, {
                y: 0,
                duration: 1,
                ease: 'power2.out'
            });
        }

        // Stop spine rotation for final pose
        if (this.world.spineModel) {
            this.world.spineModel.setAutoRotate(false);

            // Final pose rotation
            gsap.to(this.world.spineModel.getGroup().rotation, {
                y: Math.PI * 0.25,
                duration: 2,
                ease: 'power2.out'
            });
        }

        // Reset bloom
        if (this.passes.bloom) {
            gsap.to(this.passes.bloom, {
                radius: 0.4,
                threshold: 0.85,
                duration: 1,
                ease: 'power2.out'
            });
        }
    }

    /**
     * Show section content with animation
     * @param {string} sectionId - Section data attribute value
     * @private
     */
    _showSectionContent(sectionId) {
        const section = document.querySelector(`[data-section="${sectionId}"] .section-content`);
        if (section) {
            section.classList.add('visible');
        }
    }

    /**
     * Hide section content with animation
     * @param {string} sectionId - Section data attribute value
     * @private
     */
    _hideSectionContent(sectionId) {
        const section = document.querySelector(`[data-section="${sectionId}"] .section-content`);
        if (section) {
            section.classList.remove('visible');
        }
    }

    /**
     * Handle mouse movement
     * @param {MouseEvent} event
     * @private
     */
    _handleMouseMove(event) {
        // Normalize mouse coordinates to -1 to 1
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this._updateMouseWorld();

        // Update cursor effects
        if (this.cursorEffects) {
            this.cursorEffects.update(event.clientX, event.clientY);
        }
    }

    /**
     * Update mouse world position
     * @private
     */
    _updateMouseWorld() {
        // Calculate 3D position using raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Intersect with a plane at z=0
        this.raycaster.ray.intersectPlane(this.mousePlane, this.mouseWorld);

        // Update particles with mouse position
        if (this.world.particles) {
            this.world.particles.setMousePosition(this.mouseWorld);
        }

        // Update glass cards mouse position for parallax
        if (this.world.glassCards) {
            this.world.glassCards.setMouse(this.mouse.x, this.mouse.y);

            // Check hover state on glass cards
            this.world.glassCards.checkHover(this.raycaster);
        }
    }

    /**
     * Handle mouse click
     * @param {MouseEvent} event
     * @private
     */
    _handleClick(event) {
        // Create ripple effect
        if (this.cursorEffects) {
            this.cursorEffects.createRipple(event.clientX, event.clientY);
        }

        // Check for glass card clicks
        if (this.world.glassCards) {
            const intersects = this.world.glassCards.checkClick(this.raycaster);
            if (intersects.length > 0) {
                console.log('[Experience] Card clicked:', intersects[0].object.userData);
            }
        }
    }

    /**
     * Handle mouse leaving the window
     * @private
     */
    _handleMouseLeave() {
        if (this.world.particles) {
            this.world.particles.clearMouse();
        }

        // Reset glass cards mouse position
        if (this.world.glassCards) {
            this.world.glassCards.setMouse(0, 0);
        }
    }

    /**
     * Initialize world components
     * @private
     */
    _initWorld() {
        this._reportProgress(30, 'Creating environment...');

        // ==========================================
        // Gradient Background
        // ==========================================

        this._createGradientBackground();

        // ==========================================
        // Environment (Fog)
        // ==========================================

        this.world.environment = new Environment(this.scene, {
            ambientIntensity: 0.2,
            mainLightIntensity: 0.5,
            enableFog: true,
            fogColor: 0x000011,
            fogNear: 25,
            fogFar: 60
        });

        // ==========================================
        // Professional Lighting System
        // ==========================================

        this._reportProgress(40, 'Setting up lights...');

        this.world.lightingSystem = new LightingSystem(this.scene, this.renderer, {
            preset: 'dramatic',
            enableShadows: this.performanceManager.getQualityPreset().enableShadows !== false,
            shadowMapSize: this.performanceManager.getQualityPreset().shadowMapSize || 2048,
            enableAnimatedLights: true
        });

        // ==========================================
        // GPU Particles
        // ==========================================

        this._reportProgress(50, 'Initializing particle system...');

        const quality = this.performanceManager.getQualityPreset();

        this.world.particles = new Particles(this.renderer, {
            textureSize: quality.particleTextureSize || 224,
            boundsRadius: 15,
            size: 25,
            color: 0x4488ff,
            colorEnd: 0xff4488,
            flowFieldScale: 0.12,
            flowFieldSpeed: 0.25,
            flowFieldStrength: 2.5,
            damping: 2.5,
            turbulence: 0.6,
            maxVelocity: 4.0,
            lifetimeMin: 4.0,
            lifetimeMax: 10.0,
            mouseRadius: 4.0,
            mouseStrength: 8.0
        });
        this.scene.add(this.world.particles.getMesh());

        // ==========================================
        // Glassmorphic Cards
        // ==========================================

        this._reportProgress(60, 'Creating glass cards...');

        this.world.glassCards = new GlassCards(this.renderer, {
            cardWidth: 4,
            cardHeight: 5.5,
            cardDepth: 0.1,
            cornerRadius: 0.3,
            cardCount: 3
        });

        this.scene.add(this.world.glassCards.getGroup());

        // ==========================================
        // 3D Model with Holographic Shader
        // ==========================================

        this._reportProgress(70, 'Loading 3D models...');

        this.world.spineModel = new SpineModel();

        // Add model group to scene (model loads async)
        this.scene.add(this.world.spineModel.getGroup());

        // ==========================================
        // Water Surface (Gerstner Waves)
        // ==========================================

        this._reportProgress(75, 'Creating water surface...');

        this.world.waterSurface = new WaterSurface({
            width: 100,
            height: 100,
            widthSegments: 256,
            heightSegments: 256,
            position: new THREE.Vector3(0, -3, 0),
            steepness: 0.5,
            waterColorDeep: new THREE.Color(0x001525),
            waterColorShallow: new THREE.Color(0x1a4d5c),
            waterColorFoam: new THREE.Color(0xffffff),
            lightDirection: new THREE.Vector3(0.5, 0.8, 0.3),
            opacity: 0.85
        });

        // Initially hidden (shown during underwater scene)
        this.world.waterSurface.setVisible(false);
        this.scene.add(this.world.waterSurface.getMesh());

        // ==========================================
        // Test Geometry (Central Sphere)
        // ==========================================

        this._reportProgress(80, 'Creating test geometry...');
        this._createTestGeometry();

        // ==========================================
        // Setup Debug Controls
        // ==========================================

        this._reportProgress(90, 'Setting up debug controls...');

        if (this.debug) {
            this._setupDebugControls();
        }
    }

    /**
     * Create animated gradient background
     * @private
     */
    _createGradientBackground() {
        const bgGeometry = new THREE.PlaneGeometry(2, 2);
        const bgMaterial = new THREE.ShaderMaterial({
            vertexShader: backgroundVertexShader,
            fragmentShader: backgroundFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColorTop: { value: new THREE.Color(0x000022) },
                uColorMiddle: { value: new THREE.Color(0x000044) },
                uColorBottom: { value: new THREE.Color(0x000011) },
                uNoiseScale: { value: 2.5 },
                uNoiseSpeed: { value: 0.15 },
                uNebulaIntensity: { value: 0.3 },
                uStarDensity: { value: 0.003 },
                uGrainIntensity: { value: 0.03 }
            },
            depthTest: false,
            depthWrite: false
        });

        this.backgroundMesh = new THREE.Mesh(bgGeometry, bgMaterial);
        this.backgroundMesh.frustumCulled = false;
        this.backgroundMesh.renderOrder = -1000;

        // Create separate background scene
        this.backgroundScene = new THREE.Scene();
        this.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.backgroundScene.add(this.backgroundMesh);
    }

    /**
     * Create test geometry for visual reference
     * @private
     */
    _createTestGeometry() {
        // Central sphere with standard material
        const sphereGeometry = new THREE.IcosahedronGeometry(0.6, 2);
        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            metalness: 0.8,
            roughness: 0.15,
            envMapIntensity: 1.0,
            emissive: 0x112244,
            emissiveIntensity: 0.5
        });

        this.testSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.testSphere.position.set(0, 0, 0);
        this.testSphere.castShadow = true;
        this.testSphere.receiveShadow = true;
        this.scene.add(this.testSphere);

        // Wireframe overlay
        const wireGeometry = new THREE.IcosahedronGeometry(0.65, 2);
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            wireframe: true,
            transparent: true,
            opacity: 0.4
        });

        this.testWireframe = new THREE.Mesh(wireGeometry, wireMaterial);
        this.testWireframe.position.copy(this.testSphere.position);
        this.scene.add(this.testWireframe);

        // Entrance animation
        gsap.from(this.testSphere.scale, {
            x: 0,
            y: 0,
            z: 0,
            duration: 1.5,
            ease: 'elastic.out(1, 0.5)'
        });

        gsap.from(this.testWireframe.scale, {
            x: 0,
            y: 0,
            z: 0,
            duration: 1.5,
            ease: 'elastic.out(1, 0.5)',
            delay: 0.1
        });
    }

    /**
     * Handle quality level changes from performance manager
     * @param {Object} data - Quality change data
     * @private
     */
    _onQualityChange(data) {
        const { level, preset } = data;

        console.log(`%c[Experience] Quality changed to: ${level}`, 'color: #ffaa44;');

        // Update post-processing
        if (this.passes.bloom) {
            this.passes.bloom.enabled = preset.enableBloom !== false;
            if (preset.bloomStrength) {
                this.passes.bloom.strength = preset.bloomStrength;
            }
        }

        if (this.passes.chromatic) {
            this.passes.chromatic.enabled = preset.enableChromatic !== false;
        }

        if (this.passes.fxaa) {
            this.passes.fxaa.enabled = preset.enableFXAA !== false;
        }

        // Update shadows
        if (this.world.lightingSystem) {
            this.world.lightingSystem.setShadowsEnabled(preset.enableShadows !== false);
            if (preset.shadowMapSize) {
                this.world.lightingSystem.setShadowMapSize(preset.shadowMapSize);
            }
        }

        // Update pixel ratio
        if (preset.pixelRatio) {
            this.renderer.setPixelRatio(Math.min(preset.pixelRatio, window.devicePixelRatio));
        }
    }

    /**
     * Setup debug controls
     * @private
     */
    _setupDebugControls() {
        // ==========================================
        // Performance Controls
        // ==========================================

        const perfFolder = this.debug.addFolder('Performance');

        const perfParams = {
            quality: this.performanceManager.currentLevel,
            autoAdjust: true
        };

        perfFolder.add(perfParams, 'quality', Object.values(QualityLevels))
            .name('Quality Level')
            .onChange((value) => {
                this.performanceManager.setQuality(value);
            });

        perfFolder.add(perfParams, 'autoAdjust').name('Auto Adjust').onChange((value) => {
            this.performanceManager.setAutoAdjust(value);
        });

        // ==========================================
        // Camera Controls
        // ==========================================

        const cameraFolder = this.debug.addFolder('Camera');
        cameraFolder.add(this.app.cameraManager, 'lerpFactor', 0.01, 0.2).name('Lerp Factor');
        cameraFolder.add(this.app.cameraManager, 'parallaxIntensity', 0, 2).name('Parallax');
        cameraFolder.add(this.app.cameraManager, 'parallaxEnabled').name('Enable Parallax');

        // ==========================================
        // Post-Processing Controls
        // ==========================================

        const postFolder = this.debug.addFolder('Post-Processing');

        // Master toggle
        const postParams = {
            enabled: this.postProcessingEnabled
        };
        postFolder.add(postParams, 'enabled').name('Enable All').onChange((value) => {
            this.postProcessingEnabled = value;
        });

        // Bloom controls
        const bloomFolder = postFolder.addFolder('Bloom');
        bloomFolder.add(this.passes.bloom, 'enabled').name('Enable');
        bloomFolder.add(this.passes.bloom, 'strength', 0, 3).name('Strength');
        bloomFolder.add(this.passes.bloom, 'radius', 0, 1).name('Radius');
        bloomFolder.add(this.passes.bloom, 'threshold', 0, 1).name('Threshold');

        // Chromatic Aberration controls
        const chromaticFolder = postFolder.addFolder('Chromatic Aberration');
        chromaticFolder.add(this.passes.chromatic, 'enabled').name('Enable');

        const chromaticParams = {
            intensity: 0.003,
            radialIntensity: 0.5
        };
        chromaticFolder.add(chromaticParams, 'intensity', 0, 0.02).name('Intensity').onChange((value) => {
            this.passes.chromatic.setIntensity(value);
        });
        chromaticFolder.add(chromaticParams, 'radialIntensity', 0, 2).name('Radial').onChange((value) => {
            this.passes.chromatic.setRadialIntensity(value);
        });

        // DOF controls
        const dofFolder = postFolder.addFolder('Depth of Field');
        dofFolder.add(this.passes.dof, 'enabled').name('Enable');

        const dofParams = {
            focus: 0.5,
            aperture: 0.015,
            maxBlur: 0.015,
            focusRange: 3.0
        };
        dofFolder.add(dofParams, 'focus', 0, 1).name('Focus Distance').onChange((value) => {
            this.passes.dof.setFocus(value);
        });
        dofFolder.add(dofParams, 'aperture', 0, 0.1).name('Aperture').onChange((value) => {
            this.passes.dof.setAperture(value);
        });
        dofFolder.add(dofParams, 'maxBlur', 0, 0.05).name('Max Blur').onChange((value) => {
            this.passes.dof.setMaxBlur(value);
        });

        // Vignette controls
        const vignetteFolder = postFolder.addFolder('Vignette & Color');
        vignetteFolder.add(this.passes.vignette, 'enabled').name('Enable');

        const vignetteParams = {
            preset: 'cinematic',
            vignetteIntensity: 0.35,
            brightness: 0.0,
            contrast: 0.1,
            saturation: 0.1
        };

        vignetteFolder.add(vignetteParams, 'preset', ['neutral', 'cinematic', 'warm', 'cold', 'vintage', 'scifi'])
            .name('Preset')
            .onChange((value) => {
                this.passes.vignette.setPreset(value);
            });

        vignetteFolder.add(vignetteParams, 'vignetteIntensity', 0, 1).name('Vignette').onChange((value) => {
            this.passes.vignette.setVignetteIntensity(value);
        });

        // FXAA
        postFolder.add(this.passes.fxaa, 'enabled').name('FXAA');

        // ==========================================
        // Lighting Controls
        // ==========================================

        const lightFolder = this.debug.addFolder('Lighting');

        const lightParams = {
            preset: 'dramatic'
        };

        lightFolder.add(lightParams, 'preset', ['neutral', 'dramatic', 'soft', 'night'])
            .name('Preset')
            .onChange((value) => {
                this.world.lightingSystem.setPreset(value);
            });

        // ==========================================
        // Particles Controls
        // ==========================================

        const particlesFolder = this.debug.addFolder('Particles');

        const particleParams = {
            color: '#4488ff',
            colorEnd: '#ff4488',
            size: 25,
            flowScale: 0.12,
            flowSpeed: 0.25,
            flowStrength: 2.5,
            mouseRadius: 4.0,
            mouseStrength: 8.0
        };

        particlesFolder.addColor(particleParams, 'color').name('Start Color').onChange((value) => {
            this.world.particles.setColor(value);
        });

        particlesFolder.addColor(particleParams, 'colorEnd').name('End Color').onChange((value) => {
            this.world.particles.material.uniforms.uColorEnd.value.set(value);
        });

        particlesFolder.add(particleParams, 'size', 5, 100).name('Size').onChange((value) => {
            this.world.particles.setSize(value);
        });

        particlesFolder.add(particleParams, 'flowScale', 0.01, 0.5).name('Flow Scale').onChange((value) => {
            this.world.particles.setFlowField({ scale: value });
        });

        particlesFolder.add(particleParams, 'flowSpeed', 0, 1).name('Flow Speed').onChange((value) => {
            this.world.particles.setFlowField({ speed: value });
        });

        particlesFolder.add(particleParams, 'mouseRadius', 1, 10).name('Mouse Radius').onChange((value) => {
            this.world.particles.setMouseParams({ radius: value });
        });

        particlesFolder.add(particleParams, 'mouseStrength', -20, 20).name('Mouse Force').onChange((value) => {
            this.world.particles.setMouseParams({ strength: value });
        });

        // ==========================================
        // Glass Cards Controls
        // ==========================================

        const glassFolder = this.debug.addFolder('Glass Cards');

        const glassParams = {
            opacity: 0.7,
            blur: 0.6,
            refraction: 0.15,
            chromatic: 0.015
        };

        glassFolder.add(glassParams, 'opacity', 0.3, 1.0).name('Opacity').onChange((value) => {
            this.world.glassCards.getCards().forEach(card => {
                card.material.uniforms.uOpacity.value = value;
            });
        });

        glassFolder.add(glassParams, 'blur', 0, 1).name('Blur').onChange((value) => {
            this.world.glassCards.getCards().forEach(card => {
                card.material.uniforms.uBlur.value = value;
            });
        });

        // ==========================================
        // Model Controls
        // ==========================================

        const modelFolder = this.debug.addFolder('3D Model');

        const modelParams = {
            materialType: 'holographic',
            autoRotate: true,
            rotationSpeedY: 0.3
        };

        modelFolder.add(modelParams, 'materialType', ['holographic', 'metallic', 'wireframe', 'original'])
            .name('Material')
            .onChange((value) => {
                this.world.spineModel.setMaterialType(value);
            });

        modelFolder.add(modelParams, 'autoRotate').name('Auto Rotate').onChange((value) => {
            this.world.spineModel.setAutoRotate(value);
        });

        modelFolder.add(modelParams, 'rotationSpeedY', 0, 2).name('Rotation Speed').onChange((value) => {
            this.world.spineModel.setRotationSpeed(0, value, 0);
        });
    }

    /**
     * Pause the experience
     */
    pause() {
        this._isPaused = true;
        if (this.app.time) {
            this.app.time.pause();
        }
        console.log('%c[Experience] Paused', 'color: #ffaa44;');
    }

    /**
     * Resume the experience
     */
    resume() {
        this._isPaused = false;
        if (this.app.time) {
            this.app.time.resume();
        }
        console.log('%c[Experience] Resumed', 'color: #88ff88;');
    }

    /**
     * Update loop - called every frame
     * @param {Object} data - Update data with deltaTime and elapsedTime
     * @private
     */
    _update({ deltaTime, elapsedTime }) {
        if (this._isPaused) return;

        // Update scroll manager (must be called every frame for smooth scrolling)
        if (this.scrollManager) {
            this.scrollManager.update(deltaTime);
        }

        // Update performance manager
        if (this.performanceManager) {
            this.performanceManager.update(deltaTime);
        }

        // Update background shader time
        if (this.backgroundMesh) {
            this.backgroundMesh.material.uniforms.uTime.value = elapsedTime;
        }

        // Update world components
        if (this.world.environment) {
            this.world.environment.update(elapsedTime);
        }

        // Update lighting system
        if (this.world.lightingSystem) {
            this.world.lightingSystem.update(elapsedTime, deltaTime);
        }

        // Update particles with deltaTime and camera
        if (this.world.particles) {
            this.world.particles.update(elapsedTime, deltaTime, this.camera);
        }

        // Capture background for glass refraction effect
        if (this.world.glassCards) {
            this.world.glassCards.captureBackground(this.scene, this.camera);
            this.world.glassCards.update(elapsedTime, deltaTime);
        }

        // Update 3D model
        if (this.world.spineModel) {
            this.world.spineModel.update(elapsedTime, deltaTime);
        }

        // Update water surface
        if (this.world.waterSurface) {
            this.world.waterSurface.update(elapsedTime, deltaTime);
        }

        // Animate test geometry
        if (this.testSphere) {
            this.testSphere.rotation.x += deltaTime * 0.3;
            this.testSphere.rotation.y += deltaTime * 0.5;
            this.testSphere.position.y = Math.sin(elapsedTime) * 0.15;
        }

        if (this.testWireframe) {
            this.testWireframe.rotation.copy(this.testSphere.rotation);
            this.testWireframe.position.copy(this.testSphere.position);
        }

        // ==========================================
        // Render
        // ==========================================

        // Render background first
        if (this.backgroundScene && this.backgroundCamera) {
            this.renderer.autoClear = false;
            this.renderer.clear();
            this.renderer.render(this.backgroundScene, this.backgroundCamera);
        }

        // Render main scene with post-processing
        if (this.postProcessingEnabled && this.composer) {
            this.composer.render(deltaTime);
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        this.renderer.autoClear = true;
    }

    /**
     * Handle window resize
     * @param {Object} sizes - New viewport sizes
     * @private
     */
    _onResize(sizes) {
        const { width, height, pixelRatio } = sizes;

        // Update composer size
        if (this.composer) {
            this.composer.setSize(width, height);
        }

        // Update FXAA resolution
        if (this.passes.fxaa) {
            this.passes.fxaa.uniforms['resolution'].value.set(
                1 / (width * pixelRatio),
                1 / (height * pixelRatio)
            );
        }

        // Update DOF pass size
        if (this.passes.dof) {
            this.passes.dof.setSize(width, height);
        }

        // Update vignette pass size
        if (this.passes.vignette) {
            this.passes.vignette.setSize(width, height);
        }

        // Update glass cards
        if (this.world.glassCards) {
            this.world.glassCards.handleResize(width, height);
        }
    }

    /**
     * Toggle post-processing
     * @param {boolean} enabled
     */
    setPostProcessingEnabled(enabled) {
        this.postProcessingEnabled = enabled;
    }

    /**
     * Get post-processing pass by name
     * @param {string} name
     * @returns {Pass|undefined}
     */
    getPass(name) {
        return this.passes[name];
    }

    /**
     * Get the singleton instance
     * @returns {Experience|null}
     */
    static getInstance() {
        return Experience.instance;
    }

    /**
     * Clean up all resources
     */
    dispose() {
        console.log('%c[Experience] Disposing...', 'color: #ffff44;');

        // Remove mouse events
        window.removeEventListener('mousemove', this._handleMouseMove);
        window.removeEventListener('mouseleave', this._handleMouseLeave);
        window.removeEventListener('click', this._handleClick);

        // Dispose cursor effects
        if (this.cursorEffects) {
            this.cursorEffects.dispose();
        }

        // Dispose mobile support
        if (this.mobileSupport) {
            this.mobileSupport.dispose();
        }

        // Dispose scroll manager
        if (this.scrollManager) {
            this.scrollManager.dispose();
        }

        // Dispose performance manager
        if (this.performanceManager) {
            this.performanceManager.dispose();
        }

        // Dispose world components
        if (this.world.environment) {
            this.world.environment.dispose();
        }

        if (this.world.lightingSystem) {
            this.world.lightingSystem.dispose();
        }

        if (this.world.particles) {
            this.world.particles.dispose();
        }

        if (this.world.glassCards) {
            this.world.glassCards.dispose();
        }

        if (this.world.spineModel) {
            this.world.spineModel.dispose();
        }

        if (this.world.waterSurface) {
            this.world.waterSurface.dispose();
        }

        // Dispose test geometry
        if (this.testSphere) {
            this.testSphere.geometry.dispose();
            this.testSphere.material.dispose();
        }

        if (this.testWireframe) {
            this.testWireframe.geometry.dispose();
            this.testWireframe.material.dispose();
        }

        // Dispose background
        if (this.backgroundMesh) {
            this.backgroundMesh.geometry.dispose();
            this.backgroundMesh.material.dispose();
        }

        // Dispose post-processing
        if (this.passes.chromatic) {
            this.passes.chromatic.dispose();
        }
        if (this.passes.dof) {
            this.passes.dof.dispose();
        }
        if (this.passes.vignette) {
            this.passes.vignette.dispose();
        }
        if (this.composer) {
            this.composer.dispose();
        }

        // Dispose app
        this.app.dispose();

        Experience.instance = null;

        console.log('%c[Experience] Disposed', 'color: #ffff44;');
    }
}

export { Experience };
export default Experience;
