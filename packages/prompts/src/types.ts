export interface PromptTemplate {
  id: string
  name: string
  tier: 'operational' | 'tactical' | 'strategic'
  category: string
  description: string
  requiredInputs: string[]
  promptBody: string
  expectedOutputFormat: string
  confidenceDrivers: string[]
}
