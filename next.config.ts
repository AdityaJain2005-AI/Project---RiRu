import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@mediapipe/tasks-vision"],
  webpack: (config) => {
    config.module.exprContextCritical = false;
    config.module.unknownContextCritical = false;
    return config;
  },
};

export default nextConfig;
