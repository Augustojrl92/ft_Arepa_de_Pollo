import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.*.*.*",
    "192.168.*.*",
    "172.16.*.*",
    "172.18.*.*",
    "*.local",
  ],
};

export default nextConfig;
