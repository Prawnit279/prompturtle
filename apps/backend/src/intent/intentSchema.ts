import { z } from 'zod';

export const extractedIntentSchema = z.object({
  task: z.string(),
  tool: z.string(),
  format: z.string(),
  constraints: z.string(),
  input: z.string(),
  context: z.string(),
  audience: z.string(),
  success: z.string(),
  examples: z.string(),
});

export type ExtractedIntentZod = z.infer<typeof extractedIntentSchema>;
