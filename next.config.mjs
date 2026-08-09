/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained production server for the container image: `next build` emits
  // `.next/standalone` with a `server.js` + only the traced node_modules (including the
  // generated Prisma client and @prisma/adapter-pg), so the Dockerfile runner needs no
  // full `node_modules` copy. Build-only; `next dev`/`next start` are unaffected. See Dockerfile.
  output: "standalone",

  // Pin the workspace root: the retired legacy app (legacy/) still carries its own
  // lockfile, which Next.js could otherwise mis-infer as a workspace root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
