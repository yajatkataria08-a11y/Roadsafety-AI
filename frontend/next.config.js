/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },

  // ── WebAssembly support (needed for ONNX Runtime Web / Transformers.js) ────
  webpack(config, { isServer }) {
    // Enable async WebAssembly (required for onnxruntime-web)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Resolve .wasm files correctly
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Don't bundle heavy ML libs on the server — they run in the browser only
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        '@xenova/transformers',
        'onnxruntime-web',
      ];
    }

    return config;
  },

  // ── Security & PWA headers ────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Service worker must be served from the root scope
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type',  value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type',  value: 'application/manifest+json' },
        ],
      },
      {
        // violations.json — allow SW to cache; compress with gzip in production
        source: '/violations.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
          { key: 'Content-Encoding', value: 'gzip' },  // serve pre-compressed in prod
        ],
      },
      {
        // WASM files need COEP/COOP for SharedArrayBuffer (used by ONNX threads)
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
        ],
      },
    ];
  },

  // ── Compression: gzip violations.json at build time ──────────────────────
  // Run: node scripts/compress-violations.js before `next build`
};

module.exports = nextConfig;
