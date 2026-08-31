import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { langFromHeader } from '../../shared/lang';
import { translate, VALIDATION_ID, type ValidationItem } from '../../shared/errors';

/**
 * Filter exception global: menerjemahkan body ber-kunci ({ key, params }) dan
 * daftar error validasi ke bahasa request (Accept-Language), lalu membalas
 * { statusCode, message, key, error }. Pesan string biasa diteruskan apa adanya.
 */
@Catch()
export class I18nExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const lang = langFromHeader(req.headers['accept-language'] as string | undefined);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      let message: string | string[];
      let key: string | undefined;

      if (body && typeof body === 'object' && 'key' in body) {
        const b = body as { key: string; params?: Record<string, unknown>; errors?: ValidationItem[] };
        key = b.key;
        if (b.key === 'validation' && Array.isArray(b.errors)) {
          message = b.errors.flatMap((e) =>
            e.constraints.map((c) =>
              lang === 'en' || !VALIDATION_ID[c.key]
                ? c.message
                : VALIDATION_ID[c.key].replace('{property}', e.property),
            ),
          );
        } else {
          message = translate(b.key, b.params, lang);
        }
      } else if (typeof body === 'string') {
        message = body;
      } else {
        message = (body as { message?: string | string[] })?.message ?? exception.message;
      }

      res.status(status).json({ statusCode: status, message, key, error: exception.name });
      return;
    }

    // Error non-HTTP (bug, pg, dsb.) → 500 dengan pesan generik terjemahan; detail ke log.
    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    res.status(500).json({ statusCode: 500, message: translate('internal', undefined, lang), key: 'internal', error: 'InternalServerError' });
  }
}
