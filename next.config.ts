import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  bundlePagesRouterDependencies: false,
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
