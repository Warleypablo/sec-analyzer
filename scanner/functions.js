// scanner/functions.js
'use strict'

const COMMON_FUNCTIONS = [
  'send-email', 'send-daily-email', 'send-weekly-summary',
  'analyze', 'analyze-briefing', 'create-briefing',
  'process-transcription', 'generate-action-plan',
  'ask-anything', 'briefing-chat', 'transcribe-audio',
  'sync-transcriptions', 'create-user', 'update-user',
  'kiwify-webhook', 'stripe-webhook', 'process-payment'
]

async function testFunction(supabaseUrl, anonKey, fnName) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ __probe__: true }),
      signal: AbortSignal.timeout(8000)
    })
    if (res.status === 401 || res.status === 404) return null
    return { fnName, status: res.status }
  } catch {
    return null
  }
}

async function checkFunctions(supabaseUrl, anonKey) {
  if (!supabaseUrl || !anonKey) return []

  const results = await Promise.allSettled(
    COMMON_FUNCTIONS.map(fn => testFunction(supabaseUrl, anonKey, fn))
  )

  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => {
      const { fnName, status } = r.value
      return {
        id: `CAT4-fn-${fnName}`,
        category: 'functions',
        title: `Edge function \`${fnName}\` acessível sem JWT de usuário`,
        severity: 'high',
        evidence: `curl -s -X POST -H "apikey: <anon-key>" "${supabaseUrl}/functions/v1/${fnName}"  →  HTTP ${status} (esperado: 401)`,
        impact: 'Qualquer pessoa pode chamar esta função sem estar autenticada — risco de disparo de emails, consumo de quota de IA ou operações privilegiadas.',
        details: { fnName, responseStatus: status }
      }
    })
}

module.exports = { checkFunctions, testFunction }
