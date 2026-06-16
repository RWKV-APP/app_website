const path = require('path');
const os = require('os');

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';
const devBackendOrigin =
  process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const contractsSource = path.resolve(__dirname, '../packages/contracts/src');
const productionPageUrl = 'https://rwkv.halowang.cloud/';
const frontendPort = '3010';

function getLocalNetworkAddress() {
  const virtualInterfacePattern = /^(awdl|bridge|docker|llw|utun|vboxnet|vmnet)/i;
  const addresses = Object.entries(os.networkInterfaces())
    .flatMap(([name, entries]) =>
      (entries || []).map((entry) => ({
        name,
        address: entry.address,
        family: entry.family,
        internal: entry.internal,
      })),
    )
    .filter((entry) => (entry.family === 'IPv4' || entry.family === 4) && !entry.internal);

  const preferred = addresses
    .filter((entry) => !virtualInterfacePattern.test(entry.name))
    .sort((a, b) => {
      const score = (entry) => {
        if (/^(en|eth|wl)/i.test(entry.name)) return 0;
        if (entry.address.startsWith('192.168.')) return 1;
        if (entry.address.startsWith('10.')) return 2;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(entry.address)) return 3;
        return 4;
      };
      return score(a) - score(b);
    });

  return preferred[0]?.address || addresses[0]?.address || 'localhost';
}

const devPageUrl = `http://${getLocalNetworkAddress()}:${frontendPort}/`;
const pageUrl = isDev ? devPageUrl : productionPageUrl;

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_PAGE_URL: pageUrl,
  },
  transpilePackages: ['@app/contracts'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@app/contracts': contractsSource,
    };
    return config;
  },
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
            {
              source: '/public-api/:path*',
              destination: `${devBackendOrigin}/public-api/:path*`,
            },
          ];
        },
      }
    : {}),
};

module.exports = nextConfig;
