import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Force Turbopack to use the admin folder as root, not the monorepo parent.
    // Without this, it detects both package-lock.json files and picks the wrong one,
    // causing 'tailwindcss' to fail to resolve.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
