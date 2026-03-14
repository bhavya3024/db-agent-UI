import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  serverExternalPackages: ["@1password/sdk", "@1password/sdk-core"],
  turbopack: {
    resolveAlias: {
      "@1password/sdk": "@1password/sdk",
    },
  },
};

export default nextConfig;
