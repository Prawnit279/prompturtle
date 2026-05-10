export interface ExtractedIntent {
  task: string;
  tool: string;
  format: string;
  constraints: string;
  input: string;
  context: string;
  audience: string;
  success: string;
  examples: string;
}

export type IntentDimension = keyof ExtractedIntent;

export interface IntentExtractionResult {
  intent: ExtractedIntent;
  confidence: Record<IntentDimension, number>;
  missingDimensions: IntentDimension[];
  source: 'rules' | 'llm' | 'hybrid';
}

export interface IntentExtractorOptions {
  locale?: string;
}
