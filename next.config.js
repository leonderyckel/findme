/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['example.com'],
  },
  webpack: (config, { isServer }) => {
    // Exclude undici from client-side bundle to avoid parsing errors
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        undici: false,
        'node:stream': false,
        'node:buffer': false,
        'node:util': false,
        'node:url': false,
        'node:crypto': false,
      }
    }
    
    // Exclude problematic modules
    config.externals = config.externals || []
    if (isServer) {
      config.externals.push('undici')
    }
    
    return config
  },
}

module.exports = nextConfig 