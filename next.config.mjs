/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['msedge-tts', 'unpdf', 'mammoth', 'jszip', 'youtube-transcript'],
  },
};
export default nextConfig;
