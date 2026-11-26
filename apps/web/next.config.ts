import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@encore/contracts",
    "@encore/core",
    "@encore/infrastructure",
    "@encore/solana-client"
  ],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"]
    };
    return config;
  }
};

export default nextConfig;
