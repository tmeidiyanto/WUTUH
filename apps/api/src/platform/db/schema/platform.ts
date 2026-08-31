import { integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';

/** Penomoran dokumen configurable per company per doc_type (SKL, PSN, KTR, EKS, KRM, LPK). */
export const numberingSequences = pgTable(
  'numbering_sequences',
  {
    id: idPk(),
    companyId: companyId(),
    docType: text('doc_type').notNull(),
    prefix: text('prefix').notNull().default(''),
    padding: integer('padding').notNull().default(4),
    nextValue: integer('next_value').notNull().default(1),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_numbering_company_doctype').on(t.companyId, t.docType) }),
);
