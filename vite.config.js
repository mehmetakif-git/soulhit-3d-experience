/**
 * Vite Configuration
 * Production-optimized build settings
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
    const isDev = mode === 'development';
    const isProd = mode === 'production';

    return {
        // Base public path
        base: './',

        // Development server
        server: {
            port: 3000,
            open: true,
            cors: true,
            host: true // Allow network access
        },

        // Build options
        build: {
            // Output directory
            outDir: 'dist',

            // Asset handling
            assetsDir: 'assets',
            assetsInlineLimit: 4096, // 4kb

            // Minification
            minify: isProd ? 'terser' : false,
            terserOptions: isProd ? {
                compress: {
                    drop_console: true,
                    drop_debugger: true,
                    pure_funcs: ['console.log', 'console.info']
                },
                mangle: true,
                format: {
                    comments: false
                }
            } : undefined,

            // Source maps
            sourcemap: isDev,

            // Chunk splitting
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'index.html')
                },
                output: {
                    // Manual chunk splitting for better caching
                    manualChunks: {
                        // Three.js core
                        three: ['three'],
                        // GSAP animation
                        gsap: ['gsap'],
                        // Three.js addons
                        'three-addons': [
                            'three/addons/postprocessing/EffectComposer.js',
                            'three/addons/postprocessing/RenderPass.js',
                            'three/addons/postprocessing/UnrealBloomPass.js',
                            'three/addons/postprocessing/ShaderPass.js',
                            'three/addons/postprocessing/OutputPass.js',
                            'three/addons/shaders/FXAAShader.js',
                            'three/addons/loaders/GLTFLoader.js',
                            'three/addons/loaders/DRACOLoader.js',
                            'three/addons/misc/GPUComputationRenderer.js'
                        ]
                    },
                    // Asset naming
                    entryFileNames: isProd ? 'js/[name].[hash].js' : 'js/[name].js',
                    chunkFileNames: isProd ? 'js/[name].[hash].js' : 'js/[name].js',
                    assetFileNames: (assetInfo) => {
                        const ext = assetInfo.name.split('.').pop();
                        if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
                            return isProd ? 'images/[name].[hash][extname]' : 'images/[name][extname]';
                        }
                        if (/woff2?|eot|ttf|otf/i.test(ext)) {
                            return isProd ? 'fonts/[name].[hash][extname]' : 'fonts/[name][extname]';
                        }
                        if (/glsl|vert|frag/i.test(ext)) {
                            return isProd ? 'shaders/[name].[hash][extname]' : 'shaders/[name][extname]';
                        }
                        if (/glb|gltf/i.test(ext)) {
                            return isProd ? 'models/[name].[hash][extname]' : 'models/[name][extname]';
                        }
                        return isProd ? 'assets/[name].[hash][extname]' : 'assets/[name][extname]';
                    }
                }
            },

            // Chunk size warnings
            chunkSizeWarningLimit: 1000, // 1MB

            // CSS code splitting
            cssCodeSplit: true,

            // Report compressed size
            reportCompressedSize: true
        },

        // Optimizations
        optimizeDeps: {
            include: ['three', 'gsap'],
            exclude: []
        },

        // Resolve aliases
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
                '@core': resolve(__dirname, 'src/core'),
                '@world': resolve(__dirname, 'src/world'),
                '@shaders': resolve(__dirname, 'src/shaders'),
                '@utils': resolve(__dirname, 'src/utils'),
                '@postprocessing': resolve(__dirname, 'src/postprocessing')
            }
        },

        // Define globals
        define: {
            __DEV__: JSON.stringify(isDev),
            __PROD__: JSON.stringify(isProd),
            __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
        },

        // CSS options
        css: {
            devSourcemap: isDev
        },

        // Preview server (for testing prod build)
        preview: {
            port: 4173,
            open: true
        },

        // Plugins
        plugins: [
            // GLSL shader support is handled by ?raw imports
        ],

        // Enable experimental features
        esbuild: {
            // Keep function names in dev for debugging
            keepNames: isDev,
            // Target modern browsers
            target: 'es2020'
        }
    };
});
