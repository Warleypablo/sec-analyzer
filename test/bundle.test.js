// test/bundle.test.js
'use strict'
const { checkBundle, decodeJwtPayload, extractScriptUrls } = require('../scanner/bundle')

function makeJwt(payload) {
  const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fakesignature`
}

const ANON_KEY = makeJwt({ role: 'anon', iss: 'supabase', ref: 'abcdefghij' })
const SERVICE_KEY = makeJwt({ role: 'service_role', iss: 'supabase', ref: 'abcdefghij' })
const SUPABASE_URL = 'https://abcdefghij.supabase.co'

describe('decodeJwtPayload', () => {
  it('decodifica payload de JWT válido', () => {
    const result = decodeJwtPayload(ANON_KEY)
    expect(result).toEqual({ role: 'anon', iss: 'supabase', ref: 'abcdefghij' })
  })

  it('retorna null para JWT inválido', () => {
    expect(decodeJwtPayload('nao.e.um.jwt.valido')).toBeNull()
    expect(decodeJwtPayload('invalid')).toBeNull()
  })
})

describe('extractScriptUrls', () => {
  it('extrai URLs absolutas de script src', () => {
    const html = '<html><script src="https://cdn.example.com/bundle.js"></script></html>'
    const urls = extractScriptUrls(html, 'https://example.com')
    expect(urls).toContain('https://cdn.example.com/bundle.js')
  })

  it('converte paths relativos para URL absoluta', () => {
    const html = '<html><script src="/assets/index-abc.js"></script></html>'
    const urls = extractScriptUrls(html, 'https://myapp.example.com')
    expect(urls).toContain('https://myapp.example.com/assets/index-abc.js')
  })

  // Regressão: apps Lovable atuais carregam o bundle como ES module, sem <script src>.
  // O bundle entra por <link rel="modulepreload"> e por import() dinâmico em <script type="module">.
  it('extrai bundles de <link rel="modulepreload">', () => {
    const html = '<html><head><link rel="modulepreload" href="/assets/index--4zzMzlr.js"/></head></html>'
    const urls = extractScriptUrls(html, 'https://myapp.example.com')
    expect(urls).toContain('https://myapp.example.com/assets/index--4zzMzlr.js')
  })

  it('extrai bundles de import() dinâmico em <script type="module">', () => {
    const html = '<html><body><script type="module" async="">import("/assets/index-VIfClXnl.js")</script></body></html>'
    const urls = extractScriptUrls(html, 'https://myapp.example.com')
    expect(urls).toContain('https://myapp.example.com/assets/index-VIfClXnl.js')
  })
})

describe('checkBundle', () => {
  beforeEach(() => { jest.spyOn(global, 'fetch') })
  afterEach(() => { jest.restoreAllMocks() })

  it('detecta service_role key como finding critical', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(`<html><script src="/bundle.js"></script></html>`) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(`const k="${SERVICE_KEY}";const url="${SUPABASE_URL}"`) })

    const result = await checkBundle('https://myapp.example.com')
    expect(result.findings.some(f => f.id === 'CAT2-service-role-key')).toBe(true)
    expect(result.findings.find(f => f.id === 'CAT2-service-role-key').severity).toBe('critical')
  })

  it('detecta anon key e a expõe em supabaseAnonKey', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(`<html><script src="/bundle.js"></script></html>`) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(`const k="${ANON_KEY}";const url="${SUPABASE_URL}"`) })

    const result = await checkBundle('https://myapp.example.com')
    expect(result.supabaseAnonKey).toBe(ANON_KEY)
    expect(result.supabaseUrl).toBe(SUPABASE_URL)
    expect(result.findings.some(f => f.id === 'CAT2-anon-key')).toBe(true)
    expect(result.findings.find(f => f.id === 'CAT2-anon-key').severity).toBe('info')
  })

  it('detecta OpenAI key como critical', async () => {
    const openaiKey = 'sk-' + 'a'.repeat(48)
    global.fetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(`<html><script src="/bundle.js"></script></html>`) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(`const openai="${openaiKey}"`) })

    const result = await checkBundle('https://myapp.example.com')
    expect(result.findings.some(f => f.id === 'CAT2-openai-key')).toBe(true)
  })

  it('retorna resultado vazio quando URL inacessível', async () => {
    global.fetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await checkBundle('https://unreachable.example.com')
    expect(result.findings).toEqual([])
    expect(result.supabaseUrl).toBeNull()
    expect(result.supabaseAnonKey).toBeNull()
  })
})
