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
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });
    
    config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";
    
    return config;
  },
};

export default nextConfig;
