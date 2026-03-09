import { AccessDeniedError } from "@/lib/utils/repoAccess";

/**
 * Converts a caught error into the appropriate JSON API Response.
 *
 * - AccessDeniedError → 403
 * - Everything else   → 500
 */
export function handleRouteError(error: unknown): Response {
  console.error(error);
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  const status = error instanceof AccessDeniedError ? 403 : 500;
  return Response.json({ status: "error", message }, { status });
}
