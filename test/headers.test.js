// test/headers.test.js
'use strict'
const { checkHeaders } = require('../scanner/headers')

describe('checkHeaders', () => {
  beforeEach(() => { jest.spyOn(global, 'fetch') })
  afterEach(() => { jest.restoreAllMocks() })

  function mockFetch(headerMap = {}) {
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: (k) => headerMap[k.toLowerCase()] ?? null }
    })
  }

  it('retorna finding CAT1-missing-content-security-policy quando CSP ausente', async () => {
    mockFetch({})
    const findings = await checkHeaders('https://example.com')
    const f = findings.find(x => x.id === 'CAT1-missing-content-security-policy')
    expect(f).toBeDefined()
    expect(f.severity).toBe('medium')
    expect(f.category).toBe('headers')
  })

  it('não retorna finding de CSP quando header está presente', async () => {
    mockFetch({ 'content-security-policy': "default-src 'self'" })
    const findings = await checkHeaders('https://example.com')
    expect(findings.some(x => x.id === 'CAT1-missing-content-security-policy')).toBe(false)
  })

  it('retorna finding CAT1-cors-wildcard com severidade high quando CORS é *', async () => {
    mockFetch({ 'access-control-allow-origin': '*' })
    const findings = await checkHeaders('https://example.com')
    const f = findings.find(x => x.id === 'CAT1-cors-wildcard')
    expect(f).toBeDefined()
    expect(f.severity).toBe('high')
  })

  it('retorna finding CAT1-fetch-error quando URL inacessível', async () => {
    global.fetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const findings = await checkHeaders('https://unreachable.example.com')
    expect(findings.some(x => x.id === 'CAT1-fetch-error')).toBe(true)
  })

  it('x-content-type-options tem severidade low', async () => {
    mockFetch({})
    const findings = await checkHeaders('https://example.com')
    const f = findings.find(x => x.id === 'CAT1-missing-x-content-type-options')
    expect(f.severity).toBe('low')
  })

  it('todos os findings têm campos obrigatórios', async () => {
    mockFetch({})
    const findings = await checkHeaders('https://example.com')
    for (const f of findings) {
      expect(f).toHaveProperty('id')
      expect(f).toHaveProperty('category')
      expect(f).toHaveProperty('title')
      expect(f).toHaveProperty('severity')
      expect(f).toHaveProperty('evidence')
      expect(f).toHaveProperty('impact')
      expect(f).toHaveProperty('details')
    }
  })
})
