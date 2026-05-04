import type { TargetTool } from '../types'
import {
  ALL_SECTION_HEADERS_RE,
  AUDIENCE_PATTERNS,
  AUDIENCE_ROLE_KEYWORDS,
  BLOCKQUOTE_RE,
  CONSTRAINT_MARKERS,
  EXAMPLE_MARKERS,
  FENCED_CODE_RE,
  FORMAT_KEYWORDS,
  GIVEN_FOLLOWING_RE,
  SUCCESS_MARKERS,
  TASK_VERBS,
  TOOL_KEYWORD_MAP,
} from './heuristics'
import type {
  ExtractedIntent,
  IntentDimension,
  IntentExtractionResult,
  IntentExtractorOptions,
} from './types'

interface DimensionResult {
  value: string
  confidence: number
}

const EMPTY_RESULT: DimensionResult = { value: '', confidence: 0 }

// --- Section header fast pass ---

function parseSections(prompt: string): Partial<Record<IntentDimension, DimensionResult>> {
  const sections: Partial<Record<IntentDimension, DimensionResult>> = {}
  const re = new RegExp(ALL_SECTION_HEADERS_RE.source, ALL_SECTION_HEADERS_RE.flags)
  let match: RegExpExecArray | null

  while ((match = re.exec(prompt)) !== null) {
    const rawKey = match[1].toLowerCase().replace(/s$/, '') // normalize plural
    const value = match[2].trim()
    const key = normalizeHeaderKey(rawKey)
    if (key && value) {
      sections[key] = { value, confidence: 0.92 }
    }
  }

  return sections
}

function normalizeHeaderKey(raw: string): IntentDimension | null {
  const map: Record<string, IntentDimension> = {
    task: 'task',
    tool: 'tool',
    format: 'format',
    constraint: 'constraints',
    input: 'input',
    context: 'context',
    audience: 'audience',
    success: 'success',
    example: 'examples',
  }
  return map[raw] ?? null
}

// --- Per-dimension extractors ---

function extractTask(prompt: string): DimensionResult {
  const sentences = splitSentences(prompt)
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase().trimStart()
    for (const verb of TASK_VERBS) {
      if (lower.startsWith(verb + ' ') || lower.startsWith(verb + '\n')) {
        return { value: sentence.trim(), confidence: 0.85 }
      }
    }
  }
  // Fall back: first sentence that contains a task verb anywhere
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    if (TASK_VERBS.some(v => lower.includes(` ${v} `) || lower.startsWith(v + ' '))) {
      return { value: sentence.trim(), confidence: 0.6 }
    }
  }
  // Last resort: first sentence
  const first = sentences[0]?.trim() ?? ''
  return first ? { value: first, confidence: 0.3 } : EMPTY_RESULT
}

function extractTool(prompt: string): DimensionResult {
  const lower = prompt.toLowerCase()
  for (const [keyword, tool] of Object.entries(TOOL_KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      return { value: tool as TargetTool, confidence: 0.88 }
    }
  }
  return EMPTY_RESULT
}

function extractFormat(prompt: string): DimensionResult {
  const lower = prompt.toLowerCase()

  // Structural phrases like "as a JSON array", "in markdown"
  const phraseRe = /\b(?:as\s+(?:a\s+|an\s+)?|in\s+(?:a\s+|an\s+)?|formatted?\s+(?:as\s+)?)([\w\s]{2,30}?)(?:\.|,|\s|$)/gi
  let match: RegExpExecArray | null
  while ((match = phraseRe.exec(lower)) !== null) {
    const candidate = match[1].trim()
    if (FORMAT_KEYWORDS.some(kw => candidate.includes(kw))) {
      return { value: candidate, confidence: 0.82 }
    }
  }

  // Plain keyword scan
  for (const kw of FORMAT_KEYWORDS) {
    if (lower.includes(kw)) {
      return { value: kw, confidence: 0.65 }
    }
  }

  return EMPTY_RESULT
}

function extractConstraints(prompt: string): DimensionResult {
  const sentences = splitSentences(prompt)
  const matched: string[] = []

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    if (CONSTRAINT_MARKERS.some(m => lower.includes(m))) {
      matched.push(sentence.trim())
    }
  }

  if (matched.length === 0) return EMPTY_RESULT
  return { value: matched.join(' '), confidence: 0.78 }
}

function extractInput(prompt: string): DimensionResult {
  // Fenced code blocks
  const fenced = prompt.match(FENCED_CODE_RE)
  if (fenced && fenced.length > 0) {
    return { value: fenced.join('\n').trim(), confidence: 0.9 }
  }

  // "given the following ..." pattern
  const given = GIVEN_FOLLOWING_RE.exec(prompt)
  if (given?.[1]) {
    return { value: given[1].trim(), confidence: 0.85 }
  }

  // Blockquotes
  const blockquoteLines = prompt.match(BLOCKQUOTE_RE)
  if (blockquoteLines && blockquoteLines.length > 0) {
    return { value: blockquoteLines.join('\n').trim(), confidence: 0.8 }
  }

  return EMPTY_RESULT
}

