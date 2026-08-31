import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { runWithContext, type RequestContext } from '../tenancy/company-context';
import type { JwtPayload } from './jwt-payload';

/**
 * Setelah JwtAuthGuard menempel `req.user`, jalankan sisa request di dalam
 * AsyncLocalStorage berisi konteks company. Endpoint publik (tanpa user) lewat.
 */
@Injectable()
export class CompanyContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (!user) return next.handle();

    const ctx: RequestContext = {
      companyId: user.companyId,
      userId: user.sub,
      roleId: user.roleId,
      permissions: user.permissions ?? [],
    };

    return new Observable((subscriber) => {
      runWithContext(ctx, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
