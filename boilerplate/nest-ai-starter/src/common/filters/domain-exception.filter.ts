import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../errors/domain-error.js';

const STATUS: Record<DomainError['code'], HttpStatus> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  RULE_VIOLATION: HttpStatus.UNPROCESSABLE_ENTITY,
};

/**
 * Maps DomainError to HTTP using the same body shape Nest uses for its own
 * HttpExceptions ({ statusCode, message, error }), plus `code` and `details`,
 * so clients parse one error format. Other exceptions fall through to Nest.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const status = STATUS[exception.code];
    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      code: exception.code,
      message: exception.message,
      details: exception.details,
    });
  }
}
