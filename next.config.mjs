/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root: the retired legacy app (legacy/) still carries its own
  // lockfile, which Next.js could otherwise mis-infer as a workspace root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
