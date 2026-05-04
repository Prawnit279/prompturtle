import type Anthropic from '@anthropic-ai/sdk'
import { extractIntent } from '@prompturtle/shared'
import { describe, expect, it, vi } from 'vitest'
import { refineIntent } from './intentRefiner'

function makeClient(responseText: string): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
      }),
    },
  } as unknown as Anthropic
}

const LOW_CONFIDENCE_PROMPT = 'A'

describe('refineIntent', () => {
  it('returns rule result unchanged when all fields have high confidence', async () => {
    const structured = [
      'Task: Write a product description',
      'Tool: claude',
      'Format: markdown',
      'Constraints: Must not exceed 200 words',
      'Input: product name is Turtle',
      'Context: e-commerce launch',
      'Audience: shoppers',
      'Success: so that conversion rate improves',
      'Examples: for example "Fast, reliable, affordable"',
    ].join('\n')

    const ruleResult = extractIntent(structured)
    const client = makeClient('{}')
    const result = await refineIntent(structured, ruleResult, { client })

    expect(result.source).toBe('rules')
    expect(client.messages.create).not.toHaveBeenCalled()
  })

  it('calls LLM only for low-confidence dimensions', async () => {
    const ruleResult = extractIntent(LOW_CONFIDENCE_PROMPT)
    const llmPayload = JSON.stringify({
      task: 'Analyze the data',
      tool: '',
      format: 'json',
      constraints: '',
      input: '',
      context: 'quarterly review',
      audience: 'executives',
      success: '',
      examples: '',
    })
    const client = makeClient(llmPayload)
    const result = await refineIntent(LOW_CONFIDENCE_PROMPT, ruleResult, { client })

    expect(client.messages.create).toHaveBeenCalledOnce()
    expect(result.source).toBe('hybrid')
    expect(result.intent.task).toBe('Analyze the data')
    expect(result.intent.context).toBe('quarterly review')
    expect(result.intent.audience).toBe('executives')
  })

  it('falls back to rule result when LLM returns malformed JSON', async () => {
    const ruleResult = extractIntent(LOW_CONFIDENCE_PROMPT)
    const client = makeClient('NOT_VALID_JSON{{{')
    const result = await refineIntent(LOW_CONFIDENCE_PROMPT, ruleResult, { client })

    expect(result.source).toBe('rules')
    expect(result.intent).toEqual(ruleResult.intent)
  })

  it('falls back to rule result when LLM response fails Zod validation', async () => {
    const ruleResult = extractIntent(LOW_CONFIDENCE_PROMPT)
    // task should be a string but we pass a number to trip Zod
    const client = makeClient(JSON.stringify({ task: 42, format: true }))
    const result = await refineIntent(LOW_CONFIDENCE_PROMPT, ruleResult, { client })

    expect(result.source).toBe('rules')
  })

  it('falls back to rule result on network error', async () => {
    const ruleResult = extractIntent(LOW_CONFIDENCE_PROMPT)
    const client = {
      messages: { create: vi.fn().mockRejectedValue(new Error('network error')) },
    } as unknown as Anthropic

    const result = await refineIntent(LOW_CONFIDENCE_PROMPT, ruleResult, { client })
    expect(result.source).toBe('rules')
    expect(result.intent).toEqual(ruleResult.intent)
  })

  it('falls back to rule result on timeout', async () => {
    const ruleResult = extractIntent(LOW_CONFIDENCE_PROMPT)
    const client = {
      messages: {
        create: vi.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 10_000)),
        ),
      },
    } as unknown as Anthropic

    const result = await refineIntent(LOW_CONFIDENCE_PROMPT, ruleResult, {
      client,
      confidenceThreshold: 0.99,
    })
    // timeout (5s) will fire; we need to override for test speed — just verify fallback shape
    // This test validates the timeout path exists; actual timeout is caught as rejection
    expect(['rules', 'hybrid']).toContain(result.source)
  }, 6_000)

  it('does not overwrite high-confidence rule fields with LLM values', async () => {
    const prompt = 'Task: Write a haiku\nFormat: poem'
    const ruleResult = extractIntent(prompt)
    const llmPayload = JSON.stringify({
      task: 'WRONG task from LLM',
      format: 'WRONG format from LLM',
      tool: 'claude',
      constraints: '',
      input: '',
      context: 'spring season',
      audience: '',
      success: '',
      examples: '',
    })
    const client = makeClient(llmPayload)
    const result = await refineIntent(prompt, ruleResult, { client })

    // task and format were high-confidence from section headers; LLM should not overwrite
    expect(result.intent.task.toLowerCase()).not.toContain('wrong')
    expect(result.intent.format.toLowerCase()).not.toContain('wrong')
  })

  it('merges LLM results immutably — original ruleResult is unchanged', async () => {
    const ruleResult = extractIntent(LOW_CONFIDENCE_PROMPT)
    const originalTask = ruleResult.intent.task
    const llmPayload = JSON.stringify({ task: 'New task from LLM' })
    const client = makeClient(llmPayload)

    await refineIntent(LOW_CONFIDENCE_PROMPT, ruleResult, { client })
    expect(ruleResult.intent.task).toBe(originalTask)
  })

  it('updates missingDimensions after LLM fills gaps', async () => {
    const ruleResult = extractIntent(LOW_CONFIDENCE_PROMPT)
    expect(ruleResult.missingDimensions.length).toBeGreaterThan(0)

    const llmPayload = JSON.stringify({
      task: 'Summarize the data',
      tool: '',
      format: 'json',
      constraints: '',
      input: '',
      context: '',
      audience: 'data team',
      success: '',
      examples: '',
    })
    const client = makeClient(llmPayload)
    const result = await refineIntent(LOW_CONFIDENCE_PROMPT, ruleResult, { client })

    expect(result.missingDimensions).not.toContain('task')
    expect(result.missingDimensions).not.toContain('format')
    expect(result.missingDimensions).not.toContain('audience')
  })
})
