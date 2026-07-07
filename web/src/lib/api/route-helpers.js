/**
 * Shared Route Handler plumbing for the domain APIs (domain-apis.md decision 2).
 *
 * Contract (matches the auth routes, §8 "keep contracts"): success returns the resource JSON
 * directly; failures return `{ error }` with the mapped HTTP status. The `{ success, data, error }`
 * envelope stays the Server-Action shape (coding-standards) — not used by Route Handlers.
 *
 * Typical handler shape:
 *   try { guard → parse → prisma → Response.json(result) } catch (e) { return handleRouteError(e) }
 */
import { UnauthorizedError } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/rbac";
import { validate } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

/** Thrown for request bodies/params that fail validation. Maps to HTTP 400. */
export class ValidationError extends Error {
  constructor(message = "Invalid request") {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Read the JSON body and validate it against a zod schema; throws {@link ValidationError} (→ 400)
 * on malformed JSON or schema failure.
 *
 * @template T
 * @param {Request} request
 * @param {import("zod").ZodType<T>} schema
 * @returns {Promise<T>}
 */
export async function parseJsonBody(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = validate(schema, body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error);
  }
  return parsed.data;
}

/**
 * Map a thrown error to the `{ error }` + HTTP-status response (domain-apis.md decision 2):
 * zod/ValidationError → 400 · UnauthorizedError → 401 · ForbiddenError → 403 · NotFoundError and
 * Prisma P2025 → 404 · Prisma P2002 (unique violation) → 409 · anything else → 500 (logged).
 *
 * @param {unknown} error
 * @returns {Response}
 */
export function handleRouteError(error) {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "unique field";
      return Response.json(
        { error: `A record with the same ${fields} already exists` },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
  }
  console.error("Unhandled route error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
