import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname }]
      : [],
  },
};

export default nextConfig;
