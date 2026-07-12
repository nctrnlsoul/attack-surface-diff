/** @type {import('next').NextConfig} */
const nextConfig = {
  // The engine (src/parser, src/graph) uses ESM ".js" import specifiers that
  // point at ".ts" sources. Let the bundler resolve them without touching src.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
