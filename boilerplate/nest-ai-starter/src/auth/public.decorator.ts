import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'auth:isPublic';

/**
 * Every route is authenticated by default (BasicAuthGuard is global). Mark the
 * exceptions explicitly, so a forgotten decorator fails CLOSED (401), never open.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
