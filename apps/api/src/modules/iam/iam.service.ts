import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { roles, users } from '../../platform/db/schema';
import { msg } from '../../shared/errors';
import type { CreateUserDto, UpdateUserDto } from './dto/iam.dto';

@Injectable()
export class IamService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly uow: UnitOfWork,
  ) {}

  listRoles() {
    return this.uow.run((tx) => tx.select().from(roles).orderBy(roles.code));
  }

  listUsers() {
    return this.uow.run(async (tx) => {
      const companyId = getContext().companyId;
      const rows = await tx
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          phone: users.phone,
          roleId: users.roleId,
          isActive: users.isActive,
          createdAt: users.createdAt,
          roleCode: roles.code,
          roleName: roles.name,
        })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.companyId, companyId))
        .orderBy(users.fullName);
      return rows;
    });
  }

  async createUser(dto: CreateUserDto) {
    const companyId = getContext().companyId;
    const email = dto.email.toLowerCase();
    // Email unik global (policy users longgar tanpa konteks → cek via koneksi biasa).
    const [dup] = await this.db.select().from(users).where(eq(users.email, email));
    if (dup) throw new ConflictException(msg('auth.emailTaken'));

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          companyId,
          email,
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash,
          roleId: dto.roleId,
        })
        .returning();
      const { passwordHash: _ph, ...safe } = row;
      return safe;
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const patch: Record<string, unknown> = {
      fullName: dto.fullName,
      phone: dto.phone,
      roleId: dto.roleId,
      isActive: dto.isActive,
      updatedAt: new Date(),
    };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    if (dto.password) patch.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.uow.run(async (tx) => {
      const companyId = getContext().companyId;
      const [existing] = await tx.select().from(users).where(eq(users.id, id));
      if (!existing || existing.companyId !== companyId) throw new NotFoundException(msg('user.notFound'));
      const [row] = await tx.update(users).set(patch).where(eq(users.id, id)).returning();
      const { passwordHash: _ph, ...safe } = row;
      return safe;
    });
  }
}
