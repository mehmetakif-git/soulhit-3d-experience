/**
 * Particles.js
 * Advanced GPU Particle System using GPUComputationRenderer
 *
 * This system uses Frame Buffer Objects (FBOs) to compute particle physics
 * entirely on the GPU, enabling 50,000+ particles at 60fps.
 *
 * Architecture:
 * 1. Two FBO textures: Position and Velocity
 * 2. Compute shaders update Position/Velocity each frame
 * 3. Render shader reads Position FBO to display particles
 *
 * FBO Explanation:
 * - Instead of storing particle data in arrays (CPU), we store it in textures (GPU)
 * - Each pixel in the texture = one particle
 * - A 256x256 texture can store 65,536 particles
 * - The GPU processes all pixels in parallel = massive speedup
 *
 * Ping-Pong Technique:
 * - We need to read from and write to particle data each frame
 * - Can't read and write to same texture simultaneously
 * - Solution: Use two textures, swap between them each frame
 * - Frame N: Read from A, write to B
 * - Frame N+1: Read from B, write to A
 * - GPUComputationRenderer handles this automatically
 */

import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

// Import compute shaders
import computePositionShader from '../shaders/particles/compute-position.glsl?raw';
import computeVelocityShader from '../shaders/particles/compute-velocity.glsl?raw';

// Import render shaders
import renderVertexShader from '../shaders/particles/vertex.glsl?raw';
import renderFragmentShader from '../shaders/particles/fragment.glsl?raw';

/**
 * @class Particles
 * @description GPU-accelerated particle system using FBO computation
 */
class Particles {
    /**
     * Create GPU particle system
     * @param {THREE.WebGLRenderer} renderer - WebGL renderer for GPU computation
     * @param {Object} options - Configuration options
     */
    constructor(renderer, options = {}) {
        // ==========================================
        // Configuration
        // ==========================================

        const {
            // Particle count (will be squared for texture size)
            // 256 = 65,536 particles, 224 = 50,176 particles
            textureSize = 224,

            // Simulation bounds
            boundsRadius = 12,

            // Particle appearance
            size = 30,
            color = 0x4488ff,
            colorEnd = 0xff4488,

            // Flow field settings
            flowFieldScale = 0.15,
            flowFieldSpeed = 0.3,
            flowFieldStrength = 2.0,

            // Physics
            damping = 3.0,
            turbulence = 0.8,
            maxVelocity = 5.0,

            // Lifetime
            lifetimeMin = 3.0,
            lifetimeMax = 8.0,

            // Mouse interaction
            mouseRadius = 3.0,
            mouseStrength = 5.0
        } = options;

        /** @type {THREE.WebGLRenderer} */
        this.renderer = renderer;

        /** @type {number} Texture dimensions (particles = textureSize^2) */
        this.textureSize = textureSize;

        /** @type {number} Total particle count */
        this.count = textureSize * textureSize;

        /** @type {number} Simulation bounds */
        this.boundsRadius = boundsRadius;

        // Store settings for updates
        this.settings = {
            size,
            color: new THREE.Color(color),
            colorEnd: new THREE.Color(colorEnd),
            flowFieldScale,
            flowFieldSpeed,
            flowFieldStrength,
            damping,
            turbulence,
            maxVelocity,
            lifetimeMin,
            lifetimeMax,
            mouseRadius,
            mouseStrength
        };

        // ==========================================
        // Mouse Tracking
        // ==========================================

        /** @type {THREE.Vector3} Mouse position in 3D space */
        this.mousePosition = new THREE.Vector3(0, 0, 0);

        /** @type {boolean} Is mouse active */
        this.mouseActive = false;

        // ==========================================
        // Initialize Systems
        // ==========================================

        this._initGPUComputation();
        this._initParticleGeometry();
        this._initParticleMaterial();
        this._initMesh();

        // Handle resize
        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);

