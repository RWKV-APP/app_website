/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';
const devBackendOrigin =
  process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  // Only use static export in production
  ...(isDev ? {} : { output: 'export' }),
  ...(isDev ? {} : { distDir: 'out' }),
  images: {
    unoptimized: true,
  },
  // Add rewrites for development to proxy all API requests to backend
  ...(isDev
    ? {
        async rewrites() {
          return [
            // Proxy API requests to backend, but exclude Next.js internal paths
            {
              source: '/distributions/:path*',
              destination: `${devBackendOrigin}/distributions/:path*`,
            },
            {
              source: '/location',
              destination: `${devBackendOrigin}/location`,
            },
            {
              source: '/get-demo-config',
              destination: `${devBackendOrigin}/get-demo-config`,
            },
            {
              source: '/suggestions.json',
              destination: `${devBackendOrigin}/suggestions.json`,
            },
            {
              source: '/admin-api/:path*',
              destination: `${devBackendOrigin}/admin-api/:path*`,
            },
          ];
        },
      }
    : {}),
};

module.exports = nextConfig;
