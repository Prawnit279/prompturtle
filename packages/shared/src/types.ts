// Core shared types
export type TargetTool = 'claude' | 'chatgpt' | 'o3' | 'midjourney' | 'code' | 'email'
export type PromptTier = 'swift' | 'sage' | 'nexus'

export interface OptimizeRequest {
  prompt: string
  targetTool?: TargetTool
  tier?: PromptTier
  context?: string
}

export interface OptimizeResponse {
  optimizedPrompt: string
  confidenceScore: number
  patternsDetected: Pattern[]
  tokenCount: number
  estimatedCost: number
  targetTool: TargetTool
}

export interface Pattern {
  id: string
  name: string
  severity: 'low' | 'medium' | 'high'
  description: string
  fix: string
}

export interface EmailTailorRequest {
  draft: string
  recipientRole: string
  tone: 'firm' | 'diplomatic' | 'urgent' | 'escalation' | 'apologetic'
  goal: string
  context?: string
}

export interface EmailTailorResponse {
  polishedEmail: string
  subjectLines: string[]
  toneAnalysis: string
  riskFlags: string[]
  alternatives: {
    firmer: string
    softer: string
  }
}
