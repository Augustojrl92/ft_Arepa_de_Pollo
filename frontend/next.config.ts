import type { NextConfig } from "next";

const apiHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").hostname;
  } catch {
    return "localhost";
  }
})();

const nextConfig: NextConfig = {
  // allowedDevOrigins: Array.from(new Set(["localhost", "127.0.0.1", apiHostname])),
  // Next rejects dev requests whose Origin is not the one it is served from,
  // which blocks opening the app from another machine on the LAN. These
  // patterns cover the private ranges used for local testing.
  //
  // Development only: `next build` / `next start` ignore this setting.
  allowedDevOrigins: [
    "10.*.*.*",
    "192.168.*.*",
    "172.16.*.*",
    "*.local",
  ],
};

export default nextConfig;
