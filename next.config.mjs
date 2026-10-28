/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ['pg', '@electric-sql/pglite'] },
};
export default nextConfig;
