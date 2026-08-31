import { tg } from '@/i18n';

/** Rantai nilai agribisnis WUTUH — cermin dari shared/stages.ts di API. */
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

/** Ikon per tahap; label diambil dari i18n (`stage.<kode>`). */
export const STAGE_ICONS: Record<Stage, string> = {
  land: 'pi-map',
  planning: 'pi-calendar',
  planting: 'pi-sun',
  cultivation: 'pi-sparkles',
  monitoring: 'pi-eye',
  harvest: 'pi-inbox',
  processing: 'pi-cog',
  quality: 'pi-verified',
  warehouse: 'pi-warehouse',
  market: 'pi-shopping-cart',
  logistics: 'pi-truck',
  export: 'pi-globe',
  customer: 'pi-users',
};

export const stageIndex = (s: string) => STAGES.indexOf(s as Stage);
export const stageLabel = (s: string) => (STAGES.includes(s as Stage) ? tg(`stage.${s}`) : s);
export const stageIcon = (s: string) => STAGE_ICONS[s as Stage] ?? 'pi-circle';
