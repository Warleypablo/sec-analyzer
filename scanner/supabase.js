// scanner/supabase.js
'use strict'

const COMMON_TABLES = [
  'users', 'profiles', 'leads', 'deals', 'clientes', 'customers',
  'members', 'members_profiles', 'usuarios', 'usuarios_autorizados',
  'orders', 'payments', 'documents', 'transcricoes', 'briefings',
  'comissoes', 'tarefas', 'closers', 'contacts', 'companies'
]

const SENSITIVE_TERMS = [
  'email', 'cpf', 'telefone', 'phone', 'password', 'senha',
  'token', 'key', 'secret', 'credit_card', 'cartao', 'valor', 'saldo', 'pix'
]

function detectSensitiveFields(rows) {
  if (!rows || rows.length === 0) return []
  const allKeys = rows.flatMap(r => Object.keys(r)).map(k => k.toLowerCase())
  return [...new Set(allKeys.filter(k => {
    const parts = k.split('_')
    return parts.some(part => SENSITIVE_TERMS.includes(part))
  }))]
}

async function getTableList(supabaseUrl, anonKey) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return COMMON_TABLES
    const spec = await res.json()
    const paths = Object.keys(spec.paths || {})
      .map(p => p.replace(/^\//, ''))
      .filter(p => p && !p.includes('{') && !p.includes('/'))
    return paths.length > 0 ? paths : COMMON_TABLES
  } catch {
    return COMMON_TABLES
  }
}

async function testTableSelect(supabaseUrl, anonKey, table) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=5`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000)
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null
  return data
}

async function checkSupabase(supabaseUrl, anonKey) {
  if (!supabaseUrl || !anonKey) return []

  const tables = await getTableList(supabaseUrl, anonKey)
  const results = await Promise.allSettled(
    tables.map(t => testTableSelect(supabaseUrl, anonKey, t))
  )

  const findings = []
  for (let i = 0; i < tables.length; i++) {
    const r = results[i]
    if (r.status !== 'fulfilled' || !r.value) continue
    const data = r.value
    const table = tables[i]
    const sensitiveFields = detectSensitiveFields(data)

    findings.push({
      id: `CAT3-rls-${table}`,
      category: 'rls',
      title: `Tabela \`${table}\` acessível sem autenticação`,
      severity: 'critical',
      evidence: `curl -s -H "apikey: <anon-key>" "${supabaseUrl}/rest/v1/${table}?select=*&limit=5"  →  ${data.length} registro(s)`,
      impact: sensitiveFields.length > 0
        ? `RLS ausente — dados sensíveis expostos publicamente: ${sensitiveFields.join(', ')}.`
        : `RLS ausente — tabela ${table} legível por qualquer pessoa com a anon key.`,
      details: { table, rowCount: data.length, sensitiveFields, columns: data[0] ? Object.keys(data[0]) : [] }
    })
  }

  const exposedCount = findings.length
  if (exposedCount === 0) {
    findings.push({
      id: 'CAT3-rls-ok',
      category: 'rls',
      title: 'RLS verificada — nenhum dado exposto anonimamente',
      severity: 'info',
      evidence: `Testadas ${tables.length} tabela(s) com a anon key — todas retornaram 0 registros ou 401.`,
      impact: 'Políticas de RLS estão bloqueando acesso anônimo corretamente.',
      details: { tablesChecked: tables.length, tables }
    })
  }

  return findings
}

module.exports = { checkSupabase, detectSensitiveFields, getTableList }
