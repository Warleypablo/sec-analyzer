// test/generator.test.js
'use strict'
jest.mock('@anthropic-ai/sdk')

const Anthropic = require('@anthropic-ai/sdk')
const { calculateScore, generateFallbackPrompts } = require('../prompts/generator')

const SAMPLE_FINDINGS = [
  { id: 'CAT3-rls-leads', category: 'rls', title: 'Tabela `leads` acessível', severity: 'critical', evidence: 'curl ...', impact: 'Dados expostos', details: { sensitiveFields: ['email'] } },
  { id: 'CAT1-missing-csp', category: 'headers', title: 'CSP ausente', severity: 'medium', evidence: 'curl -sI ...', impact: 'Risco de XSS', details: {} },
  { id: 'CAT2-anon-key', category: 'bundle', title: 'Anon key detectada', severity: 'info', evidence: '...', impact: '...', details: {} }
]

const META = { appUrl: 'https://myapp.example.com', supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'eyJ...' }

describe('calculateScore', () => {
  it('retorna 0 para findings vazios', () => {
    expect(calculateScore([])).toBe(0)
  })

  it('retorna 25 para 1 finding crítico', () => {
    expect(calculateScore([{ severity: 'critical' }])).toBe(25)
  })

  it('aplica cap de 100', () => {
    const manyFindings = Array(10).fill({ severity: 'critical' })
    expect(calculateScore(manyFindings)).toBe(100)
  })

  it('soma múltiplos findings', () => {
    expect(calculateScore([{ severity: 'critical' }, { severity: 'high' }, { severity: 'medium' }])).toBe(45)
  })
})

describe('generateFallbackPrompts', () => {
  it('gera prompts apenas para critical e high', () => {
    const result = generateFallbackPrompts(SAMPLE_FINDINGS)
    expect(result).toContain('CAT3-rls-leads')
    expect(result).not.toContain('CAT1-missing-csp')
  })
})

describe('generatePrompts', () => {
  it('retorna mensagem sem findings quando não há critical/high/medium', async () => {
    // Re-require após configurar mock
    jest.resetModules()
    jest.mock('@anthropic-ai/sdk')
    const { generatePrompts } = require('../prompts/generator')
    const infoOnly = [{ severity: 'info', id: 'x', title: 'test', category: 'headers', evidence: '', impact: '', details: {} }]
    const result = await generatePrompts(infoOnly, META)
    expect(result.prompts).toContain('Nenhum finding')
    expect(result.error).toBeNull()
  })

  it('chama Claude API com system prompt cacheado e retorna prompts', async () => {
    jest.resetModules()
    jest.mock('@anthropic-ai/sdk')
    const Anthropic2 = require('@anthropic-ai/sdk')
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ text: '## Prompt 1 — Fix RLS\n```\nCorrigir RLS\n```' }]
    })
    Anthropic2.mockImplementation(() => ({ messages: { create: mockCreate } }))

    const { generatePrompts } = require('../prompts/generator')
    const result = await generatePrompts(SAMPLE_FINDINGS, META)

    expect(result.error).toBeNull()
    expect(result.prompts).toContain('Prompt 1')
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-sonnet-4-6',
      system: expect.arrayContaining([
        expect.objectContaining({ cache_control: { type: 'ephemeral' } })
      ])
    }))
  })

  it('usa fallback quando Claude API lança erro', async () => {
    jest.resetModules()
    jest.mock('@anthropic-ai/sdk')
    const Anthropic3 = require('@anthropic-ai/sdk')
    const mockCreate = jest.fn().mockRejectedValue(new Error('API error'))
    Anthropic3.mockImplementation(() => ({ messages: { create: mockCreate } }))

    const { generatePrompts } = require('../prompts/generator')
    const result = await generatePrompts(SAMPLE_FINDINGS, META)
    expect(result.error).toBe('API error')
    expect(result.prompts).toBeDefined()
    expect(typeof result.prompts).toBe('string')
  })
})
