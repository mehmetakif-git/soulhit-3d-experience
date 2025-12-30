/**
 * GlassCards.js
 * Professional Glassmorphic 3D Card System
 *
 * Features:
 * - Frosted glass blur effect
 * - Physical refraction with IOR
 * - Fresnel rim lighting
 * - Chromatic aberration
 * - Hover state animations
 * - Mouse parallax rotation
 * - Iridescent color effects
 */

import * as THREE from 'three';
import gsap from 'gsap';

// Import shaders
import vertexShader from '../shaders/glass/vertex.glsl?raw';
import fragmentShader from '../shaders/glass/fragment.glsl?raw';

/**
 * @class GlassCards
 * @description Creates and manages professional glassmorphic cards
 */
class GlassCards {
    /**
     * Create glass cards manager
     * @param {THREE.WebGLRenderer} renderer - WebGL renderer for background capture
     * @param {Object} options - Configuration options
     */
    constructor(renderer, options = {}) {
        const {
            cardWidth = 4,
            cardHeight = 5.5,
            cardDepth = 0.1,
            cornerRadius = 0.3,
            cardCount = 3
        } = options;

        /** @type {THREE.WebGLRenderer} */
        this.renderer = renderer;

        /** @type {THREE.Group} Container for all cards */
        this.group = new THREE.Group();

        /** @type {Array<Object>} Card references */
        this.cards = [];

        /** @type {Object} Default card dimensions */
        this.dimensions = {
            width: cardWidth,
            height: cardHeight,
            depth: cardDepth,
            cornerRadius
        };

        /** @type {number} Number of cards to create */
        this.cardCount = cardCount;

        /** @type {THREE.Vector2} Mouse position normalized (-1 to 1) */
        this.mouse = new THREE.Vector2(0, 0);

        /** @type {THREE.Vector2} Smoothed mouse for parallax */
        this.smoothMouse = new THREE.Vector2(0, 0);

        /** @type {Object|null} Currently hovered card */
        this.hoveredCard = null;

        /** @type {THREE.WebGLRenderTarget} Background capture for refraction */
        this.backgroundTarget = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType
            }
        );

        // Initialize cards
        this._initCards();

        console.log('%c[GlassCards] Professional glassmorphic cards initialized', 'color: #88aaff;');
    }

    /**
     * Initialize all glass cards
     * @private
     */
    _initCards() {
        // Card configurations - spread in 3D space
        const cardConfigs = [
            {
                position: { x: -5, y: 0.5, z: 0 },
                rotation: { x: 0, y: 0.2, z: 0 },
                color: new THREE.Color(0.4, 0.6, 1.0),      // Blue tint
                fresnelColor: new THREE.Color(0.6, 0.8, 1.0)
            },
            {
                position: { x: 0, y: 0, z: 1 },
                rotation: { x: 0, y: 0, z: 0 },
                color: new THREE.Color(0.8, 0.4, 1.0),      // Purple tint
                fresnelColor: new THREE.Color(1.0, 0.6, 1.0)
            },
            {
                position: { x: 5, y: -0.5, z: 0 },
                rotation: { x: 0, y: -0.2, z: 0 },
                color: new THREE.Color(0.4, 1.0, 0.8),      // Cyan tint
                fresnelColor: new THREE.Color(0.6, 1.0, 0.9)
            },
            {
                position: { x: 2.5, y: 2, z: -1 },
                rotation: { x: 0.1, y: -0.1, z: 0.05 },
                color: new THREE.Color(1.0, 0.6, 0.4),      // Orange tint
                fresnelColor: new THREE.Color(1.0, 0.8, 0.6)
            }
        ];

        // Create cards based on cardCount
        for (let i = 0; i < Math.min(this.cardCount, cardConfigs.length); i++) {
            this.createCard(cardConfigs[i]);
        }
    }

    /**
     * Create a single glass card
     * @param {Object} config - Card configuration
     * @returns {Object} Card object with mesh and methods
     */
    createCard(config = {}) {
        const {
            position = { x: 0, y: 0, z: 0 },
            rotation = { x: 0, y: 0, z: 0 },
            color = new THREE.Color(0.6, 0.8, 1.0),
            fresnelColor = new THREE.Color(0.8, 0.9, 1.0)
        } = config;

        // Create rounded box geometry with beveled edges
        const geometry = this._createRoundedBoxGeometry(
            this.dimensions.width,
            this.dimensions.height,
            this.dimensions.depth,
            this.dimensions.cornerRadius
        );

        // Create glassmorphic material with all uniforms
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                // Time and animation
                uTime: { value: 0 },
                uHover: { value: 0 },

                // Mouse for parallax
                uMouse: { value: new THREE.Vector2(0, 0) },
                uParallaxStrength: { value: 0.5 },

                // Glass properties
                uOpacity: { value: 0.7 },
                uBlur: { value: 0.6 },
                uRefraction: { value: 0.15 },
                uIOR: { value: 1.45 },
                uChromatic: { value: 0.015 },

                // Colors
                uColor: { value: color },
                uFresnelColor: { value: fresnelColor },
                uFresnelPower: { value: 2.5 },

                // Background texture for refraction
                uBackgroundTexture: { value: this.backgroundTarget.texture },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },

                // Content effects
                uGlowStrength: { value: 0.5 },
                uBorderRadius: { value: 0.1 }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);

        // Store original transforms for hover animation
        const originalPosition = { ...position };
        const originalRotation = { ...rotation };
        const originalScale = { x: 1, y: 1, z: 1 };

        // Card object with all properties and methods
        const card = {
            mesh,
            material,
            geometry,
            originalPosition,
            originalRotation,
            originalScale,
            isHovered: false,
            hoverProgress: 0,

            /**
             * Update card uniforms
             * @param {number} time - Elapsed time
             */
            update: (time) => {
                material.uniforms.uTime.value = time;
            },

            /**
             * Set hover state with animation
             * @param {boolean} hovered
             */
            setHovered: (hovered) => {
                if (card.isHovered === hovered) return;
                card.isHovered = hovered;

                // Animate hover uniform
                gsap.to(material.uniforms.uHover, {
                    value: hovered ? 1 : 0,
                    duration: 0.4,
                    ease: 'power2.out'
                });

                // Scale animation (1.05x on hover)
                gsap.to(mesh.scale, {
                    x: hovered ? 1.05 : 1,
                    y: hovered ? 1.05 : 1,
                    z: hovered ? 1.05 : 1,
                    duration: 0.4,
                    ease: 'power2.out'
                });

                // Slight Z push forward on hover
                gsap.to(mesh.position, {
                    z: originalPosition.z + (hovered ? 0.5 : 0),
                    duration: 0.4,
                    ease: 'power2.out'
                });

                // Increase glow on hover
                gsap.to(material.uniforms.uGlowStrength, {
                    value: hovered ? 1.0 : 0.5,
                    duration: 0.4,
                    ease: 'power2.out'
                });

                // Increase fresnel on hover
                gsap.to(material.uniforms.uFresnelPower, {
                    value: hovered ? 3.5 : 2.5,
                    duration: 0.4,
                    ease: 'power2.out'
                });
            },

            /**
             * Update mouse position for parallax
             * @param {THREE.Vector2} mouse - Normalized mouse position
             */
            setMouse: (mouse) => {
                material.uniforms.uMouse.value.copy(mouse);
            },

            /**
             * Set card position
             */
            setPosition: (x, y, z) => {
                mesh.position.set(x, y, z);
                originalPosition.x = x;
                originalPosition.y = y;
                originalPosition.z = z;
            },

            /**
             * Set card rotation
             */
            setRotation: (x, y, z) => {
                mesh.rotation.set(x, y, z);
                originalRotation.x = x;
                originalRotation.y = y;
                originalRotation.z = z;
            },

            /**
             * Clean up resources
             */
            dispose: () => {
                geometry.dispose();
                material.dispose();
            }
        };

        // Enable raycasting on mesh
        mesh.userData.card = card;

        // Add to group and registry
        this.group.add(mesh);
        this.cards.push(card);

        return card;
    }

    /**
     * Create rounded box geometry
     * @param {number} width
     * @param {number} height
     * @param {number} depth
     * @param {number} radius
     * @returns {THREE.BufferGeometry}
     * @private
     */
    _createRoundedBoxGeometry(width, height, depth, radius) {
        // Create 2D rounded rectangle shape
        const shape = new THREE.Shape();
        const x = -width / 2;
        const y = -height / 2;

        shape.moveTo(x + radius, y);
        shape.lineTo(x + width - radius, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + radius);
        shape.lineTo(x + width, y + height - radius);
        shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        shape.lineTo(x + radius, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - radius);
        shape.lineTo(x, y + radius);
        shape.quadraticCurveTo(x, y, x + radius, y);

        // Extrude to create 3D geometry
        const extrudeSettings = {
            depth: depth,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 3
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Center the geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Compute normals for proper lighting
        geometry.computeVertexNormals();

        return geometry;
    }

    /**
     * Update mouse position
     * @param {number} x - Normalized X (-1 to 1)
     * @param {number} y - Normalized Y (-1 to 1)
     */
    setMouse(x, y) {
        this.mouse.set(x, y);
    }

    /**
     * Check for hover on cards
     * @param {THREE.Raycaster} raycaster
     * @returns {Object|null} Hovered card or null
     */
    checkHover(raycaster) {
        const intersects = raycaster.intersectObjects(
            this.cards.map(c => c.mesh),
            false
        );

        let newHovered = null;

        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            newHovered = mesh.userData.card;
        }

        // Update hover states
        if (newHovered !== this.hoveredCard) {
            // Un-hover previous
            if (this.hoveredCard) {
                this.hoveredCard.setHovered(false);
            }

            // Hover new
            if (newHovered) {
                newHovered.setHovered(true);
            }

            this.hoveredCard = newHovered;
        }

        return newHovered;
    }

    /**
     * Capture background for refraction effect
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    captureBackground(scene, camera) {
        // Temporarily hide glass cards
        this.group.visible = false;

        // Render scene to background target
        this.renderer.setRenderTarget(this.backgroundTarget);
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(null);

        // Show glass cards again
        this.group.visible = true;
    }

    /**
     * Update all cards
     * @param {number} elapsedTime - Total elapsed time
     * @param {number} deltaTime - Time since last frame
     */
    update(elapsedTime, deltaTime) {
        // Smooth mouse movement for parallax
        this.smoothMouse.lerp(this.mouse, deltaTime * 5);

        // Update each card
        this.cards.forEach(card => {
            card.update(elapsedTime);
            card.setMouse(this.smoothMouse);
        });
    }

    /**
     * Handle window resize
     * @param {number} width
     * @param {number} height
     */
    handleResize(width, height) {
        // Resize background render target
        this.backgroundTarget.setSize(width, height);

        // Update resolution uniform
        const resolution = new THREE.Vector2(width, height);
        this.cards.forEach(card => {
            card.material.uniforms.uResolution.value = resolution;
        });
    }

    /**
     * Get the container group
     * @returns {THREE.Group}
     */
    getGroup() {
        return this.group;
    }

    /**
     * Get all cards
     * @returns {Array}
     */
    getCards() {
        return this.cards;
    }

    /**
     * Get meshes for raycasting
     * @returns {Array<THREE.Mesh>}
     */
    getMeshes() {
        return this.cards.map(c => c.mesh);
    }

    /**
     * Remove a specific card
     * @param {Object} card
     */
    removeCard(card) {
        const index = this.cards.indexOf(card);
        if (index > -1) {
            this.group.remove(card.mesh);
            card.dispose();
            this.cards.splice(index, 1);
        }
    }

    /**
     * Clean up all resources
     */
    dispose() {
        // Dispose all cards
        this.cards.forEach(card => {
            this.group.remove(card.mesh);
            card.dispose();
        });
        this.cards = [];

        // Dispose render target
        this.backgroundTarget.dispose();

        console.log('%c[GlassCards] Disposed', 'color: #88aaff;');
    }
}

export { GlassCards };
export default GlassCards;
