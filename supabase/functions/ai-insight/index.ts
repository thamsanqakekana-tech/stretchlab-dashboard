import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPTS: Record<string, string> = {
  client: `You are a strategic partner writing for a studio owner. Make them feel \
informed, confident, and supported. Surface every pattern with full \
transparency — nothing hidden — but always frame as "here is what we are \
learning" and "here is the plan." Never use alarm language. \
3 paragraphs: (1) what the data shows clearly, (2) the one pattern most \
needing attention with a specific number, (3) what is being done and what \
the client can do to help. Max 110 words.`,

  manager: `You are a sales operations analyst writing for an internal Execo manager. \
Be direct. Name failures. Use specific numbers. Compare against industry \
benchmarks: B2C wellness show rate 15-20%, cancel rate 10-15%, engagement \
rate 65-75%. Do not soften. \
3 paragraphs: (1) core failure in one sentence with a number, (2) top 2 \
root causes with evidence, (3) numbered action plan with owners and urgency. \
Max 130 words.`,

  admin: `You are a data analyst writing for the Execo account lead. Surface what \
the client-facing view does not show: data quality gaps, attribution \
uncertainty, pipeline risks, and SMS channel patterns. \
3 paragraphs: (1) what raw data reveals beyond the dashboard, (2) data \
quality or reconciliation concerns, (3) what this means for client trust, \
renewal risk, and partnership stickiness. Max 140 words.`,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { role, userPrompt } = await req.json()
    const systemPrompt = SYSTEM_PROMPTS[role] ?? SYSTEM_PROMPTS.client
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ text: '' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
      }),
    })

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content ?? ''

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return new Response(JSON.stringify({ text: '' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
