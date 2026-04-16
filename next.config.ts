import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    staleTimes: {
      // Dashboard data updates once per day — long client cache is safe.
      // router.refresh() invalidates the cache immediately after imports.
      dynamic: 3600, // 1 hour
      static: 7200, // 2 hours
    },
  },
};

export default nextConfig;
