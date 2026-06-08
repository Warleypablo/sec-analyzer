// prompts/generator.js
'use strict'

const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic()

const SYSTEM_PROMPT = `Você é um especialista em segurança de aplicações web com backend Supabase.
Gere prompts de correção prontos para colar no seu assistente de código (chat de IA do editor ou plataforma), com base nos findings fornecidos.

Formato obrigatório para cada finding Alto ou Crítico:

## Prompt N — Fix [TIPO] ([SEVERIDADE]: [título])

\`\`\`
[instrução direta e completa para corrigir o problema, com contexto específico — tabelas reais, URLs reais, campos sensíveis encontrados]
\`\`\`

**Como testar depois:**
\`\`\`bash
[comando curl ou instrução de verificação específica]
\`\`\`

Para findings de severidade Média: gere apenas a instrução sem checklist de teste.
Para severidade Baixa ou Info: não gere prompt.
Escreva em português brasileiro. Seja direto e técnico.`

function calculateScore(findings) {
  const weights = { critical: 25, high: 15, medium: 5, low: 1, info: 0 }
  const total = findings.reduce((sum, f) => sum + (weights[f.severity] ?? 0), 0)
  return Math.min(total, 100)
}

function generateFallbackPrompts(findings) {
  return findings
    .filter(f => ['critical', 'high'].includes(f.severity))
    .map((f, i) => `## Prompt ${i + 1} — Fix ${f.title} (${f.id})\n\n\`\`\`\nCorrigir: ${f.title}\nImpacto: ${f.impact}\n\`\`\``)
    .join('\n\n')
}

async function generatePrompts(findings, meta) {
  const actionable = findings.filter(f => ['critical', 'high', 'medium'].includes(f.severity))
  if (actionable.length === 0) {
    return { prompts: '✅ Nenhum finding de severidade média ou superior. Nenhum prompt necessário.', error: null }
  }

  const findingsText = actionable.map((f, i) =>
    `Finding ${i + 1}: [${f.severity.toUpperCase()}] ${f.title}\nEvidência: ${f.evidence}\nImpacto: ${f.impact}\nDetalhes: ${JSON.stringify(f.details)}`
  ).join('\n\n')

  const userMessage = `App analisado: ${meta.appUrl}
Supabase URL: ${meta.supabaseUrl ?? 'não detectado'}

Findings (${actionable.length} total):

${findingsText}

Gere os prompts de correção para cada finding, seguindo o formato especificado.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }]
    })
    return { prompts: response.content[0].text, error: null }
  } catch (err) {
    return { prompts: generateFallbackPrompts(actionable), error: err.message }
  }
}

module.exports = { generatePrompts, calculateScore, generateFallbackPrompts }
