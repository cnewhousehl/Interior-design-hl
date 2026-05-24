import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Konva's node entry tries to require `canvas`; we never run Konva on the server,
    // so stub it out to keep webpack happy.
    config.externals = config.externals || [];
    if (isServer) {
      (config.externals as unknown[]).push({ canvas: "commonjs canvas" });
    }
    return config;
  },
};

export default nextConfig;
