/**
 * Typed errors for the Claude Connector (claude-connector-analysis.md). Kept beside the connector
 * libs like `lib/ai/errors.js`; all extend `AppError`, so `withRoute` maps them by their own
 * `status`/`code` with no per-route mapping.
 *
 *   ConnectorUnauthorizedError → 401 (missing/unknown/revoked connector Bearer token)
 *   ConnectorOfflineError      → 409 (the requester's connector hasn't polled recently)
 *   AnalysisDisabledError      → 403 (an admin has Claude analysis switched off)
 *   AnalysisInProgressError    → 409 (a job for this ticket is already queued or running)
 */
import { AppError, ERROR_CODES } from "@/lib/errors";

export class ConnectorUnauthorizedError extends AppError {
  constructor(message = "Connector token is missing, invalid or revoked — pair it again from Settings") {
    super(message, { code: ERROR_CODES.CONNECTOR_UNAUTHORIZED, status: 401 });
    this.name = "ConnectorUnauthorizedError";
  }
}

export class ConnectorOfflineError extends AppError {
  constructor(message = "Your StoryBoard Connector is offline — start it, then try again") {
    super(message, { code: ERROR_CODES.CONNECTOR_OFFLINE, status: 409 });
    this.name = "ConnectorOfflineError";
  }
}

export class AnalysisDisabledError extends AppError {
  constructor(message = "Claude analysis is turned off by an admin") {
    super(message, { code: ERROR_CODES.ANALYSIS_DISABLED, status: 403 });
    this.name = "AnalysisDisabledError";
  }
}

export class AnalysisInProgressError extends AppError {
  constructor(message = "An analysis of this ticket is already running", details = null) {
    super(message, { code: ERROR_CODES.ANALYSIS_IN_PROGRESS, status: 409, details });
    this.name = "AnalysisInProgressError";
  }
}
