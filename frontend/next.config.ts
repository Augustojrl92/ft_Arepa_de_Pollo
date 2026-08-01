import type { NextConfig } from "next";

const apiHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").hostname;
  } catch {
    return "localhost";
  }
})();

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(new Set(["localhost", "127.0.0.1", apiHostname])),
};

export default nextConfig;
