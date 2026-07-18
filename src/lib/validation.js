/**
 * Boundary validation helpers built on zod.
 *
 * Convention (context/coding-standards.md → Data Fetching / Error Handling):
 * every API route and Server Action validates its input with a zod schema at the
 * boundary and returns the project-wide `{ success, data, error }` result shape.
 * Domain shapes also get a JSDoc `@typedef` (see src/lib/schemas/*).
 */

/**
 * @template T
 * @typedef {{ success: true, data: T, error: null }
 *   | { success: false, data: null, error: string }} ValidationResult
 */

/**
 * Validate `input` against a zod `schema` without throwing.
 *
 * @template T
 * @param {import("zod").ZodType<T>} schema
 * @param {unknown} input
 * @returns {ValidationResult<T>} `{ success, data, error }`; `error` is a single
 *   human-readable message (safe to surface via toast).
 */
export function validate(schema, input) {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data, error: null };
  }

  const error = result.error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

  return { success: false, data: null, error };
}
