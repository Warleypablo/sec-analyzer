// scanner/index.js
'use strict'

const { checkHeaders } = require('./headers')
const { checkBundle } = require('./bundle')
const { checkSupabase } = require('./supabase')
const { checkFunctions } = require('./functions')
const { checkStorage } = require('./storage')

async function runScan(url) {
  const [headersResult, bundleResult] = await Promise.all([
    checkHeaders(url).catch(() => []),
    checkBundle(url).catch(() => ({ findings: [], supabaseUrl: null, supabaseAnonKey: null }))
  ])

  const { findings: bundleFindings, supabaseUrl, supabaseAnonKey } = bundleResult

  const [rlsFindings, functionsFindings, storageFindings] = await Promise.all([
    checkSupabase(supabaseUrl, supabaseAnonKey).catch(() => []),
    checkFunctions(supabaseUrl, supabaseAnonKey).catch(() => []),
    checkStorage(supabaseUrl, supabaseAnonKey).catch(() => [])
  ])

  return {
    findings: [...headersResult, ...bundleFindings, ...rlsFindings, ...functionsFindings, ...storageFindings],
    meta: { supabaseUrl, supabaseAnonKey, appUrl: url }
  }
}

module.exports = { runScan }
