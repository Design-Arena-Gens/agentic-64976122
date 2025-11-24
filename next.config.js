/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'three'
    ]
  }
};

module.exports = nextConfig;

