/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root: the repo root (Vite app) has its own lockfile,
  // which Next.js would otherwise infer as the root while both apps coexist.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
