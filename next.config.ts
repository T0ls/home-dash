import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev: the page may be opened as localhost or 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // next/image is unused. The "*" key matches the next-server trace, which is
  // where the image optimizer pulls in sharp and its libvips binaries.
  outputFileTracingExcludes: {
    "*": ["**/node_modules/sharp/**/*", "**/node_modules/@img/**/*"],
  },
  experimental: {
    // 8 MB image plus multipart overhead. The action still rejects files over 8 MB.
    serverActions: { bodySizeLimit: "9mb" },
  },
};

export default nextConfig;
