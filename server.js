'use strict'

require('dotenv').config()

const express = require('express')
const path = require('path')
const { randomUUID } = require('crypto')
const { runScan } = require('./scanner/index')
const { generatePrompts, calculateScore } = require('./prompts/generator')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

const reports = new Map()

app.get('/health', (_req, res) => res.json({ ok: true }))

app.post('/analyze', (req, res) => {
  const { url } = req.body ?? {}
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'URL inválida. Forneça uma URL que comece com http(s)://' })
  }

  const id = randomUUID()
  reports.set(id, {
    id, url, status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    findings: [], prompts: '', score: 0, meta: {}, error: null
  })

  res.json({ id, status: 'running' })

  ;(async () => {
    try {
      const { findings, meta } = await runScan(url)
      const { prompts, error: promptError } = await generatePrompts(findings, meta)
      const score = calculateScore(findings)
      reports.set(id, {
        ...reports.get(id),
        status: 'done', findings, prompts, score, meta,
        error: promptError, completedAt: new Date().toISOString()
      })
    } catch (err) {
      reports.set(id, {
        ...reports.get(id),
        status: 'error', error: err.message, completedAt: new Date().toISOString()
      })
    }
  })()
})

app.get('/status/:id', (req, res) => {
  const report = reports.get(req.params.id)
  if (!report) return res.status(404).json({ error: 'Relatório não encontrado' })
  res.json({ id: report.id, status: report.status, error: report.error })
})

app.get('/report/:id', (req, res) => {
  const report = reports.get(req.params.id)
  if (!report) return res.status(404).json({ error: 'Relatório não encontrado' })
  if (report.status !== 'done') return res.status(202).json({ status: report.status })
  res.json(report)
})

const PORT = process.env.PORT || 3000
if (require.main === module) {
  app.listen(PORT, () => console.log(`Security Analyzer → http://localhost:${PORT}`))
}

module.exports = app
