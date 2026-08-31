import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../db/db.types';
import { UnitOfWork } from '../db/unit-of-work';
import { companies, roles, users } from '../db/schema';
import { provisionCompanyDefaults } from '../provisioning/provision';
import { msg } from '../../shared/errors';
import type { JwtPayload } from './jwt-payload';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly uow: UnitOfWork,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Login cukup email + password (tanpa kode usaha — sederhana untuk petani).
   * Tabel users memakai policy RLS longgar saat tanpa konteks (lihat rls.sql),
   * sehingga pencarian email global di sini berhasil.
   */
  async login(dto: LoginDto) {
    const [user] = await this.db.select().from(users).where(eq(users.email, dto.email.toLowerCase()));
    if (!user || !user.isActive) throw new UnauthorizedException(msg('auth.badCredentials'));

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException(msg('auth.badCredentials'));

    const [company] = await this.db.select().from(companies).where(eq(companies.id, user.companyId));
    if (!company || !company.isActive) throw new UnauthorizedException(msg('auth.businessInactive'));

    let permissions: string[] = [];
    let roleCode: string | null = null;
    if (user.roleId) {
      const [r] = await this.db.select().from(roles).where(eq(roles.id, user.roleId));
      permissions = r?.permissions ?? [];
      roleCode = r?.code ?? null;
    }

    return this.issueToken(user, company, permissions, roleCode);
  }

  /** Registrasi mandiri: buat usaha + admin + provisioning default, langsung login. */
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const [existing] = await this.db.select().from(users).where(eq(users.email, email));
    if (existing) throw new ConflictException(msg('auth.emailTaken'));

    // Kode usaha unik dari nama (mis. "Tani Makmur" → TANIMAKMUR, TANIMAKMUR2, ...)
    const base = dto.businessName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || 'USAHA';
    let code = base;
    for (let i = 2; ; i++) {
      const [dup] = await this.db.select().from(companies).where(eq(companies.code, code));
      if (!dup) break;
      code = `${base}${i}`;
    }

    // companies tidak ber-RLS → insert langsung; sisanya dalam UoW ber-konteks.
    const [company] = await this.db
      .insert(companies)
      .values({
        code,
        name: dto.businessName,
        businessType: dto.businessType,
        province: dto.province,
        regency: dto.regency,
        phone: dto.phone,
      })
      .returning();

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { user, permissions, roleCode } = await this.uow.run(
      async (tx) => {
        const { adminRoleId } = await provisionCompanyDefaults(tx, company.id);
        const [u] = await tx
          .insert(users)
          .values({
            companyId: company.id,
            email,
            fullName: dto.fullName,
            phone: dto.phone,
            passwordHash,
            roleId: adminRoleId,
          })
          .returning();
        return { user: u, permissions: ['*'], roleCode: 'ADMIN' };
      },
      { companyId: company.id },
    );

    return this.issueToken(user, company, permissions, roleCode);
  }

  private async issueToken(
    user: typeof users.$inferSelect,
    company: typeof companies.$inferSelect,
    permissions: string[],
    roleCode: string | null,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      companyId: company.id,
      roleId: user.roleId ?? null,
      email: user.email,
      permissions,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: Number(this.config.get('JWT_ACCESS_TTL', 28800)),
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyId: company.id,
        companyCode: company.code,
        companyName: company.name,
        roleCode,
        permissions,
      },
    };
  }
}
