import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Cloud / remote browsers often hit the app via 127.0.0.1 while assets use localhost (or vice versa).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
