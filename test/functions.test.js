// test/functions.test.js
'use strict'
const { checkFunctions, testFunction } = require('../scanner/functions')

const SUPA_URL = 'https://abc123.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fake'

describe('testFunction', () => {
  beforeEach(() => { jest.spyOn(global, 'fetch') })
  afterEach(() => { jest.restoreAllMocks() })

  it('retorna null quando função retorna 401 (protegida)', async () => {
    global.fetch.mockResolvedValue({ status: 401, ok: false })
    const result = await testFunction(SUPA_URL, ANON_KEY, 'send-email')
    expect(result).toBeNull()
  })

  it('retorna null quando função retorna 404 (não existe)', async () => {
    global.fetch.mockResolvedValue({ status: 404, ok: false })
    const result = await testFunction(SUPA_URL, ANON_KEY, 'nonexistent')
    expect(result).toBeNull()
  })

  it('retorna { fnName, status } quando função retorna 200 (aberta)', async () => {
    global.fetch.mockResolvedValue({ status: 200, ok: true })
    const result = await testFunction(SUPA_URL, ANON_KEY, 'send-email')
    expect(result).toEqual({ fnName: 'send-email', status: 200 })
  })

  it('retorna { fnName, status } quando função retorna 400 (aberta mas recusou payload)', async () => {
    global.fetch.mockResolvedValue({ status: 400, ok: false })
    const result = await testFunction(SUPA_URL, ANON_KEY, 'analyze')
    expect(result).toEqual({ fnName: 'analyze', status: 400 })
  })
})

describe('checkFunctions', () => {
  beforeEach(() => { jest.spyOn(global, 'fetch') })
  afterEach(() => { jest.restoreAllMocks() })

  it('retorna array vazio quando supabaseUrl ou anonKey são null', async () => {
    expect(await checkFunctions(null, null)).toEqual([])
  })

  it('retorna finding high para função aberta', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('send-daily-email')) return Promise.resolve({ status: 200, ok: true })
      return Promise.resolve({ status: 404, ok: false })
    })

    const findings = await checkFunctions(SUPA_URL, ANON_KEY)
    const f = findings.find(x => x.id === 'CAT4-fn-send-daily-email')
    expect(f).toBeDefined()
    expect(f.severity).toBe('high')
    expect(f.details.responseStatus).toBe(200)
  })
})
