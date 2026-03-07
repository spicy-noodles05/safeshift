/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["@supabase/ssr", "@supabase/supabase-js"],
  },
};

export default nextConfig;
