import type { TargetTool } from '../types'

export const TASK_VERBS = [
  'write', 'rewrite', 'draft', 'generate', 'create', 'build', 'make',
  'summarize', 'summarise', 'condense', 'shorten',
  'refactor', 'improve', 'optimize', 'optimise', 'fix', 'debug', 'correct',
  'translate', 'convert', 'transform', 'parse', 'extract',
  'classify', 'categorize', 'categorise', 'label', 'tag',
  'explain', 'describe', 'define', 'outline', 'list',
  'compare', 'contrast', 'analyze', 'analyse', 'review', 'evaluate',
  'plan', 'design', 'propose', 'suggest', 'recommend',
  'answer', 'respond', 'reply',
  'edit', 'proofread', 'check',
]

export const TOOL_KEYWORD_MAP: Record<string, TargetTool> = {
  claude: 'claude',
  anthropic: 'claude',
  chatgpt: 'chatgpt',
  'gpt-4': 'chatgpt',
  'gpt4': 'chatgpt',
  'gpt-3': 'chatgpt',
  'gpt3': 'chatgpt',
  openai: 'chatgpt',
  o3: 'o3',
  'o3-mini': 'o3',
  midjourney: 'midjourney',
  'dall-e': 'midjourney',
  'dall e': 'midjourney',
  'stable diffusion': 'midjourney',
  email: 'email',
  gmail: 'email',
  outlook: 'email',
  code: 'code',
  copilot: 'code',
  cursor: 'code',
}

export const FORMAT_KEYWORDS: string[] = [
  'json', 'yaml', 'yml', 'xml', 'csv', 'tsv',
  'markdown', 'html', 'latex',
  'table', 'list', 'bullet', 'numbered list', 'outline',
  'paragraph', 'prose', 'essay', 'report', 'summary',
  'code', 'snippet', 'function', 'script',
  'email', 'letter', 'memo', 'tweet', 'post',
  'slide', 'presentation',
]

export const AUDIENCE_PATTERNS: RegExp[] = [
  /\bfor\s+(?:a\s+|an\s+)?([\w\s\-]{2,40}?)(?:\s+audience|\s+reader|\s+user)?(?:\.|,|$|\bwho\b|\bthat\b)/i,
  /\bexplain\s+(?:this\s+)?(?:to\s+|for\s+)(?:a\s+|an\s+)?([\w\s\-]{2,40?}?)(?:\.|,|$)/i,
  /\btargeted?\s+(?:at|to|toward)\s+(?:a\s+|an\s+)?([\w\s\-]{2,40}?)(?:\.|,|$)/i,
]

export const AUDIENCE_ROLE_KEYWORDS: string[] = [
  'executive', 'ceo', 'cto', 'manager', 'director', 'vp',
  'engineer', 'developer', 'programmer', 'designer',
  'beginner', 'novice', 'intermediate', 'expert', 'senior', 'junior',
  'student', 'teacher', 'professor', 'academic',
  'customer', 'client', 'user', 'consumer',
  'child', 'kid', 'teenager', 'adult', 'senior',
  'recruiter', 'hiring manager', 'interviewer',
  'non-technical', 'layperson', 'general audience',
]

export const CONSTRAINT_MARKERS: string[] = [
  'must not', 'must', 'do not', 'don\'t', "don't",
  'never', 'always', 'avoid', 'without', 'except',
  'only', 'strictly', 'no more than', 'at most', 'at least',
  'under', 'within', 'limit', 'max', 'min', 'minimum', 'maximum',
  'required', 'require', 'ensure', 'make sure',
  'words', 'characters', 'sentences', 'paragraphs', 'tokens',
]

export const SUCCESS_MARKERS: string[] = [
  'so that', 'in order to', 'in order for',
  'the goal is', 'the objective is', 'the aim is',
  'success looks like', 'success means', 'success criteria',
  'i need this to', 'this should allow', 'this should enable',
  'result should', 'output should', 'the end result',
]

export const EXAMPLE_MARKERS: string[] = [
  'for example', 'for instance', 'e.g.', 'eg.',
  'like this', 'such as', 'as in',
  'here is an example', 'here\'s an example',
  'sample input', 'sample output',
  'input:', 'output:',
]

// Matches "Header: value" at line start, case-insensitive
export const SECTION_HEADER_RE = /^(task|tool|format|constraints?|input|context|audience|success|examples?)\s*:\s*(.+)/im

export const ALL_SECTION_HEADERS_RE = /^(task|tool|format|constraints?|input|context|audience|success|examples?)\s*:\s*(.+(?:\n(?!(?:task|tool|format|constraints?|input|context|audience|success|examples?)\s*:).+)*)/gim

// Fenced code blocks
export const FENCED_CODE_RE = /```[\s\S]*?```/g

// "given the following" anchors
export const GIVEN_FOLLOWING_RE = /given\s+the\s+following[^:]*:\s*([\s\S]+?)(?:\n\n|\n(?=[A-Z])|\s*$)/i

// Blockquote-style input
export const BLOCKQUOTE_RE = /^>\s+.+/gm
