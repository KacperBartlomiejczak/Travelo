import { z } from 'zod';

export const LegalDocSchema = z.enum(['privacy', 'terms']);
export type LegalDoc = z.infer<typeof LegalDocSchema>;

// One legal document as it sits in the i18n dictionaries (`legal.privacy`, `legal.terms`). An empty heading is an intro without a title.
export const LegalDocumentSchema = z.object({
  title: z.string().min(1),
  updated: z.string().min(1),
  sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) })).min(1),
});
export type LegalDocument = z.infer<typeof LegalDocumentSchema>;
