import { describe, expect, it } from 'vitest';

import { extractIntent } from './intentExtractor';

describe('extractIntent', () => {
  // --- task ---
  describe('task', () => {
    it('extracts imperative verb at start of sentence', () => {
      const result = extractIntent('Summarize this article in 3 bullets.');
      expect(result.intent.task.toLowerCase()).toContain('summarize');
    });

    it('extracts task from mid-prompt imperative', () => {
      const result = extractIntent('Here is the report. Please refactor the code for clarity.');
      expect(result.intent.task.toLowerCase()).toMatch(/refactor/);
    });

    it('extracts task from explicit Task: header', () => {
      const result = extractIntent('Task: Write a product description\nAudience: shoppers');
      expect(result.intent.task.toLowerCase()).toContain('write');
      expect(result.confidence.task).toBeGreaterThanOrEqual(0.9);
    });
  });

  // --- tool ---
  describe('tool', () => {
    it('detects claude by keyword', () => {
      const result = extractIntent('Use Claude to refactor this Python file.');
      expect(result.intent.tool).toBe('claude');
    });

    it('detects chatgpt alias gpt-4', () => {
      const result = extractIntent('Send this prompt to GPT-4 for review.');
      expect(result.intent.tool).toBe('chatgpt');
    });

    it('detects midjourney via dall-e alias', () => {
      const result = extractIntent('Generate an image with DALL-E based on this scene.');
      expect(result.intent.tool).toBe('midjourney');
    });

    it('returns empty string when no tool found', () => {
      const result = extractIntent('Write a haiku about autumn.');
      expect(result.intent.tool).toBe('');
    });
  });

  // --- format ---
  describe('format', () => {
    it('extracts json from "as a JSON array"', () => {
      const result = extractIntent('Return the result as a JSON array.');
      expect(result.intent.format.toLowerCase()).toContain('json');
    });

    it('extracts markdown from "in markdown"', () => {
      const result = extractIntent('Write the documentation in markdown.');
      expect(result.intent.format.toLowerCase()).toContain('markdown');
    });

    it('extracts table format', () => {
      const result = extractIntent('Present the data as a table.');
      expect(result.intent.format.toLowerCase()).toContain('table');
    });

    it('returns empty when no format detected', () => {
      const result = extractIntent('Tell me about black holes.');
      expect(result.intent.format).toBe('');
    });
  });

  // --- constraints ---
  describe('constraints', () => {
    it('extracts word limit constraint', () => {
      const result = extractIntent('Keep it under 100 words.');
      expect(result.intent.constraints.toLowerCase()).toContain('under');
      expect(result.intent.constraints.toLowerCase()).toContain('100');
    });

    it('extracts multiple constraints', () => {
      const result = extractIntent('Keep it under 100 words. Do not mention pricing.');
      expect(result.intent.constraints.toLowerCase()).toContain('do not mention');
      expect(result.intent.constraints.toLowerCase()).toContain('under 100');
    });

    it('extracts must/must not constraints', () => {
      const result = extractIntent('You must use formal language. You must not use jargon.');
      expect(result.intent.constraints.toLowerCase()).toMatch(/must/);
    });
  });

  // --- input ---
  describe('input', () => {
    it('extracts fenced code block as input', () => {
      const result = extractIntent('Refactor the following:\n```python\ndef foo():\n  pass\n```');
      expect(result.intent.input).toContain('```python');
      expect(result.confidence.input).toBeGreaterThanOrEqual(0.85);
    });

    it('extracts "given the following" anchor', () => {
      const result = extractIntent('Given the following text: The sky is blue. Summarize it.');
      expect(result.intent.input.toLowerCase()).toContain('the sky is blue');
    });

    it('returns empty when no input block found', () => {
      const result = extractIntent('Write a poem about the ocean.');
      expect(result.intent.input).toBe('');
    });
  });

  // --- context ---
  describe('context', () => {
    it('extracts explicit context: header content', () => {
      const result = extractIntent('Context: we are launching a product next week. Write a tweet.');
      expect(result.intent.context.toLowerCase()).toContain('launching');
    });

    it('extracts background: marker', () => {
      const result = extractIntent('Background: our API uses REST. Generate documentation.');
      expect(result.intent.context.toLowerCase()).toContain('api');
    });
  });

  // --- audience ---
  describe('audience', () => {
    it('extracts "for a 10-year-old" audience', () => {
      const result = extractIntent('Explain quantum computing for a 10-year-old.');
      expect(result.intent.audience.toLowerCase()).toMatch(/10.year.old/);
    });

    it('extracts role keyword "engineer"', () => {
      const result = extractIntent('Describe this system to an engineer.');
      expect(result.intent.audience.toLowerCase()).toContain('engineer');
    });

    it('extracts audience from explicit header', () => {
      const result = extractIntent('Task: Write a summary\nAudience: executive');
      expect(result.intent.audience.toLowerCase()).toContain('executive');
      expect(result.confidence.audience).toBeGreaterThanOrEqual(0.9);
    });
  });

  // --- success ---
  describe('success', () => {
    it('extracts "so that" success criterion', () => {
      const result = extractIntent('Draft an email so that the client agrees to a follow-up call.');
      expect(result.intent.success.toLowerCase()).toContain('client agrees');
    });

    it('extracts "the goal is" marker', () => {
      const result = extractIntent('The goal is to reduce churn by 20%. Write a retention email.');
      expect(result.intent.success.toLowerCase()).toContain('reduce churn');
    });
  });

  // --- examples ---
  describe('examples', () => {
    it('extracts "for example" inline example', () => {
      const result = extractIntent("Generate taglines. For example: 'Just Do It'.");
      expect(result.intent.examples.toLowerCase()).toContain('just do it');
    });

    it('extracts "e.g." example', () => {
      const result = extractIntent('Use a professional tone, e.g. "We appreciate your patience".');
      expect(result.intent.examples.toLowerCase()).toContain('we appreciate');
    });
  });

  // --- structured prompt (all headers) ---
  describe('section-header structured prompts', () => {
    it('fills multiple dimensions with high confidence from explicit headers', () => {
      const prompt = [
        'Task: Summarize the quarterly report',
        'Audience: C-suite executives',
        'Format: markdown',
        'Constraints: Must not exceed 200 words',
      ].join('\n');

      const result = extractIntent(prompt);
      expect(result.intent.task.toLowerCase()).toContain('summarize');
      expect(result.intent.audience.toLowerCase()).toContain('executive');
      expect(result.intent.format.toLowerCase()).toContain('markdown');
      expect(result.intent.constraints.toLowerCase()).toContain('200');
      expect(result.confidence.task).toBeGreaterThanOrEqual(0.9);
      expect(result.confidence.audience).toBeGreaterThanOrEqual(0.9);
    });
  });

  // --- empty prompt ---
  describe('empty / blank prompts', () => {
    it('returns all empty strings and zero confidence for empty input', () => {
      const result = extractIntent('');
      const dims: (keyof typeof result.intent)[] = [
        'task',
        'tool',
        'format',
        'constraints',
        'input',
        'context',
        'audience',
        'success',
        'examples',
      ];
      for (const dim of dims) {
        expect(result.intent[dim]).toBe('');
        expect(result.confidence[dim]).toBe(0);
      }
      expect(result.missingDimensions.length).toBe(9);
    });

    it('returns all empty strings for whitespace-only input', () => {
      const result = extractIntent('   \n\t  ');
      expect(result.missingDimensions.length).toBe(9);
    });
  });

  // --- missingDimensions ---
  describe('missingDimensions', () => {
    it('lists dimensions with empty values', () => {
      const result = extractIntent('Summarize this article.');
      expect(result.missingDimensions).toContain('tool');
      expect(result.missingDimensions).toContain('input');
    });

    it('does not list populated dimensions as missing', () => {
      const result = extractIntent('Use Claude to write a JSON report.');
      expect(result.missingDimensions).not.toContain('task');
      expect(result.missingDimensions).not.toContain('tool');
      expect(result.missingDimensions).not.toContain('format');
    });
  });

  // --- source ---
  describe('source', () => {
    it('always returns "rules" as source', () => {
      expect(extractIntent('Write a poem.').source).toBe('rules');
      expect(extractIntent('').source).toBe('rules');
    });
  });

  // --- immutability ---
  describe('immutability', () => {
    it('returns distinct objects on repeated calls with same input', () => {
      const prompt = 'Summarize this document.';
      const a = extractIntent(prompt);
      const b = extractIntent(prompt);
      expect(a).not.toBe(b);
      expect(a.intent).not.toBe(b.intent);
      expect(a.intent).toEqual(b.intent);
    });

    it('mutations to result do not affect subsequent calls', () => {
      const prompt = 'Write a report in markdown.';
      const a = extractIntent(prompt);
      (a.intent as { task: string }).task = 'MUTATED';
      const b = extractIntent(prompt);
      expect(b.intent.task).not.toBe('MUTATED');
    });
  });
});
