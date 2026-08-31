<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';
import WeatherCard from '@/components/WeatherCard.vue';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t, locale } = useI18n();
const { fmtDate, today } = useFmt();

const canWrite = computed(() => auth.can('farm.write'));
const query = useQuery({ queryKey: ['agenda'], queryFn: async () => (await api.get('/agenda')).data });
const cycles = useQuery({ queryKey: ['cycles', 'all'], queryFn: async () => (await api.get('/cycles')).data });

const ACTS = ['pengolahan', 'penyemaian', 'penanaman', 'pemupukan', 'penyiraman', 'penyiangan', 'hama_penyakit', 'pakan', 'vitamin', 'lainnya'];
const actTypes = computed(() => ACTS.map((v) => ({ value: v, label: t(`enum.activity.${v}`) })));
const actLabel = (v: string) => (ACTS.includes(v) ? t(`enum.activity.${v}`) : v);
const REPEATS = [null, 1, 2, 3, 7, 14, 30];
const repeatOptions = computed(() =>
  REPEATS.map((v) => ({ value: v, label: v === null ? t('agenda.repeatOnce') : t('agenda.repeatEvery', { n: v }) })),
);
const repeatLabel = (v: number | null) => (v ? t('agenda.repeatEvery', { n: v }) : t('agenda.repeatOnce'));

// ===== Kalender bulan (Senin sebagai hari pertama) =====
const todayStr = today();
const anchor = ref(new Date(`${todayStr.slice(0, 7)}-01T00:00:00`));
const monthTitle = computed(() =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en' : 'id', { month: 'long', year: 'numeric' }).format(anchor.value),
);
function shiftMonth(delta: number) {
  const d = new Date(anchor.value);
  d.setMonth(d.getMonth() + delta);
  anchor.value = d;
}
function goToday() { anchor.value = new Date(`${todayStr.slice(0, 7)}-01T00:00:00`); }

const weekdayNames = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value === 'en' ? 'en' : 'id', { weekday: 'short' });
  // 2024-01-01 adalah Senin.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
});

const byDate = computed<Record<string, any[]>>(() => {
  const map: Record<string, any[]> = {};
  for (const r of query.data.value ?? []) (map[r.dueDate] ??= []).push(r);
  return map;
});

type Cell = { date: string; day: number; inMonth: boolean; isToday: boolean; tasks: any[] };
const weeks = computed<Cell[][]>(() => {
  const first = new Date(anchor.value);
  const startOffset = (first.getDay() + 6) % 7; // Senin=0
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  const month = first.getMonth();
  const out: Cell[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toLocaleDateString('sv-SE');
      row.push({ date: iso, day: cur.getDate(), inMonth: cur.getMonth() === month, isToday: iso === todayStr, tasks: byDate.value[iso] ?? [] });
      cur.setDate(cur.getDate() + 1);
    }
    out.push(row);
    // Berhenti bila minggu berikutnya sudah sepenuhnya bulan depan.
    if (cur.getMonth() !== month && cur.getDay() === 1 && w >= 3) break;
  }
  return out;
});

// Daftar samping: terlambat + 14 hari ke depan.
const overdue = computed(() => (query.data.value ?? []).filter((r: any) => r.dueDate < todayStr));
const upcoming = computed(() => {
  const lim = new Date();
  lim.setDate(lim.getDate() + 14);
  const limStr = lim.toLocaleDateString('sv-SE');
  return (query.data.value ?? []).filter((r: any) => r.dueDate >= todayStr && r.dueDate <= limStr);
});

// ===== Dialog tambah/ubah =====
const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ title: '', activityType: 'penyiraman', dueDate: todayStr, repeatDays: null as number | null, cycleId: '', note: '' });
const form = ref(blank());
function openCreate(date?: string) {
  editId.value = null;
  form.value = { ...blank(), dueDate: date ?? todayStr };
  show.value = true;
}
function openEdit(r: any) {
  editId.value = r.id;
  form.value = { title: r.title, activityType: r.activityType, dueDate: r.dueDate, repeatDays: r.repeatDays ?? null, cycleId: r.cycleId ?? '', note: r.note ?? '' };
  show.value = true;
}

