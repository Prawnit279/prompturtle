import type Anthropic from '@anthropic-ai/sdk'
import type { ExtractedIntent, IntentDimension, IntentExtractionResult } from '@prompturtle/shared'
import { extractedIntentSchema } from './intentSchema'

const CONFIDENCE_THRESHOLD = 0.6
const MAX_TOKENS = 400
const TIMEOUT_MS = 5_000

interface RefineOptions {
  client: Anthropic
  confidenceThreshold?: number
}

const SYSTEM_PROMPT = `You are an intent parser. Given a raw prompt, extract the following dimensions as a JSON object.
Only fill in dimensions that are clearly present in the prompt.
Use empty string "" for any dimension you cannot confidently determine.

Dimensions:
- task: what the user wants done
- tool: which tool/model/system to use (use empty string if unspecified)
- format: desired output format
- constraints: limitations or rules
- input: the data or material being worked on
- context: background information
- audience: who the output is for
- success: how to know it worked
- examples: sample inputs/outputs

Respond with ONLY a valid JSON object matching these exact keys. No markdown, no explanation.`

function buildUserMessage(prompt: string, missingDimensions: IntentDimension[]): string {
  return `Raw prompt:\n${prompt}\n\nPlease fill in ONLY these missing dimensions: ${missingDimensions.join(', ')}`
}

export async function refineIntent(
  prompt: string,
  ruleResult: IntentExtractionResult,
  options: RefineOptions,
): Promise<IntentExtractionResult> {
  const threshold = options.confidenceThreshold ?? CONFIDENCE_THRESHOLD

  const dimensionsToRefine = (Object.keys(ruleResult.intent) as IntentDimension[]).filter(
    k => ruleResult.confidence[k] < threshold,
  )

  if (dimensionsToRefine.length === 0) {
    return ruleResult
  }

  let llmText: string
  try {
    const response = await withTimeout(
      options.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(prompt, dimensionsToRefine) }],
      }),
      TIMEOUT_MS,
    )
    llmText = response.content[0].type === 'text' ? response.content[0].text : ''
  } catch {
    return ruleResult
  }

  let parsed: Partial<ExtractedIntent>
  try {
    const raw = JSON.parse(llmText.trim())
    parsed = extractedIntentSchema.partial().parse(raw)
  } catch {
    return ruleResult
  }

  const mergedIntent: ExtractedIntent = { ...ruleResult.intent }
  const mergedConfidence = { ...ruleResult.confidence }

  for (const dim of dimensionsToRefine) {
    const llmValue = parsed[dim]
    if (typeof llmValue === 'string' && llmValue.trim()) {
      mergedIntent[dim] = llmValue.trim()
      mergedConfidence[dim] = 0.75
    }
  }

  const missingDimensions = (Object.keys(mergedIntent) as IntentDimension[]).filter(k => !mergedIntent[k])

  return {
    intent: mergedIntent,
    confidence: mergedConfidence,
    missingDimensions,
    source: 'hybrid',
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}