function extractContext(prompt: string): DimensionResult {
  const sentences = splitSentences(prompt)

  // Explicit context markers
  const contextMarkers = ['background:', 'context:', 'for context,', 'for context:', 'note:', 'note that']
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    if (contextMarkers.some(m => lower.includes(m))) {
      return { value: sentence.trim(), confidence: 0.82 }
    }
  }

  // Sentences containing "we", "our", "I" before an imperative — likely setup
  const setupRe = /\b(we(?:'re| are| have| need)|\bour\b|i(?:'m| am| have| need))\b/i
  for (const sentence of sentences) {
    if (setupRe.test(sentence) && !TASK_VERBS.some(v => sentence.toLowerCase().startsWith(v + ' '))) {
      return { value: sentence.trim(), confidence: 0.5 }
    }
  }

  return EMPTY_RESULT
}

function extractAudience(prompt: string): DimensionResult {
  // Named patterns first
  for (const re of AUDIENCE_PATTERNS) {
    const match = re.exec(prompt)
    if (match?.[1]) {
      return { value: match[1].trim(), confidence: 0.8 }
    }
  }

  // Role keyword scan
  const lower = prompt.toLowerCase()
  for (const role of AUDIENCE_ROLE_KEYWORDS) {
    if (lower.includes(role)) {
      return { value: role, confidence: 0.6 }
    }
  }

  return EMPTY_RESULT
}

function extractSuccess(prompt: string): DimensionResult {
  const sentences = splitSentences(prompt)
  const matched: string[] = []

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    if (SUCCESS_MARKERS.some(m => lower.includes(m))) {
      matched.push(sentence.trim())
    }
  }

  if (matched.length === 0) return EMPTY_RESULT
  return { value: matched.join(' '), confidence: 0.75 }
}

function extractExamples(prompt: string): DimensionResult {
  const sentences = splitSentences(prompt)
  const matched: string[] = []

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    if (EXAMPLE_MARKERS.some(m => lower.includes(m))) {
      matched.push(sentence.trim())
    }
  }

  if (matched.length > 0) {
    return { value: matched.join(' '), confidence: 0.78 }
  }

  return EMPTY_RESULT
}

// --- Utility ---

const ABBREV_RE = /\b(?:e\.g|i\.e|etc|vs|dr|mr|mrs|ms|prof|jr|sr|no)\./gi

function splitSentences(text: string): string[] {
  // Temporarily replace abbreviation dots so they don't trigger sentence splits
  const placeholder = '\x00'
  const safe = text.replace(ABBREV_RE, m => m.slice(0, -1) + placeholder)
  return safe
    .split(/(?<=[.!?])\s+|(?<=\n)\s*/)
    .map(s => s.replace(new RegExp(placeholder, 'g'), '.').trim())
    .filter(Boolean)
}

// --- Main extractor ---

export function extractIntent(
  prompt: string,
  _opts?: IntentExtractorOptions,
): IntentExtractionResult {
  if (!prompt || !prompt.trim()) {
    const zeroed = Object.fromEntries(
      (['task', 'tool', 'format', 'constraints', 'input', 'context', 'audience', 'success', 'examples'] as IntentDimension[]).map(k => [k, 0]),
    ) as Record<IntentDimension, number>
    return {
      intent: { task: '', tool: '', format: '', constraints: '', input: '', context: '', audience: '', success: '', examples: '' },
      confidence: zeroed,
      missingDimensions: ['task', 'tool', 'format', 'constraints', 'input', 'context', 'audience', 'success', 'examples'],
      source: 'rules',
    }
  }

  const sections = parseSections(prompt)

  const dimensions: Record<IntentDimension, DimensionResult> = {
    task:        sections.task        ?? extractTask(prompt),
    tool:        sections.tool        ?? extractTool(prompt),
    format:      sections.format      ?? extractFormat(prompt),
    constraints: sections.constraints ?? extractConstraints(prompt),
    input:       sections.input       ?? extractInput(prompt),
    context:     sections.context     ?? extractContext(prompt),
    audience:    sections.audience    ?? extractAudience(prompt),
    success:     sections.success     ?? extractSuccess(prompt),
    examples:    sections.examples    ?? extractExamples(prompt),
  }

  const intent: ExtractedIntent = {
    task:        dimensions.task.value,
    tool:        dimensions.tool.value,
    format:      dimensions.format.value,
    constraints: dimensions.constraints.value,
    input:       dimensions.input.value,
    context:     dimensions.context.value,
    audience:    dimensions.audience.value,
    success:     dimensions.success.value,
    examples:    dimensions.examples.value,
  }

  const confidence = Object.fromEntries(
    Object.entries(dimensions).map(([k, v]) => [k, v.confidence]),
  ) as Record<IntentDimension, number>

  const missingDimensions = (Object.keys(intent) as IntentDimension[]).filter(k => !intent[k])

  return { intent, confidence, missingDimensions, source: 'rules' }
}
