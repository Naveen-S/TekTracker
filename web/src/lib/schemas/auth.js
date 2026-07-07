import { z } from "zod";

/**
 * Login request body — the boundary contract for `POST /api/auth/login`. Mirrors the prototype's
 * "email and token are required" check (both non-empty, trimmed); real credential validation is
 * delegated to Jira `/myself`.
 */
export const loginInputSchema = z.object({
  email: z.string().trim().min(1, "email is required"),
  token: z.string().trim().min(1, "token is required"),
});

/** @typedef {z.infer<typeof loginInputSchema>} LoginInput */
