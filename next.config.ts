import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Native/WASM database drivers must not be bundled by webpack/turbopack.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],

  /*
   * Files read from disk at runtime rather than imported.
   *
   * `lib/db/migrate.ts` discovers migrations with `readdir(cwd/supabase/
   * migrations)`, and PGlite loads its PostgreSQL image from `.wasm`/`.data`
   * files beside its entry point. Neither is a static import, so the build's
   * dependency tracing cannot see them and would omit them from the serverless
   * bundle — leaving the embedded driver to fail on a missing file the moment
   * it got past creating its data directory.
   */
  outputFileTracingIncludes: {
    '/**/*': ['./supabase/migrations/**/*.sql', './node_modules/@electric-sql/pglite/dist/**'],
  },

  // Uploaded images are resized at upload time and served by /media/[id]/[size]
  // with access checks, so the image optimizer is not used for user content and
  // no remote hosts are allowed.
  images: { remotePatterns: [] },

  /*
   * Shopping-era URLs (retired in v1, docs/product-spec.md D12). Old links and
   * bookmarks land somewhere useful instead of a 404.
   */
  async redirects() {
    return [
      { source: '/search', destination: '/home', permanent: true },
      { source: '/saved', destination: '/wardrobe', permanent: true },
      { source: '/preferences', destination: '/settings', permanent: true },
      { source: '/product/:id*', destination: '/home', permanent: true },
      { source: '/go/:id*', destination: '/', permanent: true },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
