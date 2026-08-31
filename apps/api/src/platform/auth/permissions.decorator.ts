import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from './jwt-payload';
import { msg } from '../../shared/errors';

export const PERMISSIONS_KEY = 'permissions';
/** Batasi endpoint ke permission tertentu, mis. @RequirePermissions('farm.write'). */
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    // Guard berjalan sebelum interceptor → baca dari req.user (di-set JwtAuthGuard).
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const granted = req.user?.permissions ?? [];

    // '*' = admin usaha (semua permission). 'modul.*' = semua aksi pada modul itu.
    const ok = required.every(
      (p) => granted.includes('*') || granted.includes(p) || granted.includes(`${p.split('.')[0]}.*`),
    );
    if (!ok) throw new ForbiddenException(msg('auth.needPermission', { perms: required.join(', ') }));
    return true;
  }
}
