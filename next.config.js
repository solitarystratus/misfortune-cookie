/** @type {import('next').NextConfig} */

/**
 * next.config.js — Required for @mlc-ai/web-llm
 *
 * WebLLM ships WebAssembly (WASM) modules and Web Worker scripts.
 * Without asyncWebAssembly: true, Next.js will fail to compile the package.
 * The crossOriginPolicy header is needed for SharedArrayBuffer, which some
 * WebGPU features may require for inter-thread communication.
 */
const nextConfig = {
  // Prevent web-llm from being bundled server-side — it uses browser-only WebGPU APIs
  // Without this, `next build` crashes trying to import WebGPU code on the server
  serverExternalPackages: ["@mlc-ai/web-llm"],

  webpack: (config, { isServer }) => {
    // Only enable WASM on the client bundle (web-llm is browser-only)
    if (!isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      };
    }

    // Suppress the "Critical dependency: the request of a dependency is
    // an expression" warning that web-llm triggers internally.
    config.module.exprContextCritical = false;

    return config;
  },

  // Required for SharedArrayBuffer (used by some WebGPU/WASM contexts)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
