import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Canonical host: send www.corta.tech to the apex (one host = one cookie jar for sessions/OAuth).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.corta.tech" }],
        destination: "https://corta.tech/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
