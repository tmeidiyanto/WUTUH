/**
 * Rantai nilai agribisnis WUTUH — 13 tahap tanpa terputus.
 * Setiap Siklus Produksi bergerak maju melalui tahapan ini.
 */
export const STAGES = [
  'land',
  'planning',
  'planting',
  'cultivation',
  'monitoring',
  'harvest',
  'processing',
  'quality',
  'warehouse',
  'market',
  'logistics',
  'export',
  'customer',
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  land: 'Lahan',
  planning: 'Perencanaan',
  planting: 'Tanam / Bibit',
  cultivation: 'Budidaya',
  monitoring: 'Pemantauan',
  harvest: 'Panen',
  processing: 'Pengolahan',
  quality: 'Mutu',
  warehouse: 'Gudang',
  market: 'Pasar',
  logistics: 'Logistik',
  export: 'Ekspor',
  customer: 'Pelanggan',
};

export function stageIndex(s: string): number {
  return STAGES.indexOf(s as Stage);
}

export function nextStage(s: string): Stage | null {
  const i = stageIndex(s);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}
