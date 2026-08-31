import { date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { cycles } from './farm';

/**
 * Kalender musim — agenda kerja petani (sekali atau berulang).
 * Berulang: selesai → due_date maju repeat_days hari (baris yang sama dipakai terus).
 * Sekali: selesai → done_at terisi (hilang dari daftar tertunda).
 * Pengingat WA harian dikirim scheduler (event 'agenda_reminder').
 */
export const agendaTasks = pgTable('agenda_tasks', {
  id: idPk(),
  companyId: companyId(),
  title: text('title').notNull(),
  /** Jenis kegiatan (enum activity yang sama dengan cycle_activities). */
  activityType: text('activity_type').notNull().default('lainnya'),
  /** Bila diisi: menyelesaikan agenda otomatis mencatat kegiatan di siklus ini. */
  cycleId: uuid('cycle_id').references(() => cycles.id),
  dueDate: date('due_date').notNull(),
  /** null = sekali; N = ulangi tiap N hari setelah diselesaikan. */
  repeatDays: integer('repeat_days'),
  note: text('note'),
  doneAt: timestamp('done_at', { withTimezone: true }),
  /** Kapan terakhir dikirimi pengingat WA (dedup: maks. 1x per hari). */
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  ...timestamps,
});
