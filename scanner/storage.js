// scanner/storage.js
'use strict'

async function checkStorage(supabaseUrl, anonKey) {
  if (!supabaseUrl || !anonKey) return []

  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return []

    const buckets = await res.json()
    if (!Array.isArray(buckets) || buckets.length === 0) return []

    const publicBuckets = buckets.filter(b => b.public === true)

    return [{
      id: 'CAT5-bucket-list',
      category: 'storage',
      title: `Lista de buckets acessível sem autenticação (${buckets.length} bucket${buckets.length > 1 ? 's' : ''})`,
      severity: publicBuckets.length > 0 ? 'high' : 'medium',
      evidence: `curl -s -H "apikey: <anon-key>" "${supabaseUrl}/storage/v1/bucket"  →  ${buckets.length} bucket(s) listado(s)`,
      impact: publicBuckets.length > 0
        ? `${publicBuckets.length} bucket(s) público(s): ${publicBuckets.map(b => b.name).join(', ')}. Arquivos podem ser lidos sem autenticação.`
        : 'Metadados de buckets expostos. Nomes e configurações visíveis sem login.',
      details: {
        total: buckets.length,
        publicCount: publicBuckets.length,
        publicNames: publicBuckets.map(b => b.name),
        allNames: buckets.map(b => b.name)
      }
    }]
  } catch {
    return []
  }
}

module.exports = { checkStorage }
