// scanner/bundle.js
'use strict'

function decodeJwtPayload(jwt) {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

function extractScriptUrls(html, baseUrl) {
  const matches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
  return matches
    .map(m => {
      const src = m[1]
      try {
        if (src.startsWith('http')) return src
        if (src.startsWith('//')) return `https:${src}`
        return new URL(src, baseUrl).href
      } catch { return null }
    })
    .filter(Boolean)
}

const OTHER_PATTERNS = [
  { regex: /sk-[a-zA-Z0-9]{48}/g, severity: 'critical', title: 'OpenAI API key exposta no bundle JS', id: 'CAT2-openai-key' },
  { regex: /sk_live_[a-zA-Z0-9]{24,}/g, severity: 'critical', title: 'Stripe live key exposta no bundle JS', id: 'CAT2-stripe-key' },
  { regex: /ghp_[a-zA-Z0-9]{36}/g, severity: 'critical', title: 'GitHub PAT exposto no bundle JS', id: 'CAT2-github-token' },
]

async function checkBundle(url) {
  let html
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    html = await res.text()
  } catch {
    return { findings: [], supabaseUrl: null, supabaseAnonKey: null }
  }

  const scriptUrls = extractScriptUrls(html, url)
  const bundles = await Promise.allSettled(
    scriptUrls.map(async src => {
      const res = await fetch(src, { signal: AbortSignal.timeout(15000) })
      return res.text()
    })
  )
  const allContent = bundles
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .join('\n')

  const findings = []
  let supabaseUrl = null
  let supabaseAnonKey = null

  // Supabase URL
  const urlMatch = allContent.match(/https:\/\/[a-z0-9]+\.supabase\.co/)
  if (urlMatch) supabaseUrl = urlMatch[0]

  // All JWTs
  const jwtMatches = [...allContent.matchAll(/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]*/g)]
  const seen = new Set()
  for (const m of jwtMatches) {
    const jwt = m[0]
    if (seen.has(jwt)) continue
    seen.add(jwt)
    const payload = decodeJwtPayload(jwt)
    if (!payload) continue

    if (payload.role === 'service_role') {
      findings.push({
        id: 'CAT2-service-role-key',
        category: 'bundle',
        title: 'Supabase service_role key exposta no bundle JS',
        severity: 'critical',
        evidence: `Chave service_role encontrada no bundle JS: ${jwt.substring(0, 30)}...`,
        impact: 'A service_role key bypassa toda RLS. Qualquer pessoa com o app pode ler, escrever e apagar qualquer dado.',
        details: { jwtPreview: jwt.substring(0, 30) + '...' }
      })
    } else if (payload.role === 'anon' && !supabaseAnonKey) {
      supabaseAnonKey = jwt
      findings.push({
        id: 'CAT2-anon-key',
        category: 'bundle',
        title: 'Supabase anon key detectada no bundle JS',
        severity: 'info',
        evidence: `Anon key encontrada: ${jwt.substring(0, 30)}... (esperado para apps Supabase).`,
        impact: 'A anon key é pública e esperada no bundle. Severidade real depende da configuração de RLS (Cat 3).',
        details: { jwtPreview: jwt.substring(0, 30) + '...' }
      })
    }
  }

  // Other secrets
  for (const pattern of OTHER_PATTERNS) {
    const matches = [...allContent.matchAll(pattern.regex)]
    if (matches.length > 0) {
      findings.push({
        id: pattern.id,
        category: 'bundle',
        title: pattern.title,
        severity: pattern.severity,
        evidence: `Padrão encontrado no bundle: ${matches[0][0].substring(0, 15)}...`,
        impact: 'Credencial de terceiro exposta publicamente no código do frontend.',
        details: { count: matches.length }
      })
    }
  }

  return { findings, supabaseUrl, supabaseAnonKey }
}

module.exports = { checkBundle, decodeJwtPayload, extractScriptUrls }
