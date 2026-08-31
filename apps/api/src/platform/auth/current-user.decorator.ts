import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from './jwt-payload';

/** Ambil payload JWT user saat ini dari request. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtPayload => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
  return req.user as JwtPayload;
});
