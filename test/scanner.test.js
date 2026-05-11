// test/scanner.test.js
'use strict'
jest.mock('../scanner/headers', () => ({ checkHeaders: jest.fn() }))
jest.mock('../scanner/bundle', () => ({ checkBundle: jest.fn() }))
jest.mock('../scanner/supabase', () => ({ checkSupabase: jest.fn() }))
jest.mock('../scanner/functions', () => ({ checkFunctions: jest.fn() }))
jest.mock('../scanner/storage', () => ({ checkStorage: jest.fn() }))

const { runScan } = require('../scanner/index')
const { checkHeaders } = require('../scanner/headers')
const { checkBundle } = require('../scanner/bundle')
const { checkSupabase } = require('../scanner/supabase')
const { checkFunctions } = require('../scanner/functions')
const { checkStorage } = require('../scanner/storage')

describe('runScan', () => {
  beforeEach(() => {
    checkHeaders.mockResolvedValue([])
    checkBundle.mockResolvedValue({ findings: [], supabaseUrl: null, supabaseAnonKey: null })
    checkSupabase.mockResolvedValue([])
    checkFunctions.mockResolvedValue([])
    checkStorage.mockResolvedValue([])
  })

  it('retorna objeto com findings e meta', async () => {
    const result = await runScan('https://example.com')
    expect(result).toHaveProperty('findings')
    expect(result).toHaveProperty('meta')
    expect(result.meta).toHaveProperty('appUrl', 'https://example.com')
  })

  it('agrega findings de todos os scanners', async () => {
    checkHeaders.mockResolvedValue([{ id: 'CAT1-test', severity: 'medium' }])
    checkBundle.mockResolvedValue({
      findings: [{ id: 'CAT2-test', severity: 'info' }],
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'anon-key-test'
    })
    checkSupabase.mockResolvedValue([{ id: 'CAT3-test', severity: 'critical' }])

    const result = await runScan('https://example.com')
    expect(result.findings.length).toBe(3)
    expect(result.meta.supabaseUrl).toBe('https://abc.supabase.co')
  })

  it('passa supabaseUrl e anonKey do bundle para checkSupabase, checkFunctions e checkStorage', async () => {
    checkBundle.mockResolvedValue({
      findings: [],
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'the-anon-key'
    })

    await runScan('https://example.com')

    expect(checkSupabase).toHaveBeenCalledWith('https://proj.supabase.co', 'the-anon-key')
    expect(checkFunctions).toHaveBeenCalledWith('https://proj.supabase.co', 'the-anon-key')
    expect(checkStorage).toHaveBeenCalledWith('https://proj.supabase.co', 'the-anon-key')
  })

  it('continua mesmo quando um scanner lança exceção', async () => {
    checkHeaders.mockRejectedValue(new Error('timeout'))
    checkBundle.mockResolvedValue({ findings: [{ id: 'CAT2-test' }], supabaseUrl: null, supabaseAnonKey: null })

    const result = await runScan('https://example.com')
    expect(result.findings.length).toBe(1)
  })
})
