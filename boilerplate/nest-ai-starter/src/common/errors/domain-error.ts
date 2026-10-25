/**
 * Errors thrown by services. They carry no HTTP knowledge: the
 * DomainExceptionFilter maps them to status codes in one place, so services
 * stay testable without Nest and every endpoint fails the same way.
 *
 * Never return `{ success: false }` with HTTP 200. Throw one of these instead.
 */
export abstract class DomainError extends Error {
  abstract readonly code: 'NOT_FOUND' | 'CONFLICT' | 'RULE_VIOLATION';

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND' as const;

  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`, { entity, id });
  }
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT' as const;
}

/** A business rule refused the request (the input was well-formed). */
export class RuleViolationError extends DomainError {
  readonly code = 'RULE_VIOLATION' as const;
}
