import { Inject, Injectable, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { agendaTasks, companies, cycleActivities, cycles } from '../../platform/db/schema';
import { resolveWaChannel } from '../../platform/notify/channel';
import { sendWaRaw } from '../../platform/notify/wa';
import { msg } from '../../shared/errors';
import type { CreateAgendaDto, UpdateAgendaDto } from './dto/agenda.dto';

/** Tanggal lokal YYYY-MM-DD (bukan UTC — petani WIB/WITA/WIT). */
const todayStr = () => new Date().toLocaleDateString('sv-SE');

const REMINDER_SWEEP_MS = 60 * 60_000; // cek tiap jam
const REMINDER_HOURS = { from: 5, to: 20 }; // kirim hanya jam 05.00–20.00

@Injectable()
export class AgendaService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly uow: UnitOfWork,
    private readonly config: ConfigService,
  ) {}

  // ---- CRUD ----
  list() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ t: agendaTasks, cycleCode: cycles.code, cycleName: cycles.name })
        .from(agendaTasks)
        .leftJoin(cycles, eq(agendaTasks.cycleId, cycles.id))
        .where(isNull(agendaTasks.doneAt))
        .orderBy(asc(agendaTasks.dueDate));
      return rows.map((r) => ({ ...r.t, cycleCode: r.cycleCode, cycleName: r.cycleName }));
    });
  }

  create(dto: CreateAgendaDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [row] = await tx.insert(agendaTasks).values({ companyId, ...dto }).returning();
      return row;
    });
  }

  update(id: string, dto: UpdateAgendaDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(agendaTasks)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(agendaTasks.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('agenda.notFound'));
      return row;
    });
  }

  remove(id: string) {
    return this.uow.run(async (tx) => {
      const [row] = await tx.delete(agendaTasks).where(eq(agendaTasks.id, id)).returning();
      if (!row) throw new NotFoundException(msg('agenda.notFound'));
      return { ok: true };
    });
  }

  /**
   * Selesaikan agenda:
   *  - cycleId terisi → kegiatan otomatis tercatat di siklus (linimasa & traceability).
   *  - berulang → due_date maju repeatDays hari dari HARI INI (baris dipakai terus);
   *  - sekali → done_at terisi.
   */
  done(id: string) {
    const ctx = getContext();
    return this.uow.run(async (tx) => {
      const [task] = await tx.select().from(agendaTasks).where(eq(agendaTasks.id, id));
      if (!task) throw new NotFoundException(msg('agenda.notFound'));
      if (task.doneAt) return { ...task, activityLogged: false };

      let activityLogged = false;
      if (task.cycleId) {
        const [cycle] = await tx.select().from(cycles).where(eq(cycles.id, task.cycleId));
        if (cycle) {
          await tx.insert(cycleActivities).values({
            companyId: ctx.companyId,
            cycleId: task.cycleId,
            activityDate: todayStr(),
            activityType: task.activityType,
            description: task.title,
            cost: '0',
          });
          activityLogged = true;
        }
      }

      let next;
      if (task.repeatDays) {
        const d = new Date();
        d.setDate(d.getDate() + task.repeatDays);
        [next] = await tx
          .update(agendaTasks)
          .set({ dueDate: d.toLocaleDateString('sv-SE'), lastReminderAt: null, updatedAt: new Date() })
          .where(eq(agendaTasks.id, id))
          .returning();
      } else {
        [next] = await tx
          .update(agendaTasks)
          .set({ doneAt: new Date(), updatedAt: new Date() })
          .where(eq(agendaTasks.id, id))
          .returning();
      }
      return { ...next, activityLogged };
    });
  }

  // ---- Pengingat WA harian (scheduler in-process) ----
  onModuleInit() {
    // Sapu pertama tak lama setelah start (menangkap agenda hari ini), lalu tiap jam.
    setTimeout(() => void this.sweep().catch(() => {}), 20_000);
    this.timer = setInterval(() => void this.sweep().catch(() => {}), REMINDER_SWEEP_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Kirim maks. 1 pengingat/hari per usaha berisi agenda jatuh tempo (dan terlambat). */
  async sweep() {
    const hour = new Date().getHours();
    if (hour < REMINDER_HOURS.from || hour >= REMINDER_HOURS.to) return;

    const today = todayStr();
    const startOfDay = new Date(`${today}T00:00:00`);
    const all = await this.db.select().from(companies).where(eq(companies.isActive, true));

    for (const company of all) {
      try {
        await this.uow.run(
          async (tx) => {
            const due = await tx
              .select()
              .from(agendaTasks)
              .where(
                and(
                  isNull(agendaTasks.doneAt),
                  lte(agendaTasks.dueDate, today),
                  or(isNull(agendaTasks.lastReminderAt), lt(agendaTasks.lastReminderAt, startOfDay)),
                ),
              )
              .orderBy(asc(agendaTasks.dueDate));
            if (!due.length || !company.phone) return;

            const ch = await resolveWaChannel(tx, this.config, company.id, 'agenda_reminder');
            if (!ch) return;

            const lines = due.slice(0, 6).map((d) => {
              const late = d.dueDate < today ? ' (terlambat)' : '';
              return `• ${d.title}${late}`;
            });
            const more = due.length > 6 ? `\n…dan ${due.length - 6} agenda lain.` : '';
            const text = `🔔 Agenda WUTUH hari ini (${due.length}):\n${lines.join('\n')}${more}\nBuka menu Kalender Musim untuk menandai selesai. 🌱`;

            const result = await sendWaRaw(ch.url, ch.token, company.phone, text);
            if (result.ok) {
              const now = new Date();
              for (const d of due) {
                await tx.update(agendaTasks).set({ lastReminderAt: now, updatedAt: now }).where(eq(agendaTasks.id, d.id));
              }
            }
          },
          { companyId: company.id },
        );
      } catch {
        // Satu usaha gagal (gateway mati, dsb.) — jangan hentikan usaha lain.
      }
    }
  }
}
