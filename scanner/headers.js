// scanner/headers.js
'use strict'

const HEADER_CHECKS = [
  { header: 'content-security-policy', severity: 'medium', name: 'Content-Security-Policy', attack: 'XSS' },
  { header: 'x-frame-options', severity: 'medium', name: 'X-Frame-Options', attack: 'Clickjacking' },
  { header: 'strict-transport-security', severity: 'medium', name: 'Strict-Transport-Security', attack: 'downgrade de HTTPS' },
  { header: 'x-content-type-options', severity: 'low', name: 'X-Content-Type-Options', attack: 'MIME sniffing' },
  { header: 'permissions-policy', severity: 'low', name: 'Permissions-Policy', attack: 'abuso de permissões do browser' },
  { header: 'referrer-policy', severity: 'low', name: 'Referrer-Policy', attack: 'vazamento de Referer' },
]

async function checkHeaders(url) {
  let response
  try {
    response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) })
  } catch (err) {
    return [{
      id: 'CAT1-fetch-error',
      category: 'headers',
      title: 'Não foi possível acessar a URL',
      severity: 'info',
      evidence: `fetch(${url}) → ${err.message}`,
      impact: 'Headers de segurança não puderam ser verificados.',
      details: { error: err.message }
    }]
  }

  const findings = []

  for (const check of HEADER_CHECKS) {
    if (!response.headers.get(check.header)) {
      findings.push({
        id: `CAT1-missing-${check.header}`,
        category: 'headers',
        title: `Header de segurança ausente: ${check.name}`,
        severity: check.severity,
        evidence: `curl -sI ${url} | grep -i "${check.header}"  →  (vazio)`,
        impact: `Ausência de ${check.name} expõe o app a ${check.attack}.`,
        details: {}
      })
    }
  }

  const cors = response.headers.get('access-control-allow-origin')
  if (cors === '*') {
    findings.push({
      id: 'CAT1-cors-wildcard',
      category: 'headers',
      title: 'CORS aberto (Access-Control-Allow-Origin: *)',
      severity: 'high',
      evidence: `curl -sI ${url} | grep -i "access-control-allow-origin"  →  *`,
      impact: 'Qualquer origem pode fazer requisições cross-origin, facilitando roubo de tokens e CSRF.',
      details: { value: cors }
    })
  }

  return findings
}

module.exports = { checkHeaders }
