// test/storage.test.js
'use strict'
const { checkStorage } = require('../scanner/storage')

const SUPA_URL = 'https://abc123.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fake'

describe('checkStorage', () => {
  beforeEach(() => { jest.spyOn(global, 'fetch') })
  afterEach(() => { jest.restoreAllMocks() })

  it('retorna array vazio quando supabaseUrl ou anonKey são null', async () => {
    expect(await checkStorage(null, null)).toEqual([])
  })

  it('retorna array vazio quando /storage/v1/bucket retorna 401', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401 })
    expect(await checkStorage(SUPA_URL, ANON_KEY)).toEqual([])
  })

  it('retorna finding high quando há buckets públicos', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'avatars', name: 'avatars', public: true },
        { id: 'docs', name: 'docs', public: false }
      ])
    })

    const findings = await checkStorage(SUPA_URL, ANON_KEY)
    expect(findings.length).toBe(1)
    expect(findings[0].id).toBe('CAT5-bucket-list')
    expect(findings[0].severity).toBe('high')
    expect(findings[0].details.publicNames).toContain('avatars')
  })

  it('retorna finding medium quando há buckets mas nenhum público', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'private', name: 'private', public: false }])
    })

    const findings = await checkStorage(SUPA_URL, ANON_KEY)
    expect(findings[0].severity).toBe('medium')
  })

  it('retorna array vazio quando bucket list está vazia', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    expect(await checkStorage(SUPA_URL, ANON_KEY)).toEqual([])
  })
})