const save = useMutation({
  mutationFn: async () => {
    const payload = {
      title: form.value.title,
      activityType: form.value.activityType,
      dueDate: form.value.dueDate,
      repeatDays: form.value.repeatDays ?? undefined,
      cycleId: form.value.cycleId || undefined,
      note: form.value.note || undefined,
    };
    if (editId.value) return (await api.patch(`/agenda/${editId.value}`, payload)).data;
    return (await api.post('/agenda', payload)).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['agenda'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

const done = useMutation({
  mutationFn: async (r: any) => (await api.post(`/agenda/${r.id}/done`)).data,
  onSuccess: (d) => {
    const extra = [
      d.activityLogged ? t('agenda.doneActivity') : null,
      d.repeatDays && !d.doneAt ? t('agenda.doneRepeat', { date: fmtDate(d.dueDate) }) : null,
    ].filter(Boolean).join(' · ');
    toast.add({ severity: 'success', summary: t('agenda.doneMsg'), detail: extra || undefined, life: 3000 });
    qc.invalidateQueries({ queryKey: ['agenda'] });
    qc.invalidateQueries({ queryKey: ['cycle-detail'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

const del = useMutation({
  mutationFn: async (r: any) => (await api.delete(`/agenda/${r.id}`)).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.deleted'), life: 2000 });
    qc.invalidateQueries({ queryKey: ['agenda'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>{{ t('agenda.title') }}</h2>
        <p class="sub">{{ t('agenda.sub') }}</p>
      </div>
      <div class="head-actions">
        <Button v-if="canWrite" :label="t('agenda.new')" icon="pi pi-plus" @click="openCreate()" />
      </div>
    </div>

    <WeatherCard compact class="wx-top" />

    <div class="cal-layout">
      <!-- Kalender bulan -->
      <section class="cal-panel">
        <div class="cal-nav">
          <Button icon="pi pi-chevron-left" text rounded size="small" @click="shiftMonth(-1)" />
          <strong class="cal-title">{{ monthTitle }}</strong>
          <Button icon="pi pi-chevron-right" text rounded size="small" @click="shiftMonth(1)" />
          <Button :label="t('agenda.today')" size="small" text @click="goToday" />
        </div>
        <div class="cal-grid">
          <div v-for="w in weekdayNames" :key="w" class="cal-dow">{{ w }}</div>
          <template v-for="(row, ri) in weeks" :key="ri">
            <div
              v-for="cell in row"
              :key="cell.date"
              class="cal-cell"
              :class="{ dim: !cell.inMonth, today: cell.isToday }"
              @click="canWrite && openCreate(cell.date)"
            >
              <span class="cal-day">{{ cell.day }}</span>
              <button
                v-for="task in cell.tasks.slice(0, 3)"
                :key="task.id"
                type="button"
                class="cal-chip"
                :class="{ late: task.dueDate < todayStr }"
                :title="task.title"
                @click.stop="canWrite ? openEdit(task) : undefined"
              >
                {{ task.title }}
              </button>
              <span v-if="cell.tasks.length > 3" class="cal-more">+{{ cell.tasks.length - 3 }}</span>
            </div>
          </template>
        </div>
      </section>

      <!-- Daftar terlambat & mendatang -->
      <section class="list-panel">
        <template v-if="overdue.length">
          <h3 class="lp-h late"><i class="pi pi-exclamation-triangle" /> {{ t('agenda.overdue') }}</h3>
          <div v-for="r in overdue" :key="r.id" class="task-row late">
            <div class="tr-main">
              <strong>{{ r.title }}</strong>
              <small>{{ fmtDate(r.dueDate) }} · {{ actLabel(r.activityType) }}<template v-if="r.cycleCode"> · {{ r.cycleCode }}</template> · {{ repeatLabel(r.repeatDays) }}</small>
            </div>
            <div class="tr-actions" v-if="canWrite">
              <Button icon="pi pi-check" size="small" rounded severity="success" :loading="done.isPending.value" v-tooltip.top="t('agenda.doneBtn')" @click="done.mutate(r)" />
              <Button icon="pi pi-pencil" size="small" rounded text @click="openEdit(r)" />
              <Button icon="pi pi-trash" size="small" rounded text severity="danger" @click="del.mutate(r)" />
            </div>
          </div>
        </template>

        <h3 class="lp-h"><i class="pi pi-calendar" /> {{ t('agenda.upcoming') }}</h3>
        <div v-if="!upcoming.length" class="empty-note">{{ t('agenda.emptyUpcoming') }}</div>
        <div v-for="r in upcoming" :key="r.id" class="task-row" :class="{ today: r.dueDate === todayStr }">
          <div class="tr-main">
            <strong>{{ r.title }}</strong>
            <small>
              <Tag v-if="r.dueDate === todayStr" :value="t('agenda.today')" severity="info" class="mini-tag" />
              {{ fmtDate(r.dueDate) }} · {{ actLabel(r.activityType) }}<template v-if="r.cycleCode"> · {{ r.cycleCode }}</template> · {{ repeatLabel(r.repeatDays) }}
            </small>
          </div>
          <div class="tr-actions" v-if="canWrite">
            <Button icon="pi pi-check" size="small" rounded severity="success" :loading="done.isPending.value" v-tooltip.top="t('agenda.doneBtn')" @click="done.mutate(r)" />
            <Button icon="pi pi-pencil" size="small" rounded text @click="openEdit(r)" />
            <Button icon="pi pi-trash" size="small" rounded text severity="danger" @click="del.mutate(r)" />
          </div>
        </div>

        <small class="hint"><i class="pi pi-whatsapp" /> {{ t('agenda.waHint') }}</small>
      </section>
    </div>

    <!-- Dialog tambah/ubah -->
    <Dialog v-model:visible="show" :header="editId ? t('agenda.edit') : t('agenda.new')" modal :style="{ width: '460px' }">
      <div class="form-grid">
        <label>{{ t('agenda.taskTitle') }}</label>
        <InputText v-model="form.title" maxlength="120" :placeholder="t('agenda.titlePh')" fluid />
        <div class="row2">
          <div><label>{{ t('cycles.actType') }}</label><Select v-model="form.activityType" :options="actTypes" optionValue="value" optionLabel="label" fluid /></div>
          <div><label>{{ t('agenda.due') }}</label><InputText v-model="form.dueDate" type="date" fluid /></div>
        </div>
        <label>{{ t('agenda.repeat') }}</label>
        <Select v-model="form.repeatDays" :options="repeatOptions" optionValue="value" optionLabel="label" fluid />
        <label>{{ t('agenda.linkCycle') }} <small>({{ t('agenda.linkCycleHint') }})</small></label>
        <Select v-model="form.cycleId" :options="cycles.data.value ?? []" optionValue="id" showClear filter :optionLabel="(c: any) => `${c.code} — ${c.name}`" fluid />
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.note" maxlength="300" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.title || !form.dueDate" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.sub { margin: 0.2rem 0 0; color: var(--app-text-muted); font-size: 0.85rem; max-width: 640px; }

.wx-top { margin-bottom: 1rem; }
.cal-layout { display: grid; grid-template-columns: 1.6fr 1fr; gap: 1rem; align-items: start; }
@media (max-width: 980px) { .cal-layout { grid-template-columns: 1fr; } }

.cal-panel, .list-panel {
  background: var(--app-surface); border: 1px solid var(--app-border);
  border-radius: 14px; padding: 0.9rem 1rem; min-width: 0;
}

.cal-nav { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.6rem; }
.cal-title { flex: 0 0 auto; min-width: 10rem; text-align: center; text-transform: capitalize; }

.cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.cal-dow { text-align: center; font-size: 0.68rem; font-weight: 700; color: var(--app-text-muted); text-transform: uppercase; padding: 0.2rem 0; }
.cal-cell {
  min-height: 74px; border-radius: 8px; background: var(--app-surface-2);
  padding: 0.25rem 0.3rem; display: flex; flex-direction: column; gap: 2px;
  cursor: pointer; overflow: hidden; border: 1px solid transparent;
}
.cal-cell:hover { border-color: var(--app-border); }
.cal-cell.dim { opacity: 0.45; }
.cal-cell.today { border-color: var(--app-primary); background: color-mix(in srgb, var(--app-primary) 8%, var(--app-surface-2)); }
.cal-day { font-size: 0.7rem; font-weight: 700; color: var(--app-text-muted); }
.cal-cell.today .cal-day { color: var(--app-primary); }
.cal-chip {
  display: block; width: 100%; text-align: left; border: none; cursor: pointer;
  background: color-mix(in srgb, var(--app-primary) 16%, transparent); color: var(--app-text);
  border-radius: 5px; padding: 0.1rem 0.3rem; font-size: 0.66rem; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cal-chip.late { background: color-mix(in srgb, #dc2626 16%, transparent); }
.cal-more { font-size: 0.62rem; color: var(--app-text-muted); }

.lp-h { margin: 0.2rem 0 0.5rem; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; }
.lp-h .pi { color: var(--app-primary); font-size: 0.85rem; }
.lp-h.late .pi { color: var(--app-danger); }
.task-row {
  display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.6rem;
  border-radius: 10px; background: var(--app-surface-2); margin-bottom: 0.35rem;
}
.task-row.late { background: color-mix(in srgb, #dc2626 8%, var(--app-surface-2)); }
.task-row.today { outline: 1px solid color-mix(in srgb, var(--app-primary) 40%, transparent); }
.tr-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.05rem; }
.tr-main strong { font-size: 0.86rem; }
.tr-main small { color: var(--app-text-muted); font-size: 0.72rem; display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
.mini-tag { font-size: 0.6rem !important; padding: 0.05rem 0.35rem !important; }
.tr-actions { display: flex; gap: 0.2rem; flex-shrink: 0; }
.hint { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: flex-start; margin-top: 0.6rem; font-size: 0.74rem; }
.hint .pi { color: #25d366; }
</style>
