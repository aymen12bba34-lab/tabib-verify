/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: "standalone" is for Docker only — remove it for Vercel deployment
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
};

export default nextConfig;