        console.log(`%c[Particles] GPU System initialized with ${this.count.toLocaleString()} particles`, 'color: #44ff88; font-weight: bold;');
    }

    /**
     * Initialize GPUComputationRenderer and FBO textures
     * @private
     */
    _initGPUComputation() {
        // ==========================================
        // Create GPU Computation Renderer
        // ==========================================

        /**
         * GPUComputationRenderer creates a separate render pipeline for computation.
         * It manages FBO textures and ping-pong swapping automatically.
         */
        this.gpuCompute = new GPUComputationRenderer(
            this.textureSize,
            this.textureSize,
            this.renderer
        );

        // Check for WebGL 2 float texture support
        if (!this.renderer.capabilities.isWebGL2) {
            console.warn('[Particles] WebGL 2 not available, falling back...');
        }

        // ==========================================
        // Create Initial Data Textures
        // ==========================================

        /**
         * Create textures with initial particle data.
         * Each pixel stores: RGBA = XYZ position + lifetime (or velocity + unused)
         */

        // Position texture: XYZ position + W lifetime
        const positionTexture = this.gpuCompute.createTexture();
        this._fillPositionTexture(positionTexture);

        // Velocity texture: XYZ velocity + W unused
        const velocityTexture = this.gpuCompute.createTexture();
        this._fillVelocityTexture(velocityTexture);

        // ==========================================
        // Create Compute Variables
        // ==========================================

        /**
         * A "variable" in GPUComputationRenderer represents a texture that gets
         * updated each frame by a fragment shader.
         */

        // Velocity variable (computed first - needs position for force calculations)
        this.velocityVariable = this.gpuCompute.addVariable(
            'textureVelocity',
            computeVelocityShader,
            velocityTexture
        );

        // Position variable (computed second - uses velocity to update position)
        this.positionVariable = this.gpuCompute.addVariable(
            'texturePosition',
            computePositionShader,
            positionTexture
        );

        // ==========================================
        // Set Dependencies
        // ==========================================

        /**
         * Variables can depend on other variables (and themselves).
         * This creates the texture samplers available in the compute shaders.
         */

        // Velocity shader needs: position (for force calculations) and velocity (for damping)
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [
            this.positionVariable,
            this.velocityVariable
        ]);

        // Position shader needs: position (current pos) and velocity (to add)
        this.gpuCompute.setVariableDependencies(this.positionVariable, [
            this.positionVariable,
            this.velocityVariable
        ]);

        // ==========================================
        // Set Uniforms
        // ==========================================

        // Position shader uniforms
        const positionUniforms = this.positionVariable.material.uniforms;
        positionUniforms.uTime = { value: 0 };
        positionUniforms.uDeltaTime = { value: 0.016 };
        positionUniforms.uBoundsRadius = { value: this.boundsRadius };
        positionUniforms.uLifetimeMin = { value: this.settings.lifetimeMin };
        positionUniforms.uLifetimeMax = { value: this.settings.lifetimeMax };

        // Velocity shader uniforms
        const velocityUniforms = this.velocityVariable.material.uniforms;
        velocityUniforms.uTime = { value: 0 };
        velocityUniforms.uDeltaTime = { value: 0.016 };
        velocityUniforms.uFlowFieldScale = { value: this.settings.flowFieldScale };
        velocityUniforms.uFlowFieldSpeed = { value: this.settings.flowFieldSpeed };
        velocityUniforms.uFlowFieldStrength = { value: this.settings.flowFieldStrength };
        velocityUniforms.uMousePosition = { value: this.mousePosition };
        velocityUniforms.uMouseRadius = { value: this.settings.mouseRadius };
        velocityUniforms.uMouseStrength = { value: this.settings.mouseStrength };
        velocityUniforms.uDamping = { value: this.settings.damping };
        velocityUniforms.uTurbulence = { value: this.settings.turbulence };
        velocityUniforms.uMaxVelocity = { value: this.settings.maxVelocity };

        // ==========================================
        // Initialize GPU Computation
        // ==========================================

        // Debug: Log shader sources before compilation
        console.log('%c=== POSITION SHADER UNIFORMS ===', 'color: #ff88ff;');
        console.log('Uniforms:', Object.keys(this.positionVariable.material.uniforms));

        console.log('%c=== VELOCITY SHADER UNIFORMS ===', 'color: #ff88ff;');
        console.log('Uniforms:', Object.keys(this.velocityVariable.material.uniforms));

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error('%c[Particles] GPU Computation error:', 'color: #ff4444; font-weight: bold;', error);

            // Log detailed shader info for debugging
            console.log('%c=== POSITION SHADER SOURCE ===', 'color: #ffaa00;');
            console.log(this.positionVariable.material.fragmentShader);

            console.log('%c=== VELOCITY SHADER SOURCE ===', 'color: #ffaa00;');
            console.log(this.velocityVariable.material.fragmentShader);

            // Try to get WebGL error details
            const gl = this.renderer.getContext();
            if (gl) {
                const glError = gl.getError();
                if (glError !== gl.NO_ERROR) {
                    console.error('[Particles] WebGL Error Code:', glError);
                }
            }
        } else {
            console.log('%c[Particles] GPU Computation initialized successfully', 'color: #44ff88;');
        }
    }

    /**
     * Fill position texture with initial particle positions
     * @param {THREE.DataTexture} texture
     * @private
     */
    _fillPositionTexture(texture) {
        const data = texture.image.data;
        const radius = this.boundsRadius * 0.5;

        for (let i = 0; i < data.length; i += 4) {
            // Random spherical position
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = radius * Math.cbrt(Math.random());

            // XYZ position
            data[i + 0] = r * Math.sin(phi) * Math.cos(theta);     // X
            data[i + 1] = r * Math.sin(phi) * Math.sin(theta);     // Y
            data[i + 2] = r * Math.cos(phi);                        // Z

            // W = lifetime (random 0-1, will be managed by shader)
            data[i + 3] = Math.random();
        }
    }

    /**
     * Fill velocity texture with initial velocities
     * @param {THREE.DataTexture} texture
     * @private
     */
    _fillVelocityTexture(texture) {
        const data = texture.image.data;

        for (let i = 0; i < data.length; i += 4) {
            // Small random initial velocity
            data[i + 0] = (Math.random() - 0.5) * 0.5;  // X velocity
            data[i + 1] = (Math.random() - 0.5) * 0.5;  // Y velocity
            data[i + 2] = (Math.random() - 0.5) * 0.5;  // Z velocity
            data[i + 3] = 1.0;                           // Unused
        }
    }

    /**
     * Initialize particle geometry with reference UVs
     * @private
     */
    _initParticleGeometry() {
        /**
         * The geometry only needs one vertex per particle.
         * Instead of position, we store UV coordinates that reference
         * the particle's data in the FBO texture.
         */

        this.geometry = new THREE.BufferGeometry();

        // Create reference UVs (one per particle)
        const references = new Float32Array(this.count * 2);

        for (let i = 0; i < this.count; i++) {
            // Calculate UV for this particle in the FBO texture
            const x = (i % this.textureSize) / this.textureSize;
            const y = Math.floor(i / this.textureSize) / this.textureSize;

            // Offset to center of pixel
            references[i * 2 + 0] = x + 0.5 / this.textureSize;
            references[i * 2 + 1] = y + 0.5 / this.textureSize;
        }

        // Set reference attribute (used in vertex shader to sample FBO)
        this.geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2));

        // We still need a position attribute for Three.js, but it's not used
        // The actual position comes from the FBO texture
        const positions = new Float32Array(this.count * 3);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // CRITICAL: Set explicit draw range for all particles
        // Without this, Three.js may not render all vertices
        this.geometry.setDrawRange(0, this.count);

        // CRITICAL: Set a bounding sphere that encompasses all possible particle positions
        // Since positions are computed on GPU, we need to set this manually
        // Without this, the geometry may be culled or have rendering issues
        this.geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(0, 0, 0),
            this.boundsRadius * 2  // Extra margin for particle movement
        );

        console.log(`%c[Particles] Geometry initialized: ${this.count} particles, bounds radius: ${this.boundsRadius * 2}`, 'color: #44ff88;');
    }

    /**
     * Initialize particle render material
     * @private
     */
    _initParticleMaterial() {
        this.material = new THREE.ShaderMaterial({
            vertexShader: renderVertexShader,
            fragmentShader: renderFragmentShader,
            uniforms: {
                // FBO texture (will be updated each frame)
                texturePosition: { value: null },

                // Time
                uTime: { value: 0 },

                // Appearance
                uSize: { value: this.settings.size },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uCameraDistance: { value: 10 },

                // Colors
                uColor: { value: this.settings.color },
                uColorEnd: { value: this.settings.colorEnd },

                // Glow
                uGlowStrength: { value: 0.5 },
                uCoreSize: { value: 0.3 },

                // Variation
                uSizeVariation: { value: 0.5 },
                uAlphaVariation: { value: 0.3 }
            },
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending
        });
    }

    /**
     * Initialize the particle mesh
     * @private
     */
    _initMesh() {
        this.mesh = new THREE.Points(this.geometry, this.material);
        this.mesh.frustumCulled = false; // Always render (particles move unpredictably)

        // Debug: Log shader info after first render
        this._debugShaderOnce = true;
    }

    /**
     * Debug shader compilation (called once)
     * @private
     */
    _debugShaderInfo() {
        if (!this._debugShaderOnce) return;
        this._debugShaderOnce = false;

        // Check for shader compilation errors
        const gl = this.renderer.getContext();
        const program = this.renderer.properties.get(this.material).currentProgram;

        if (program) {
            const vertexShader = program.vertexShader;
            const fragmentShader = program.fragmentShader;

            // Check vertex shader
            if (vertexShader && !gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                console.error('%c[Particles] Vertex Shader Error:', 'color: #ff4444; font-weight: bold;');
                console.error(gl.getShaderInfoLog(vertexShader));
                console.log('%c=== VERTEX SHADER SOURCE ===', 'color: #ffaa00;');
                console.log(gl.getShaderSource(vertexShader));
            }

            // Check fragment shader
            if (fragmentShader && !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                console.error('%c[Particles] Fragment Shader Error:', 'color: #ff4444; font-weight: bold;');
                console.error(gl.getShaderInfoLog(fragmentShader));
                console.log('%c=== FRAGMENT SHADER SOURCE ===', 'color: #ffaa00;');
                console.log(gl.getShaderSource(fragmentShader));
            }

            // Check program linking
            if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
                console.error('%c[Particles] Program Linking Error:', 'color: #ff4444; font-weight: bold;');
                console.error(gl.getProgramInfoLog(program.program));
            }

            // Log success if no errors
            if (gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) &&
                gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS) &&
                gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
                console.log('%c[Particles] Render shaders compiled successfully!', 'color: #44ff88; font-weight: bold;');
            }
        } else {
            console.warn('[Particles] Shader program not yet compiled - will check on next frame');
            this._debugShaderOnce = true; // Try again next frame
        }
    }

    /**
     * Handle window resize
     * @private
     */
    _handleResize() {
        this.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }

    /**
     * Set mouse position in 3D space
     * @param {THREE.Vector3} position - Mouse position
     */
    setMousePosition(position) {
        this.mousePosition.copy(position);
        this.mouseActive = true;
    }

    /**
     * Clear mouse interaction
     */
    clearMouse() {
        this.mousePosition.set(0, 100, 0); // Move far away
        this.mouseActive = false;
    }

    /**
     * Update particle system
     * @param {number} elapsedTime - Total elapsed time
     * @param {number} deltaTime - Time since last frame
     * @param {THREE.Camera} camera - Current camera for distance calculation
     */
    update(elapsedTime, deltaTime = 0.016, camera = null) {
        // Clamp deltaTime to prevent explosions on tab switch
        deltaTime = Math.min(deltaTime, 0.1);

        // ==========================================
        // Update Compute Shader Uniforms
        // ==========================================

        // Position uniforms
        const positionUniforms = this.positionVariable.material.uniforms;
        positionUniforms.uTime.value = elapsedTime;
        positionUniforms.uDeltaTime.value = deltaTime;

        // Velocity uniforms
        const velocityUniforms = this.velocityVariable.material.uniforms;
        velocityUniforms.uTime.value = elapsedTime;
        velocityUniforms.uDeltaTime.value = deltaTime;
        velocityUniforms.uMousePosition.value = this.mousePosition;

        // ==========================================
        // Run GPU Computation
        // ==========================================

        /**
         * This is where the magic happens!
         * compute() runs the compute shaders for all particles in parallel.
         * It automatically handles the ping-pong texture swapping.
         */
        this.gpuCompute.compute();

        // ==========================================
        // Update Render Material
        // ==========================================

        // Get the computed position texture and pass to render shader
        const positionTexture = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
        this.material.uniforms.texturePosition.value = positionTexture;
        this.material.uniforms.uTime.value = elapsedTime;

        // Update camera distance for size attenuation
        if (camera) {
            this.material.uniforms.uCameraDistance.value = camera.position.length();
        }

        // Debug shader compilation on first frame
        this._debugShaderInfo();
    }

    /**
     * Set particle color
     * @param {number|THREE.Color} color - Start color
     * @param {number|THREE.Color} colorEnd - End color (optional)
     */
    setColor(color, colorEnd = null) {
        this.material.uniforms.uColor.value.set(color);
        if (colorEnd) {
            this.material.uniforms.uColorEnd.value.set(colorEnd);
        }
    }

    /**
     * Set particle size
     * @param {number} size
     */
    setSize(size) {
        this.material.uniforms.uSize.value = size;
    }

    /**
     * Set flow field parameters
     * @param {Object} params
     */
    setFlowField(params) {
        const uniforms = this.velocityVariable.material.uniforms;
        if (params.scale !== undefined) uniforms.uFlowFieldScale.value = params.scale;
        if (params.speed !== undefined) uniforms.uFlowFieldSpeed.value = params.speed;
        if (params.strength !== undefined) uniforms.uFlowFieldStrength.value = params.strength;
    }

    /**
     * Set mouse interaction parameters
     * @param {Object} params
     */
    setMouseParams(params) {
        const uniforms = this.velocityVariable.material.uniforms;
        if (params.radius !== undefined) uniforms.uMouseRadius.value = params.radius;
        if (params.strength !== undefined) uniforms.uMouseStrength.value = params.strength;
    }

    /**
     * Get the mesh
     * @returns {THREE.Points}
     */
    getMesh() {
        return this.mesh;
    }

    /**
     * Get debug info
     * @returns {Object}
     */
    getDebugInfo() {
        return {
            particleCount: this.count,
            textureSize: this.textureSize,
            mousePosition: this.mousePosition.clone(),
            mouseActive: this.mouseActive
        };
    }

    /**
     * Clean up resources
     */
    dispose() {
        window.removeEventListener('resize', this._handleResize);

        // Dispose geometry and material
        this.geometry.dispose();
        this.material.dispose();

        // Dispose GPU computation textures
        if (this.gpuCompute) {
            // GPUComputationRenderer doesn't have a built-in dispose,
            // but we should clean up the render targets
            const posTarget = this.gpuCompute.getCurrentRenderTarget(this.positionVariable);
            const velTarget = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable);
            if (posTarget) posTarget.dispose();
            if (velTarget) velTarget.dispose();
        }

        console.log('%c[Particles] Disposed', 'color: #44ff88;');
    }
}

export { Particles };
export default Particles;
