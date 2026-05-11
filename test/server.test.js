// test/server.test.js
'use strict'
jest.mock('../scanner/index', () => ({ runScan: jest.fn() }))
jest.mock('../prompts/generator', () => ({
  generatePrompts: jest.fn(),
  calculateScore: jest.fn()
}))

const request = require('supertest')
const app = require('../server')
const { runScan } = require('../scanner/index')
const { generatePrompts, calculateScore } = require('../prompts/generator')

describe('POST /analyze', () => {
  it('retorna 400 para URL inválida', async () => {
    const res = await request(app).post('/analyze').send({ url: 'not-a-url' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('retorna 400 quando url não é fornecida', async () => {
    const res = await request(app).post('/analyze').send({})
    expect(res.status).toBe(400)
  })

  it('retorna 200 com id e status running para URL válida', async () => {
    runScan.mockResolvedValue({ findings: [], meta: {} })
    generatePrompts.mockResolvedValue({ prompts: '', error: null })
    calculateScore.mockReturnValue(0)

    const res = await request(app).post('/analyze').send({ url: 'https://example.com' })
    expect(res.status).toBe(200)
    expect(res.body.id).toBeDefined()
    expect(res.body.status).toBe('running')
  })
})

describe('GET /status/:id', () => {
  it('retorna 404 para id desconhecido', async () => {
    const res = await request(app).get('/status/nonexistent-id')
    expect(res.status).toBe(404)
  })

  it('retorna status do relatório para id existente', async () => {
    runScan.mockResolvedValue({ findings: [], meta: {} })
    generatePrompts.mockResolvedValue({ prompts: '', error: null })
    calculateScore.mockReturnValue(0)

    const analyzeRes = await request(app).post('/analyze').send({ url: 'https://example.com' })
    const { id } = analyzeRes.body

    const statusRes = await request(app).get(`/status/${id}`)
    expect(statusRes.status).toBe(200)
    expect(['running', 'done', 'error']).toContain(statusRes.body.status)
  })
})

describe('GET /report/:id', () => {
  it('retorna 404 para id desconhecido', async () => {
    const res = await request(app).get('/report/nonexistent-id')
    expect(res.status).toBe(404)
  })
})

describe('GET /health', () => {
  it('retorna ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
