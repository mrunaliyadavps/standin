import type { NextConfig } from "next";

// The viewer is a fully static site, so it can be hosted for free on GitHub Pages.
// NEXT_PUBLIC_BASE_PATH is set by the deploy workflow to "/<repo-name>".
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
