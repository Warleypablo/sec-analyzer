// test/supabase.test.js
'use strict'
const { checkSupabase, detectSensitiveFields } = require('../scanner/supabase')

const SUPA_URL = 'https://abc123.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fake'

describe('detectSensitiveFields', () => {
  it('detecta email em nomes de colunas', () => {
    const rows = [{ id: 1, email: 'user@test.com', name: 'User' }]
    expect(detectSensitiveFields(rows)).toContain('email')
  })

  it('detecta cpf e telefone', () => {
    const rows = [{ id: 1, cpf: '123', telefone: '999' }]
    const fields = detectSensitiveFields(rows)
    expect(fields).toContain('cpf')
    expect(fields).toContain('telefone')
  })

  it('retorna array vazio para rows sem campos sensíveis', () => {
    const rows = [{ id: 1, name: 'Test', status: 'active' }]
    expect(detectSensitiveFields(rows)).toEqual([])
  })

  it('retorna array vazio para rows vazias', () => {
    expect(detectSensitiveFields([])).toEqual([])
  })
})

describe('checkSupabase', () => {
  beforeEach(() => { jest.spyOn(global, 'fetch') })
  afterEach(() => { jest.restoreAllMocks() })

  it('retorna array vazio quando supabaseUrl ou anonKey são null', async () => {
    expect(await checkSupabase(null, null)).toEqual([])
    expect(await checkSupabase(SUPA_URL, null)).toEqual([])
  })

  it('retorna finding crítico quando tabela expõe dados sensíveis', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/rest/v1/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ paths: { '/leads': {} } })
        })
      }
      if (url.includes('/rest/v1/leads')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, email: 'user@test.com', phone: '999' }])
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    })

    const findings = await checkSupabase(SUPA_URL, ANON_KEY)
    const f = findings.find(x => x.id === 'CAT3-rls-leads')
    expect(f).toBeDefined()
    expect(f.severity).toBe('critical')
    expect(f.details.sensitiveFields).toContain('email')
  })

  it('retorna finding critical quando tabela exposta sem campos sensíveis', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/rest/v1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ paths: { '/products': {} } }) })
      }
      if (url.includes('/rest/v1/products')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1, name: 'Product A', price: 100 }]) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })

    const findings = await checkSupabase(SUPA_URL, ANON_KEY)
    const f = findings.find(x => x.id === 'CAT3-rls-products')
    expect(f).toBeDefined()
    expect(f.severity).toBe('critical')
    expect(f.impact).toMatch(/RLS ausente/)
  })

  it('retorna finding info rls-ok quando todas as tabelas estão protegidas', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    })

    const findings = await checkSupabase(SUPA_URL, ANON_KEY)
    expect(findings).toHaveLength(1)
    const f = findings[0]
    expect(f.id).toBe('CAT3-rls-ok')
    expect(f.severity).toBe('info')
    expect(f.impact).toMatch(/RLS/)
  })
})
