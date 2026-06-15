// Prisma 7 config (JS-only — no prisma.config.ts in this JS app).
//
// Why this file exists: Prisma 7 removed `url` from the schema `datasource` block, so the
// connection string for Prisma Migrate / CLI lives here instead (datasource.url). The runtime
// PrismaClient connects separately through the @prisma/adapter-pg driver adapter (src/lib/db.js).
//
// Prisma 7 .env gotcha: once a prisma.config.* file exists, Prisma stops auto-loading `.env`,
// so we load it explicitly here. Without this, CLI commands fail with "missing DATABASE_URL".
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Pooled connection string for the app; for Neon you may add a separate direct URL for
    // migrations (see .env.example). Migrate reads this; the runtime client uses the adapter.
    url: process.env.DATABASE_URL,
  },
});
